<?php
/** GET /api/pools/my.php - Meus bolões (participações do usuário logado) */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';
setupHeaders();

$payload = requireAuth();
$userId = (int)$payload['sub'];

$db = getDB();
$stmt = $db->prepare('
    SELECT pp.*, p.name AS pool_name, p.lottery, p.lottery_name, p.total_spots,
           p.filled_spots, p.quota_price, p.numbers, p.draw_date, p.status AS pool_status
    FROM pool_participations pp
    JOIN pools p ON pp.pool_id = p.id
    WHERE pp.user_id = ?
    ORDER BY pp.created_at DESC
');
$stmt->execute([$userId]);
$results = $stmt->fetchAll();

foreach ($results as &$r) {
    $r['id'] = (int)$r['id'];
    $r['pool_id'] = (int)$r['pool_id'];
    $r['user_id'] = (int)$r['user_id'];
    $r['quotas'] = (int)$r['quotas'];
    $r['total_spots'] = (int)$r['total_spots'];
    $r['filled_spots'] = (int)$r['filled_spots'];
    $r['quota_price'] = (float)$r['quota_price'];
    $r['numbers'] = json_decode($r['numbers'], true);
}

echo json_encode($results);
