<?php
/** GET /api/pools/list.php - Listar bolões */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';
setupHeaders();

requireAuth();

$db = getDB();
$stmt = $db->query('SELECT * FROM pools ORDER BY created_at DESC');
$pools = $stmt->fetchAll();

foreach ($pools as &$p) {
    $p['id'] = (int)$p['id'];
    $p['total_spots'] = (int)$p['total_spots'];
    $p['filled_spots'] = (int)$p['filled_spots'];
    $p['quota_price'] = (float)$p['quota_price'];
    $p['numbers'] = json_decode($p['numbers'], true);
    // Compatibilidade com frontend
    $p['totalSpots'] = $p['total_spots'];
    $p['filledSpots'] = $p['filled_spots'];
    $p['quotaPrice'] = $p['quota_price'];
    $p['lotteryName'] = $p['lottery_name'];
    $p['drawDate'] = $p['draw_date'];
}

echo json_encode($pools);
