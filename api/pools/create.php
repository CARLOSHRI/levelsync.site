<?php
/** POST /api/pools/create.php - Criar bolão (admin) */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';
setupHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

requireAdmin();

$input = json_decode(file_get_contents('php://input'), true);
$name = trim($input['name'] ?? '');
$lottery = $input['lottery'] ?? '';
$lotteryName = $input['lotteryName'] ?? $input['lottery_name'] ?? '';
$totalSpots = (int)($input['totalSpots'] ?? $input['total_spots'] ?? 0);
$quotaPrice = (float)($input['quotaPrice'] ?? $input['quota_price'] ?? 0);
$numbers = $input['numbers'] ?? [];
$drawDate = $input['drawDate'] ?? $input['draw_date'] ?? '';

if (empty($name) || $totalSpots < 2 || $quotaPrice <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Dados obrigatórios faltando']);
    exit;
}

$db = getDB();
$stmt = $db->prepare('INSERT INTO pools (name, lottery, lottery_name, total_spots, filled_spots, quota_price, numbers, draw_date, status) VALUES (?, ?, ?, ?, 0, ?, ?, ?, "active")');
$stmt->execute([$name, $lottery, $lotteryName, $totalSpots, $quotaPrice, json_encode($numbers), $drawDate]);

echo json_encode(['success' => true, 'id' => (int)$db->lastInsertId()]);
