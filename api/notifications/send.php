<?php
/**
 * POST /api/notifications/send.php (admin)
 * Envia notificação imediata ou agenda
 * Body: { title, body, sendNow?: bool, scheduledAt?: "YYYY-MM-DD HH:mm", recurrence?: "none"|"daily"|"draw_days", lotteryId?: string, recurrenceHour?: int, recurrenceMinute?: int }
 */

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';

setupHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

$payload = requireAdmin();
$adminId = (int)$payload['user_id'];

$input = json_decode(file_get_contents('php://input'), true);
$title = trim($input['title'] ?? '');
$body = trim($input['body'] ?? '');
$sendNow = !empty($input['sendNow']);
$scheduledAt = $input['scheduledAt'] ?? null;
$recurrence = $input['recurrence'] ?? 'none';
$lotteryId = $input['lotteryId'] ?? null;
$recurrenceHour = isset($input['recurrenceHour']) ? (int)$input['recurrenceHour'] : 21;
$recurrenceMinute = isset($input['recurrenceMinute']) ? (int)$input['recurrenceMinute'] : 5;

if (empty($title) || empty($body)) {
    http_response_code(400);
    echo json_encode(['error' => 'Título e corpo são obrigatórios']);
    exit;
}

$db = getDB();

if ($sendNow) {
    // Enviar imediatamente
    require_once __DIR__ . '/send-push-helper.php';
    $sent = sendPushToAll($title, $body);
    echo json_encode(['ok' => true, 'sent' => $sent]);
    exit;
}

// Agendar
$scheduleStmt = $db->prepare('SELECT id FROM notification_schedules WHERE status = ? AND recurrence = ? AND lottery_id = ?');
$scheduleStmt->execute(['pending', 'draw_days', $lotteryId]);
$existing = $scheduleStmt->fetch();

if ($recurrence === 'draw_days' && $existing) {
    http_response_code(400);
    echo json_encode(['error' => 'Já existe agendamento recorrente para esta loteria']);
    exit;
}

$stmt = $db->prepare('INSERT INTO notification_schedules (title, body, scheduled_at, recurrence, lottery_id, recurrence_hour, recurrence_minute, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
$scheduledAtVal = $scheduledAt ?: null;
$stmt->execute([$title, $body, $scheduledAtVal, $recurrence, $lotteryId, $recurrenceHour, $recurrenceMinute, 'pending', $adminId]);

echo json_encode(['ok' => true, 'id' => (int)$db->lastInsertId()]);
