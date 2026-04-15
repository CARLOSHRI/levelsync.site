<?php
/**
 * PUT /api/users/update-self.php
 * Usuario atualiza seus proprios dados (nome, email, telefone, senha)
 * Body: { name?, email?, phone?, current_password?, new_password? }
 */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';

setupHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

$payload = requireAuth();
$userId = (int)$payload['sub'];
$input = json_decode(file_get_contents('php://input'), true);

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

// Atualizar nome
if (isset($input['name']) && trim($input['name'])) {
    $fields[] = 'name = ?';
    $params[] = trim($input['name']);
}

// Atualizar email
if (isset($input['email']) && trim($input['email'])) {
    $newEmail = trim($input['email']);
    if (!filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'E-mail inválido']);
        exit;
    }
    // Verifica duplicidade
    $stmtCheck = $db->prepare('SELECT id FROM users WHERE email = ? AND id != ?');
    $stmtCheck->execute([$newEmail, $userId]);
    if ($stmtCheck->fetch()) {
        http_response_code(400);
        echo json_encode(['error' => 'Este e-mail já está em uso']);
        exit;
    }
    $fields[] = 'email = ?';
    $params[] = $newEmail;
}

// Atualizar telefone
if (isset($input['phone'])) {
    $fields[] = 'phone = ?';
    $params[] = trim($input['phone']) ?: null;
}

// Atualizar senha
if (!empty($input['new_password'])) {
    if (empty($input['current_password'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Senha atual é obrigatória para alterar a senha']);
        exit;
    }
    if (!password_verify($input['current_password'], $user['password_hash'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Senha atual incorreta']);
        exit;
    }
    if (strlen($input['new_password']) < 6) {
        http_response_code(400);
        echo json_encode(['error' => 'Nova senha deve ter no mínimo 6 caracteres']);
        exit;
    }
    $fields[] = 'password_hash = ?';
    $params[] = password_hash($input['new_password'], PASSWORD_BCRYPT);
}

if (empty($fields)) {
    http_response_code(400);
    echo json_encode(['error' => 'Nenhum campo para atualizar']);
    exit;
}

$params[] = $userId;
$sql = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?';
$db->prepare($sql)->execute($params);

echo json_encode(['success' => true, 'message' => 'Dados atualizados com sucesso']);
