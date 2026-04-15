<?php
/** PUT /api/pools/update.php?id=X - Editar bolão (admin) */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';
setupHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

requireAdmin();

$poolId = (int)($_GET['id'] ?? 0);
if (!$poolId) {
    http_response_code(400);
    echo json_encode(['error' => 'ID do bolão é obrigatório']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$fields = [];
$params = [];

$map = [
    'name' => 'name',
    'lottery' => 'lottery',
    'lotteryName' => 'lottery_name',
    'lottery_name' => 'lottery_name',
    'totalSpots' => 'total_spots',
    'total_spots' => 'total_spots',
    'filledSpots' => 'filled_spots',
    'filled_spots' => 'filled_spots',
    'quotaPrice' => 'quota_price',
    'quota_price' => 'quota_price',
    'drawDate' => 'draw_date',
    'draw_date' => 'draw_date',
    'status' => 'status',
];

foreach ($map as $inputKey => $dbCol) {
    if (isset($input[$inputKey])) {
        $fields[] = "$dbCol = ?";
        $params[] = $input[$inputKey];
    }
}

if (isset($input['numbers'])) {
    $fields[] = "numbers = ?";
    $params[] = json_encode($input['numbers']);
}

if (empty($fields)) {
    http_response_code(400);
    echo json_encode(['error' => 'Nenhum campo para atualizar']);
    exit;
}

$params[] = $poolId;
$db = getDB();
$db->prepare("UPDATE pools SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);

echo json_encode(['success' => true]);
