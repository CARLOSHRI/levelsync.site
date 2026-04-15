<?php
/**
 * DELETE /api/bets/delete.php?id=X
 * Admin exclui uma aposta
 */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';

setupHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

requireAdmin();

$betId = (int)($_GET['id'] ?? 0);
if (!$betId) {
    http_response_code(400);
    echo json_encode(['error' => 'ID da aposta é obrigatório']);
    exit;
}

$db = getDB();

$stmt = $db->prepare('SELECT id FROM bets WHERE id = ?');
$stmt->execute([$betId]);
if (!$stmt->fetch()) {
    http_response_code(404);
    echo json_encode(['error' => 'Aposta não encontrada']);
    exit;
}

$db->prepare('DELETE FROM bets WHERE id = ?')->execute([$betId]);

echo json_encode([
    'success' => true,
    'message' => 'Aposta excluída'
]);
