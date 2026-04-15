<?php
/**
 * GET /api/deposits/status.php?transactionId=xxx
 * Verifica o status de um depósito PIX na Duttyfy.
 * Se COMPLETED e ainda não creditado, credita o saldo e registra transação.
 * Usa SELECT ... FOR UPDATE dentro de transação para impedir crédito duplicado.
 */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/duttyfy.php';

setupHeaders();

$payload = requireAuth();
$userId = (int)$payload['sub'];

$transactionId = trim($_GET['transactionId'] ?? '');
if (empty($transactionId)) {
    http_response_code(400);
    echo json_encode(['error' => 'transactionId é obrigatório']);
    exit;
}

$db = getDB();

// Toda a lógica dentro de uma transação com lock de linha
$db->beginTransaction();
try {
    // SELECT FOR UPDATE trava a linha até o COMMIT, impedindo que outro processo leia/atualize
    $stmt = $db->prepare('SELECT * FROM deposits WHERE transaction_id = ? AND user_id = ? FOR UPDATE');
    $stmt->execute([$transactionId, $userId]);
    $deposit = $stmt->fetch();

    if (!$deposit) {
        $db->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'Depósito não encontrado']);
        exit;
    }

    // Já foi creditado → retorna direto
    if ((int)$deposit['credited'] === 1) {
        $db->rollBack();
        echo json_encode([
            'status' => 'COMPLETED',
            'credited' => true,
            'amount' => (float)$deposit['amount'],
            'paidAt' => $deposit['paid_at']
        ]);
        exit;
    }

    // Só verifica na Duttyfy se ainda está PENDING
    if ($deposit['status'] !== 'PENDING') {
        $db->rollBack();
        echo json_encode([
            'status' => $deposit['status'],
            'credited' => false,
            'amount' => (float)$deposit['amount']
        ]);
        exit;
    }

    // Consulta Duttyfy
    $result = duttyfyRequest('GET', '?transactionId=' . urlencode($transactionId));

    if (isset($result['error'])) {
        $db->rollBack();
        echo json_encode([
            'status' => 'PENDING',
            'credited' => false,
            'amount' => (float)$deposit['amount']
        ]);
        exit;
    }

    $newStatus = $result['status'] ?? 'PENDING';
    $paidAt = $result['paidAt'] ?? null;

    if ($newStatus === 'COMPLETED') {
        // Credita saldo (a linha já está travada pelo FOR UPDATE)
        $amount = (float)$deposit['amount'];

        $db->prepare('UPDATE deposits SET status = "COMPLETED", paid_at = ?, credited = 1 WHERE id = ?')
           ->execute([$paidAt, $deposit['id']]);

        $db->prepare('UPDATE users SET balance = balance + ? WHERE id = ?')
           ->execute([$amount, $userId]);

        $db->prepare('INSERT INTO transactions (user_id, type, method, value, reason, date) VALUES (?, "deposit", "pix", ?, ?, ?)')
           ->execute([$userId, $amount, 'Depósito via PIX #' . $transactionId, date('d/m/Y')]);

        $db->commit();

        echo json_encode([
            'status' => 'COMPLETED',
            'credited' => true,
            'amount' => $amount,
            'paidAt' => $paidAt
        ]);
        exit;
    }

    // Ainda PENDING na Duttyfy, atualiza se mudou
    if ($newStatus !== $deposit['status']) {
        $db->prepare('UPDATE deposits SET status = ? WHERE id = ?')
           ->execute([$newStatus, $deposit['id']]);
    }
    $db->commit();

    echo json_encode([
        'status' => $newStatus,
        'credited' => false,
        'amount' => (float)$deposit['amount']
    ]);
} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Erro ao processar']);
}
