<?php
/** DELETE /api/pools/delete.php?id=X - Excluir bolão (admin) */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';
setupHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
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

$db = getDB();
$db->prepare('DELETE FROM pools WHERE id = ?')->execute([$poolId]);

echo json_encode(['success' => true]);
