<?php
/**
 * GET /api/auth/me.php
 * Retorna dados do usuário logado
 * Header: Authorization: Bearer {token}
 * Response: { id, name, email, balance, role, created_at }
 */

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';

setupHeaders();

$payload = requireAuth();
$userId = (int)$payload['sub'];

$db = getDB();
$stmt = $db->prepare('SELECT id, name, email, phone, balance, role, blocked, created_at FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user) {
    http_response_code(404);
    echo json_encode(['error' => 'Usuário não encontrado']);
    exit;
}

// Se o usuário foi bloqueado, retorna 403
if (!empty($user['blocked'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Sua conta foi bloqueada. Entre em contato com o suporte.']);
    exit;
}

$user['id'] = (int)$user['id'];
$user['balance'] = (float)$user['balance'];
unset($user['blocked']); // Não expor campo blocked ao frontend

echo json_encode($user);
