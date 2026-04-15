<?php
/**
 * POST /api/withdrawals/create.php
 * Cria uma solicitação de saque (status = pending)
 * Body: { amount, pix_key }
 */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';

setupHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

$payload = requireAuth();
$userId = (int)$payload['sub'];
$input = json_decode(file_get_contents('php://input'), true);

$amount = (float)($input['amount'] ?? 0);
$pixKey = trim($input['pix_key'] ?? '');

if ($amount < 20) {
    http_response_code(400);
    echo json_encode(['error' => 'Valor mínimo para saque é R$ 20,00']);
    exit;
}

if (empty($pixKey)) {
    http_response_code(400);
    echo json_encode(['error' => 'Chave PIX é obrigatória']);
    exit;
}

$db = getDB();

// Verifica se já existe saque pendente
$stmtPending = $db->prepare('SELECT COUNT(*) as cnt FROM withdrawals WHERE user_id = ? AND status = ?');
$stmtPending->execute([$userId, 'pending']);
$pending = $stmtPending->fetch();
if ((int)($pending['cnt'] ?? 0) > 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Você já possui um saque pendente. Aguarde a aprovação antes de solicitar outro.']);
    exit;
}

// Verifica saldo
$stmt = $db->prepare('SELECT balance FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user || (float)$user['balance'] < $amount) {
    http_response_code(400);
    echo json_encode(['error' => 'Saldo insuficiente']);
    exit;
}

$db->beginTransaction();

try {
    // Cria o saque com status pendente
    $stmt = $db->prepare('INSERT INTO withdrawals (user_id, amount, pix_key, status) VALUES (?, ?, ?, ?)');
    $stmt->execute([$userId, $amount, $pixKey, 'pending']);
    $withdrawId = (int)$db->lastInsertId();

    // Deduz o saldo do usuario (reserva o valor)
    $db->prepare('UPDATE users SET balance = balance - ? WHERE id = ?')
        ->execute([$amount, $userId]);

    // Cria transação de saque
    $db->prepare('INSERT INTO transactions (user_id, type, method, value, reason, date) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([$userId, 'withdraw', 'pix', $amount, "PIX: $pixKey", date('d/m/Y')]);

    $db->commit();
    echo json_encode(['success' => true, 'id' => $withdrawId]);
} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Erro ao criar saque: ' . $e->getMessage()]);
}
