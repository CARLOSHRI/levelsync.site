<?php
/**
 * GET /api/deposits/list.php - Lista todos os depósitos (admin)
 * Query params opcionais: status (PENDING, COMPLETED, EXPIRED, CANCELLED)
 */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';

setupHeaders();
requireAdmin();

$db = getDB();

$statusFilter = trim($_GET['status'] ?? '');
$validStatuses = ['PENDING', 'COMPLETED', 'EXPIRED', 'CANCELLED'];

if ($statusFilter && in_array($statusFilter, $validStatuses)) {
    $stmt = $db->prepare('
        SELECT d.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
        FROM deposits d
        JOIN users u ON d.user_id = u.id
        WHERE d.status = ?
        ORDER BY d.created_at DESC
        LIMIT 500
    ');
    $stmt->execute([$statusFilter]);
} else {
    $stmt = $db->query('
        SELECT d.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
        FROM deposits d
        JOIN users u ON d.user_id = u.id
        ORDER BY d.created_at DESC
        LIMIT 500
    ');
}

$deposits = $stmt->fetchAll();

$totalAll = 0;
$totalCompleted = 0;
$totalPending = 0;

foreach ($deposits as &$d) {
    $d['id'] = (int)$d['id'];
    $d['user_id'] = (int)$d['user_id'];
    $d['amount'] = (float)$d['amount'];
    $d['credited'] = (bool)$d['credited'];
    $totalAll += $d['amount'];
    if ($d['status'] === 'COMPLETED') $totalCompleted += $d['amount'];
    if ($d['status'] === 'PENDING') $totalPending += $d['amount'];
}

// Totais gerais (independente do filtro)
$stmtTotals = $db->query('
    SELECT 
        COUNT(*) as total_count,
        SUM(amount) as total_amount,
        SUM(CASE WHEN status = "COMPLETED" THEN amount ELSE 0 END) as completed_amount,
        SUM(CASE WHEN status = "COMPLETED" THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN status = "PENDING" THEN amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN status = "PENDING" THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = "EXPIRED" THEN 1 ELSE 0 END) as expired_count,
        SUM(CASE WHEN status = "CANCELLED" THEN 1 ELSE 0 END) as cancelled_count
    FROM deposits
');
$totals = $stmtTotals->fetch();

echo json_encode([
    'deposits' => $deposits,
    'totals' => [
        'total_count' => (int)($totals['total_count'] ?? 0),
        'total_amount' => (float)($totals['total_amount'] ?? 0),
        'completed_amount' => (float)($totals['completed_amount'] ?? 0),
        'completed_count' => (int)($totals['completed_count'] ?? 0),
        'pending_amount' => (float)($totals['pending_amount'] ?? 0),
        'pending_count' => (int)($totals['pending_count'] ?? 0),
        'expired_count' => (int)($totals['expired_count'] ?? 0),
        'cancelled_count' => (int)($totals['cancelled_count'] ?? 0)
    ]
]);
