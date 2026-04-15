<?php
/** POST /api/pools/participate.php - Participar de um bolão */
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

$poolId = (int)($input['poolId'] ?? $input['pool_id'] ?? 0);
$quotas = (int)($input['quotas'] ?? 1);

if (!$poolId || $quotas < 1) {
    http_response_code(400);
    echo json_encode(['error' => 'Pool ID e quantidade de cotas são obrigatórios']);
    exit;
}

$db = getDB();

// Busca bolão
$stmt = $db->prepare('SELECT * FROM pools WHERE id = ?');
$stmt->execute([$poolId]);
$pool = $stmt->fetch();

if (!$pool) {
    http_response_code(404);
    echo json_encode(['error' => 'Bolão não encontrado']);
    exit;
}

$available = (int)$pool['total_spots'] - (int)$pool['filled_spots'];
if ($quotas > $available) {
    http_response_code(400);
    echo json_encode(['error' => 'Cotas insuficientes']);
    exit;
}

// Busca saldo e nome do usuário
$stmt = $db->prepare('SELECT name, balance FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();

$total = $quotas * (float)$pool['quota_price'];
if ((float)$user['balance'] < $total) {
    http_response_code(400);
    echo json_encode(['error' => 'Saldo insuficiente']);
    exit;
}

// Transação atômica
$db->beginTransaction();
try {
    // Registra participação
    $db->prepare('INSERT INTO pool_participations (pool_id, user_id, user_name, quotas) VALUES (?, ?, ?, ?)')
       ->execute([$poolId, $userId, $user['name'], $quotas]);

    // Atualiza cotas preenchidas
    $db->prepare('UPDATE pools SET filled_spots = filled_spots + ? WHERE id = ?')
       ->execute([$quotas, $poolId]);

    // Debita saldo
    $db->prepare('UPDATE users SET balance = balance - ? WHERE id = ?')
       ->execute([$total, $userId]);

    // Registra transação
    $db->prepare('INSERT INTO transactions (user_id, type, method, value, date) VALUES (?, "pool", "bolão", ?, ?)')
       ->execute([$userId, $total, date('d/m/Y')]);

    $db->commit();

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Erro ao processar participação']);
}
