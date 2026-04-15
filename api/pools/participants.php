<?php
/** GET /api/pools/participants.php?id=X - Participantes de um bolão (admin) */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';
setupHeaders();

requireAdmin();

$poolId = (int)($_GET['id'] ?? 0);
if (!$poolId) {
    http_response_code(400);
    echo json_encode(['error' => 'ID do bolão é obrigatório']);
    exit;
}

$db = getDB();
$stmt = $db->prepare('SELECT pp.*, u.email AS user_email FROM pool_participations pp JOIN users u ON pp.user_id = u.id WHERE pp.pool_id = ? ORDER BY pp.created_at DESC');
$stmt->execute([$poolId]);
$parts = $stmt->fetchAll();

foreach ($parts as &$p) {
    $p['id'] = (int)$p['id'];
    $p['pool_id'] = (int)$p['pool_id'];
    $p['user_id'] = (int)$p['user_id'];
    $p['quotas'] = (int)$p['quotas'];
}

echo json_encode($parts);
