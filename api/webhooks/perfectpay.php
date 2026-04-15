<?php
/**
 * POST /api/webhooks/user.php
 * Webhook para criar usuário (chamado por sistemas externos)
 * Body: { name, email, phone }
 * - Se email já cadastrado: retorna sucesso (sem ação)
 * - Se email não cadastrado: cria o usuário
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

setupHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];



if($input['token'] != 'a59d5d9594ec392fb7217aa7ad9555aa') exit();


$name  = trim($input['customer']['full_name'] ?? $input['customer']['full_name'] ?? '');
$email = trim($input['customer']['email'] ?? '');
$phone = preg_replace('/\D/', '', $input['customer']['phone_area_code'] . $input['customer']['phone_number']);

if (empty($email)) {
    http_response_code(400);
    echo json_encode(['error' => 'E-mail é obrigatório']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'E-mail inválido']);
    exit;
}

$db = getDB();

$stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    echo json_encode([
        'success' => true,
        'message' => 'Usuário já cadastrado',
        'action'  => 'existing'
    ]);
    exit;
}

$name = $name ?: 'Usuário';
$phone = $phone ?: null;

$placeholderHash = password_hash('__webhook_' . bin2hex(random_bytes(16)), PASSWORD_BCRYPT);
$stmt = $db->prepare('INSERT INTO users (name, email, phone, password_hash, balance, role) VALUES (?, ?, ?, ?, 0.00, "user")');
$stmt->execute([$name, $email, $phone, $placeholderHash]);
$userId = (int)$db->lastInsertId();

echo json_encode([
    'success'  => true,
    'message'  => 'Usuário criado',
    'action'   => 'created',
    'user_id'  => $userId
]);
