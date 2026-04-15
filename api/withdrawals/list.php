<?php
/**
 * GET /api/withdrawals/list.php
 * Lista todos os saques (admin)
 * Query: ?status=pending|approved|rejected (opcional)
 */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';

setupHeaders();
requireAdmin();

$status = $_GET['status'] ?? null;
$db = getDB();

if ($status && in_array($status, ['pending', 'approved', 'rejected'])) {
    $stmt = $db->prepare('SELECT w.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone FROM withdrawals w JOIN users u ON w.user_id = u.id WHERE w.status = ? ORDER BY w.created_at DESC');
    $stmt->execute([$status]);
} else {
    $stmt = $db->query('SELECT w.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone FROM withdrawals w JOIN users u ON w.user_id = u.id ORDER BY w.created_at DESC');
}

$withdrawals = $stmt->fetchAll();

foreach ($withdrawals as &$w) {
    $w['id'] = (int)$w['id'];
    $w['user_id'] = (int)$w['user_id'];
    $w['amount'] = (float)$w['amount'];
}

// Totais
$totals = $db->query("
    SELECT
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as approved_amount,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
    FROM withdrawals
")->fetch();

echo json_encode([
    'withdrawals' => $withdrawals,
    'totals' => [
        'total_count' => (int)($totals['total_count'] ?? 0),
        'pending_count' => (int)($totals['pending_count'] ?? 0),
        'pending_amount' => (float)($totals['pending_amount'] ?? 0),
        'approved_count' => (int)($totals['approved_count'] ?? 0),
        'approved_amount' => (float)($totals['approved_amount'] ?? 0),
        'rejected_count' => (int)($totals['rejected_count'] ?? 0)
    ]
]);
