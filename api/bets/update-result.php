<?php
/**
 * PUT /api/bets/update-result.php
 * Atualiza o resultado de uma aposta do proprio usuario (won/lost)
 * Body: { bet_id, status, hits, prize? }
 * - Credita premio ao saldo se status=won e prize > 0
 * - Cria transacao de premio automaticamente
 */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';

setupHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

$payload = requireAuth();
$userId = (int)$payload['sub'];
$input = json_decode(file_get_contents('php://input'), true);

$betId = (int)($input['bet_id'] ?? 0);
$status = $input['status'] ?? '';
$hits = isset($input['hits']) ? (int)$input['hits'] : null;
$prize = isset($input['prize']) ? (float)$input['prize'] : null;

if (!$betId || !in_array($status, ['won', 'lost'])) {
    http_response_code(400);
    echo json_encode(['error' => 'bet_id e status (won/lost) são obrigatórios']);
    exit;
}

$db = getDB();

// Verifica se a aposta pertence ao usuario e esta ativa
$stmt = $db->prepare('SELECT * FROM bets WHERE id = ? AND user_id = ? AND status = ?');
$stmt->execute([$betId, $userId, 'active']);
$bet = $stmt->fetch();

if (!$bet) {
    // Aposta nao encontrada, nao pertence ao usuario, ou nao esta ativa
    echo json_encode(['success' => true, 'message' => 'Aposta já processada ou não encontrada']);
    exit;
}

$db->beginTransaction();

try {
    // Atualiza status da aposta
    $stmtUpdate = $db->prepare('UPDATE bets SET status = ?, hits = ?, prize = ? WHERE id = ? AND user_id = ?');
    $stmtUpdate->execute([$status, $hits, $prize, $betId, $userId]);

    // Se ganhou e tem premio, credita ao saldo e cria transacao
    if ($status === 'won' && $prize > 0) {
        $db->prepare('UPDATE users SET balance = balance + ? WHERE id = ?')
            ->execute([$prize, $userId]);

        $db->prepare('INSERT INTO transactions (user_id, type, lottery, value, reason, date) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([
                $userId,
                'deposit',
                $bet['lottery_name'],
                $prize,
                'Prêmio - Concurso ' . ($bet['contest'] ?? ''),
                date('d/m/Y')
            ]);
    }

    $db->commit();
    echo json_encode(['success' => true, 'message' => 'Resultado da aposta atualizado']);
} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Erro ao atualizar resultado: ' . $e->getMessage()]);
}
