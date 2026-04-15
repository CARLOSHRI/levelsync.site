<?php
/**
 * POST /api/auth/register.php
 * Cadastro de novo usuário
 * Body: { name, email, password }
 * Response: { token, user: { id, name, email, balance, role } }
 */

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/jwt.php';

setupHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$name     = trim($input['name'] ?? '');
$email    = trim($input['email'] ?? '');
$phone    = trim($input['phone'] ?? '');
$password = $input['password'] ?? '';

// Validações
if (empty($name) || empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode(['error' => 'Nome, e-mail e senha são obrigatórios']);
    exit;
}

if (strlen($password) < 6) {
    http_response_code(400);
    echo json_encode(['error' => 'A senha deve ter no mínimo 6 caracteres']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'E-mail inválido']);
    exit;
}

$db = getDB();

// Verifica se e-mail já existe
$stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    http_response_code(409);
    echo json_encode(['error' => 'Este e-mail já está cadastrado']);
    exit;
}

// Cria usuário
$hash = password_hash($password, PASSWORD_BCRYPT);
$stmt = $db->prepare('INSERT INTO users (name, email, phone, password_hash, balance, role) VALUES (?, ?, ?, ?, 0.00, "user")');
$stmt->execute([$name, $email, $phone ?: null, $hash]);
$userId = (int)$db->lastInsertId();

// Gera token
$token = generateToken($userId, 'user');

echo json_encode([
    'token' => $token,
    'user' => [
        'id'      => $userId,
        'name'    => $name,
        'email'   => $email,
        'phone'   => $phone ?: null,
        'balance' => 0,
        'role'    => 'user'
    ]
]);
