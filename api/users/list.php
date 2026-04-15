<?php
/** GET /api/users/list.php - Lista de usuários (admin) */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';
setupHeaders();

requireAdmin();

$db = getDB();
$stmt = $db->query('SELECT id, name, email, phone, balance, role, blocked, created_at FROM users ORDER BY created_at DESC');
$users = $stmt->fetchAll();

foreach ($users as &$u) {
    $u['id'] = (int)$u['id'];
    $u['balance'] = (float)$u['balance'];
    $u['blocked'] = (bool)($u['blocked'] ?? false);
}

echo json_encode($users);
