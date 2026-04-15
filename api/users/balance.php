<?php
/**
 * PUT /api/users/balance.php
 * Ajustar saldo de um usuário (admin)
 * Body: { user_id, amount, reason }
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
$targetUserId = (int)($input['user_id'] ?? 0);
$amount = (float)($input['amount'] ?? 0);
$reason = trim($input['reason'] ?? 'Ajuste pelo admin');

if (!$targetUserId || $amount == 0) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id e amount são obrigatórios']);
    exit;
}

$db = getDB();

// Verifica se o saldo resultante não fica negativo
$stmt = $db->prepare('SELECT balance FROM users WHERE id = ?');
$stmt->execute([$targetUserId]);
$user = $stmt->fetch();

if (!$user) {
    http_response_code(404);
    echo json_encode(['error' => 'Usuário não encontrado']);
    exit;
}

$newBalance = (float)$user['balance'] + $amount;
if ($newBalance < 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Saldo não pode ficar negativo']);
    exit;
}

$db->beginTransaction();
try {
    $db->prepare('UPDATE users SET balance = ? WHERE id = ?')->execute([$newBalance, $targetUserId]);

    $db->prepare('INSERT INTO transactions (user_id, type, method, value, reason, date) VALUES (?, ?, "admin", ?, ?, ?)')
       ->execute([
           $targetUserId,
           $amount > 0 ? 'deposit' : 'withdraw',
           abs($amount),
           $reason,
           date('d/m/Y')
       ]);

    $db->commit();
    echo json_encode(['success' => true, 'new_balance' => $newBalance]);
} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Erro ao ajustar saldo']);
}
