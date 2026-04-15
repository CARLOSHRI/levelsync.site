<?php
/**
 * PUT /api/bets/update.php
 * Admin edita uma aposta
 * Body: { bet_id, status?, value?, numbers?, prize?, hits? }
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
$betId = (int)($input['bet_id'] ?? 0);

if (!$betId) {
    http_response_code(400);
    echo json_encode(['error' => 'bet_id é obrigatório']);
    exit;
}

$db = getDB();

$stmt = $db->prepare('SELECT * FROM bets WHERE id = ?');
$stmt->execute([$betId]);
$bet = $stmt->fetch();

if (!$bet) {
    http_response_code(404);
    echo json_encode(['error' => 'Aposta não encontrada']);
    exit;
}

$fields = [];
$params = [];

if (isset($input['status']) && in_array($input['status'], ['active', 'won', 'lost'])) {
    $fields[] = 'status = ?';
    $params[] = $input['status'];
}

if (isset($input['value']) && is_numeric($input['value'])) {
    $fields[] = 'value = ?';
    $params[] = (float)$input['value'];
}

if (isset($input['numbers']) && is_array($input['numbers'])) {
    $fields[] = 'numbers = ?';
    $params[] = json_encode($input['numbers']);
}

if (isset($input['prize'])) {
    $fields[] = 'prize = ?';
    $params[] = $input['prize'] !== null ? (float)$input['prize'] : null;
}

if (isset($input['hits'])) {
    $fields[] = 'hits = ?';
    $params[] = $input['hits'] !== null ? (int)$input['hits'] : null;
}

if (empty($fields)) {
    http_response_code(400);
    echo json_encode(['error' => 'Nenhum campo para atualizar']);
    exit;
}

$params[] = $betId;
$sql = 'UPDATE bets SET ' . implode(', ', $fields) . ' WHERE id = ?';

$db->beginTransaction();

try {
    $db->prepare($sql)->execute($params);

    // Se o admin mudou status para 'won' com prêmio, credita ao saldo do usuario
    $newStatus = $input['status'] ?? null;
    $oldStatus = $bet['status'];
    $prizeAmount = isset($input['prize']) && $input['prize'] !== null ? (float)$input['prize'] : null;

    if ($newStatus === 'won' && $oldStatus !== 'won' && $prizeAmount > 0) {
        $db->prepare('UPDATE users SET balance = balance + ? WHERE id = ?')
            ->execute([$prizeAmount, (int)$bet['user_id']]);

        $db->prepare('INSERT INTO transactions (user_id, type, lottery, value, reason, date) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([
                (int)$bet['user_id'],
                'deposit',
                $bet['lottery_name'],
                $prizeAmount,
                'Prêmio (admin) - Concurso ' . ($bet['contest'] ?? ''),
                date('d/m/Y')
            ]);
    }

    // Se o admin mudou de 'won' para outro status, estorna o prêmio
    if ($oldStatus === 'won' && $newStatus && $newStatus !== 'won') {
        $oldPrize = (float)($bet['prize'] ?? 0);
        if ($oldPrize > 0) {
            $db->prepare('UPDATE users SET balance = balance - ? WHERE id = ?')
                ->execute([$oldPrize, (int)$bet['user_id']]);
        }
    }

    $db->commit();
    echo json_encode(['success' => true, 'message' => 'Aposta atualizada']);
} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Erro ao atualizar aposta: ' . $e->getMessage()]);
}
