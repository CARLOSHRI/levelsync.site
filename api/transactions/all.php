<?php
/** GET /api/transactions/all.php - Todas as transações (admin) */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';
setupHeaders();

requireAdmin();

$db = getDB();
$stmt = $db->query('SELECT t.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone FROM transactions t JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC LIMIT 500');
$txs = $stmt->fetchAll();

foreach ($txs as &$t) {
    $t['id'] = (int)$t['id'];
    $t['user_id'] = (int)$t['user_id'];
    $t['value'] = (float)$t['value'];
}

echo json_encode($txs);
