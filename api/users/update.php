<?php
/**
 * PUT /api/users/update.php
 * Admin edita dados de um usuário (nome, email, role)
 * Body: { user_id, name?, email?, role? }
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

if (!$userId) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id é obrigatório']);
    exit;
}

$db = getDB();

$stmt = $db->prepare('SELECT * FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user) {
    http_response_code(404);
    echo json_encode(['error' => 'Usuário não encontrado']);
    exit;
}

$fields = [];
$params = [];

if (isset($input['name']) && trim($input['name'])) {
    $fields[] = 'name = ?';
    $params[] = trim($input['name']);
}

if (isset($input['email']) && trim($input['email'])) {
    // Verifica se email já existe em outro usuário
    $stmtCheck = $db->prepare('SELECT id FROM users WHERE email = ? AND id != ?');
    $stmtCheck->execute([trim($input['email']), $userId]);
    if ($stmtCheck->fetch()) {
        http_response_code(400);
        echo json_encode(['error' => 'E-mail já está em uso por outro usuário']);
        exit;
    }
    $fields[] = 'email = ?';
    $params[] = trim($input['email']);
}

if (isset($input['phone'])) {
    $fields[] = 'phone = ?';
    $params[] = trim($input['phone']) ?: null;
}

if (isset($input['role']) && in_array($input['role'], ['user', 'admin'])) {
    $fields[] = 'role = ?';
    $params[] = $input['role'];
}

if (empty($fields)) {
    http_response_code(400);
    echo json_encode(['error' => 'Nenhum campo para atualizar']);
    exit;
}

$params[] = $userId;
$sql = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?';
$db->prepare($sql)->execute($params);

echo json_encode([
    'success' => true,
    'message' => 'Usuário atualizado'
]);
