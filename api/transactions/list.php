<?php
/** GET /api/transactions/list.php - Transações do usuário logado */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';
setupHeaders();

$payload = requireAuth();
$db = getDB();
$stmt = $db->prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC');
$stmt->execute([(int)$payload['sub']]);
$txs = $stmt->fetchAll();

foreach ($txs as &$t) {
    $t['id'] = (int)$t['id'];
    $t['user_id'] = (int)$t['user_id'];
    $t['value'] = (float)$t['value'];
}

echo json_encode($txs);
