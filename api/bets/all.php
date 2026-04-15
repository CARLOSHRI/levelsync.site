<?php
/** GET /api/bets/all.php - Todas as apostas (admin) */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';
setupHeaders();

requireAdmin();

$db = getDB();
$stmt = $db->query('SELECT b.*, u.name AS user_name, u.email AS user_email FROM bets b JOIN users u ON b.user_id = u.id ORDER BY b.created_at DESC LIMIT 500');
$bets = $stmt->fetchAll();

foreach ($bets as &$b) {
    $b['id'] = (int)$b['id'];
    $b['user_id'] = (int)$b['user_id'];
    $b['value'] = (float)$b['value'];
    $b['prize'] = $b['prize'] ? (float)$b['prize'] : null;
    $b['hits'] = $b['hits'] ? (int)$b['hits'] : null;
    $b['contest'] = $b['contest'] ? (int)$b['contest'] : null;
    $b['numbers'] = json_decode($b['numbers'], true);
}

echo json_encode($bets);
