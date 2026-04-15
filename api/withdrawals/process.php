<?php
/**
 * PUT /api/withdrawals/process.php
 * Admin aprova ou rejeita um saque
 * Body: { withdrawal_id, action: 'approve'|'reject', note? }
 * - approve: marca como approved
 * - reject: marca como rejected e devolve o saldo ao usuario
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
$withdrawalId = (int)($input['withdrawal_id'] ?? 0);
$action = $input['action'] ?? '';
$note = trim($input['note'] ?? '');

if (!$withdrawalId || !in_array($action, ['approve', 'reject'])) {
    http_response_code(400);
    echo json_encode(['error' => 'withdrawal_id e action (approve/reject) são obrigatórios']);
    exit;
}

$db = getDB();

$stmt = $db->prepare('SELECT * FROM withdrawals WHERE id = ? AND status = ?');
$stmt->execute([$withdrawalId, 'pending']);
$withdrawal = $stmt->fetch();

if (!$withdrawal) {
    http_response_code(404);
    echo json_encode(['error' => 'Saque não encontrado ou já processado']);
    exit;
}

$db->beginTransaction();

try {
    $newStatus = $action === 'approve' ? 'approved' : 'rejected';

    $db->prepare('UPDATE withdrawals SET status = ?, admin_note = ?, processed_at = NOW() WHERE id = ?')
        ->execute([$newStatus, $note ?: null, $withdrawalId]);

    // Se rejeitado, devolve o saldo
    if ($action === 'reject') {
        $db->prepare('UPDATE users SET balance = balance + ? WHERE id = ?')
            ->execute([(float)$withdrawal['amount'], (int)$withdrawal['user_id']]);

        // Cria transação de estorno
        $db->prepare('INSERT INTO transactions (user_id, type, method, value, reason, date) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([
                (int)$withdrawal['user_id'],
                'deposit',
                'admin',
                (float)$withdrawal['amount'],
                'Saque rejeitado - Estorno' . ($note ? ": $note" : ''),
                date('d/m/Y')
            ]);
    }

    $db->commit();

    $actionLabel = $action === 'approve' ? 'aprovado' : 'rejeitado';
    echo json_encode(['success' => true, 'message' => "Saque $actionLabel com sucesso"]);
} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Erro ao processar saque: ' . $e->getMessage()]);
}
