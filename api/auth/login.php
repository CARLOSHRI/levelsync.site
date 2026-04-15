<?php
/**
 * POST /api/auth/login.php
 * Login do usuário (apenas e-mail, sem senha)
 * Body: { email }
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

// ==================== RATE LIMITING ====================
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$rateLimitDir = __DIR__ . '/../_rate_limit';
if (!is_dir($rateLimitDir)) @mkdir($rateLimitDir, 0755, true);

$rateLimitFile = $rateLimitDir . '/' . md5($ip) . '.json';
$maxAttempts = 10;
$windowSeconds = 900; // 15 minutos

$attempts = [];
if (file_exists($rateLimitFile)) {
    $attempts = json_decode(file_get_contents($rateLimitFile), true) ?: [];
    $attempts = array_filter($attempts, fn($t) => $t > (time() - $windowSeconds));
}

if (count($attempts) >= $maxAttempts) {
    $waitMinutes = ceil(($attempts[0] + $windowSeconds - time()) / 60);
    http_response_code(429);
    echo json_encode(['error' => "Muitas tentativas. Tente novamente em {$waitMinutes} minuto(s)."]);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$email = trim($input['email'] ?? '');

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
$stmt = $db->prepare('SELECT id, name, email, balance, role, blocked FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user) {
    $attempts[] = time();
    file_put_contents($rateLimitFile, json_encode(array_values($attempts)));
    http_response_code(401);
    echo json_encode(['error' => 'E-mail não cadastrado. Entre em contato para criar sua conta.']);
    exit;
}

if (!empty($user['blocked'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Sua conta foi bloqueada. Entre em contato com o suporte.']);
    exit;
}

if (file_exists($rateLimitFile)) @unlink($rateLimitFile);

$token = generateToken((int)$user['id'], $user['role']);

echo json_encode([
    'token' => $token,
    'user' => [
        'id'      => (int)$user['id'],
        'name'    => $user['name'],
        'email'   => $user['email'],
        'balance' => (float)$user['balance'],
        'role'    => $user['role']
    ]
]);
