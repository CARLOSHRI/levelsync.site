<?php
/** GET /api/users/detail.php?id=X - Detalhes de um usuário (admin) */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';
setupHeaders();

requireAdmin();

$targetId = (int)($_GET['id'] ?? 0);
if (!$targetId) {
    http_response_code(400);
    echo json_encode(['error' => 'ID do usuário é obrigatório']);
    exit;
}

$db = getDB();

// Usuário
$stmt = $db->prepare('SELECT id, name, email, phone, balance, role, blocked, created_at FROM users WHERE id = ?');
$stmt->execute([$targetId]);
$user = $stmt->fetch();

if (!$user) {
    http_response_code(404);
    echo json_encode(['error' => 'Usuário não encontrado']);
    exit;
}
$user['id'] = (int)$user['id'];
$user['balance'] = (float)$user['balance'];
$user['blocked'] = (bool)($user['blocked'] ?? false);

// Apostas
$stmt = $db->prepare('SELECT * FROM bets WHERE user_id = ? ORDER BY created_at DESC LIMIT 50');
$stmt->execute([$targetId]);
$bets = $stmt->fetchAll();
foreach ($bets as &$b) {
    $b['id'] = (int)$b['id'];
    $b['value'] = (float)$b['value'];
    $b['prize'] = $b['prize'] ? (float)$b['prize'] : null;
    $b['numbers'] = json_decode($b['numbers'], true);
}

// Transações
$stmt = $db->prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50');
$stmt->execute([$targetId]);
$txs = $stmt->fetchAll();
foreach ($txs as &$t) {
    $t['id'] = (int)$t['id'];
    $t['value'] = (float)$t['value'];
}

// Depósitos
$stmt = $db->prepare('SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at DESC LIMIT 50');
$stmt->execute([$targetId]);
$deposits = $stmt->fetchAll();
foreach ($deposits as &$d) {
    $d['id'] = (int)$d['id'];
    $d['amount'] = (float)$d['amount'];
    $d['credited'] = (bool)$d['credited'];
}

// Estatísticas
$stmtStats = $db->prepare('
    SELECT
        COUNT(*) as total_bets,
        SUM(CASE WHEN status = "won" THEN 1 ELSE 0 END) as won_bets,
        SUM(CASE WHEN status = "lost" THEN 1 ELSE 0 END) as lost_bets,
        SUM(CASE WHEN status = "active" THEN 1 ELSE 0 END) as active_bets,
        COALESCE(SUM(value), 0) as total_bet_value,
        COALESCE(SUM(CASE WHEN status = "won" THEN prize ELSE 0 END), 0) as total_prizes
    FROM bets WHERE user_id = ?
');
$stmtStats->execute([$targetId]);
$stats = $stmtStats->fetch();

$stmtDepStats = $db->prepare('
    SELECT
        COALESCE(SUM(CASE WHEN status = "COMPLETED" THEN amount ELSE 0 END), 0) as total_deposited,
        COUNT(CASE WHEN status = "COMPLETED" THEN 1 END) as completed_deposits
    FROM deposits WHERE user_id = ?
');
$stmtDepStats->execute([$targetId]);
$depStats = $stmtDepStats->fetch();

echo json_encode([
    'user' => $user,
    'bets' => $bets,
    'transactions' => $txs,
    'deposits' => $deposits,
    'stats' => [
        'total_bets' => (int)($stats['total_bets'] ?? 0),
        'won_bets' => (int)($stats['won_bets'] ?? 0),
        'lost_bets' => (int)($stats['lost_bets'] ?? 0),
        'active_bets' => (int)($stats['active_bets'] ?? 0),
        'total_bet_value' => (float)($stats['total_bet_value'] ?? 0),
        'total_prizes' => (float)($stats['total_prizes'] ?? 0),
        'total_deposited' => (float)($depStats['total_deposited'] ?? 0),
        'completed_deposits' => (int)($depStats['completed_deposits'] ?? 0)
    ]
]);
