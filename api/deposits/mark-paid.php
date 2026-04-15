<?php
/**
 * PUT /api/deposits/mark-paid.php
 * Admin marca um depósito como PAGO e credita saldo ao usuário.
 * Body: { deposit_id }
 * Usa transação com FOR UPDATE para evitar crédito duplicado.
 */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';

setupHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

requireAdmin();

$input = json_decode(file_get_contents('php://input'), true);
$depositId = (int)($input['deposit_id'] ?? 0);

if (!$depositId) {
    http_response_code(400);
    echo json_encode(['error' => 'deposit_id é obrigatório']);
    exit;
}

$db = getDB();
$db->beginTransaction();

try {
    // Lock do depósito
    $stmt = $db->prepare('SELECT * FROM deposits WHERE id = ? FOR UPDATE');
    $stmt->execute([$depositId]);
    $deposit = $stmt->fetch();

    if (!$deposit) {
        $db->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'Depósito não encontrado']);
        exit;
    }

    // Já creditado
    if ((int)$deposit['credited'] === 1) {
        $db->rollBack();
        echo json_encode(['message' => 'Depósito já foi creditado anteriormente', 'already_credited' => true]);
        exit;
    }

    $amount = (float)$deposit['amount'];
    $userId = (int)$deposit['user_id'];

    // Marca como COMPLETED e creditado
    $db->prepare('UPDATE deposits SET status = "COMPLETED", credited = 1, paid_at = NOW() WHERE id = ?')
       ->execute([$depositId]);

    // Credita saldo
    $db->prepare('UPDATE users SET balance = balance + ? WHERE id = ?')
       ->execute([$amount, $userId]);

    // Registra transação
    $db->prepare('INSERT INTO transactions (user_id, type, method, value, reason, date) VALUES (?, "deposit", "pix_admin", ?, ?, ?)')
       ->execute([$userId, $amount, 'Depósito marcado como pago pelo admin #' . $deposit['transaction_id'], date('d/m/Y')]);

    $db->commit();

    echo json_encode([
        'success' => true,
        'amount' => $amount,
        'user_id' => $userId,
        'message' => 'Depósito marcado como pago e saldo creditado'
    ]);
} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Erro ao processar: ' . $e->getMessage()]);
}
