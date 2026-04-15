<?php
/**
 * POST /api/auth/admin-login.php
 * Login do administrador (e-mail + senha)
 * Body: { email, password }
 * Response: { token, user: { id, name, email, role } }
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
$email = trim($input['email'] ?? '');
$password = $input['password'] ?? '';

if (empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode(['error' => 'E-mail e senha são obrigatórios']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'E-mail inválido']);
    exit;
}

$db = getDB();
$stmt = $db->prepare('SELECT id, name, email, password_hash, role FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user) {
    http_response_code(401);
    echo json_encode(['error' => 'Credenciais inválidas']);
    exit;
}

if ($user['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error' => 'Acesso negado. Apenas administradores.']);
    exit;
}

if (!password_verify($password, $user['password_hash'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Credenciais inválidas']);
    exit;
}

$token = generateToken((int)$user['id'], $user['role']);

echo json_encode([
    'token' => $token,
    'user' => [
        'id'    => (int)$user['id'],
        'name'  => $user['name'],
        'email' => $user['email'],
        'role'  => $user['role']
    ]
]);
