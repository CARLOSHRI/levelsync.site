<?php
/** GET /api/bets/list.php - Apostas do usuário logado */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';
setupHeaders();

$payload = requireAuth();
$db = getDB();
$stmt = $db->prepare('SELECT * FROM bets WHERE user_id = ? ORDER BY created_at DESC');
$stmt->execute([(int)$payload['sub']]);
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
