<?php
/**
 * PUT /api/users/block.php
 * Admin bloqueia ou desbloqueia um usuário
 * Body: { user_id, blocked: true/false }
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
$userId = (int)($input['user_id'] ?? 0);
$blocked = (bool)($input['blocked'] ?? false);

if (!$userId) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id é obrigatório']);
    exit;
}

$db = getDB();

$stmt = $db->prepare('SELECT id, role FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user) {
    http_response_code(404);
    echo json_encode(['error' => 'Usuário não encontrado']);
    exit;
}

if ($user['role'] === 'admin') {
    http_response_code(400);
    echo json_encode(['error' => 'Não é possível bloquear um administrador']);
    exit;
}

$db->prepare('UPDATE users SET blocked = ? WHERE id = ?')
   ->execute([$blocked ? 1 : 0, $userId]);

echo json_encode([
    'success' => true,
    'blocked' => $blocked,
    'message' => $blocked ? 'Usuário bloqueado' : 'Usuário desbloqueado'
]);
