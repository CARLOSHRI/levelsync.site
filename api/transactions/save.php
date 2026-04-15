<?php
/** POST /api/transactions/save.php - Salvar transação */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';
setupHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

$payload = requireAuth();
$userId = (int)$payload['sub'];
$input = json_decode(file_get_contents('php://input'), true);

$db = getDB();
$type = $input['type'] ?? 'deposit';
$value = (float)($input['value'] ?? 0);

$db->beginTransaction();

try {
    $stmt = $db->prepare('INSERT INTO transactions (user_id, type, method, lottery, value, reason, date) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $userId,
        $type,
        $input['method'] ?? null,
        $input['lottery'] ?? null,
        $value,
        $input['reason'] ?? null,
        $input['date'] ?? date('d/m/Y')
    ]);
    $txId = (int)$db->lastInsertId();

    // NOTA: Saques agora são processados via api/withdrawals/create.php
    // que já deduz o saldo. Não deduzir aqui para evitar duplicação.

    $db->commit();
    echo json_encode(['success' => true, 'id' => $txId]);
} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Erro ao salvar transação: ' . $e->getMessage()]);
}
