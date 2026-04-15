<?php
/**
 * GET /api/notifications/schedules.php (admin) - Lista agendamentos
 * DELETE /api/notifications/schedules.php?id=X (admin) - Cancela agendamento
 */

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';

setupHeaders();

$payload = requireAdmin();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $db = getDB();
        $stmt = $db->query('SELECT id, title, body, scheduled_at, recurrence, lottery_id, recurrence_hour, recurrence_minute, status, created_at FROM notification_schedules ORDER BY created_at DESC');
        $schedules = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $subCount = 0;
        try {
            $countStmt = $db->query('SELECT COUNT(DISTINCT user_id) as total FROM push_subscriptions');
            $subCount = (int)($countStmt->fetch()['total'] ?? 0);
        } catch (Exception $e) { /* tabela pode não existir */ }
    
        echo json_encode([
            'schedules' => $schedules,
            'pushSubscribersCount' => $subCount
        ]);
    } catch (Exception $e) {
        echo json_encode(['schedules' => [], 'pushSubscribersCount' => 0]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'ID inválido']);
        exit;
    }
    
    $db = getDB();
    $stmt = $db->prepare('UPDATE notification_schedules SET status = ? WHERE id = ?');
    $stmt->execute(['cancelled', $id]);
    
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método não permitido']);
