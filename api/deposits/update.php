<?php
/**
 * PUT /api/deposits/update.php
 * Admin edita dados de um depósito (status, etc.)
 * Body: { deposit_id, status }
 */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';

setupHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

requireAdmin();

$input = json_decode(file_get_contents('php://input'), true);
$depositId = (int)($input['deposit_id'] ?? 0);
$newStatus = trim($input['status'] ?? '');

if (!$depositId) {
    http_response_code(400);
    echo json_encode(['error' => 'deposit_id é obrigatório']);
    exit;
}

$validStatuses = ['PENDING', 'COMPLETED', 'EXPIRED', 'CANCELLED'];
if ($newStatus && !in_array($newStatus, $validStatuses)) {
    http_response_code(400);
    echo json_encode(['error' => 'Status inválido']);
    exit;
}

$db = getDB();

$stmt = $db->prepare('SELECT * FROM deposits WHERE id = ?');
$stmt->execute([$depositId]);
$deposit = $stmt->fetch();

if (!$deposit) {
    http_response_code(404);
    echo json_encode(['error' => 'Depósito não encontrado']);
    exit;
}

// Atualiza status
if ($newStatus) {
    $db->prepare('UPDATE deposits SET status = ? WHERE id = ?')
       ->execute([$newStatus, $depositId]);
}

echo json_encode([
    'success' => true,
    'message' => 'Depósito atualizado'
]);
