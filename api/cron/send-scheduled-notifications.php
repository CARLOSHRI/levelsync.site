<?php
/**
 * Cron: Envia notificações agendadas
 * Execute a cada minuto: * * * * * php /path/to/api/cron/send-scheduled-notifications.php
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/lottery-rules.php';
require_once __DIR__ . '/../notifications/send-push-helper.php';

$db = getDB();
$now = getBrasiliaTime();
$nowStr = $now->format('Y-m-d H:i:s');
$today = $now->format('Y-m-d');
$currentDay = (int)$now->format('w'); // 0=dom, 1=seg, ...
$currentHour = (int)$now->format('H');
$currentMinute = (int)$now->format('i');
$currentTimeMinutes = $currentHour * 60 + $currentMinute;

// 1. Agendamentos únicos com scheduled_at <= now
$stmt = $db->prepare('SELECT id, title, body FROM notification_schedules WHERE status = ? AND recurrence = ? AND scheduled_at IS NOT NULL AND scheduled_at <= ?');
$stmt->execute(['pending', 'none', $nowStr]);
$oneTime = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($oneTime as $sched) {
    try {
        $sent = sendPushToAll($sched['title'], $sched['body']);
        $db->prepare('UPDATE notification_schedules SET status = ?, sent_at = ? WHERE id = ?')->execute(['sent', $nowStr, $sched['id']]);
    } catch (Exception $e) {
        // Log erro
    }
}

// 2. Recorrentes: draw_days - verifica se hoje é dia de sorteio e hora passou
$stmt = $db->query("SELECT id, title, body, lottery_id, recurrence_hour, recurrence_minute FROM notification_schedules WHERE status = 'pending' AND recurrence = 'draw_days' AND lottery_id IS NOT NULL");
$recurring = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($recurring as $sched) {
    $lotteryId = $sched['lottery_id'];
    $drawDays = getDrawDays($lotteryId);
    
    if (!in_array($currentDay, $drawDays)) {
        continue;
    }
    
    $targetHour = (int)($sched['recurrence_hour'] ?? 21);
    $targetMinute = (int)($sched['recurrence_minute'] ?? 5);
    $targetTimeMinutes = $targetHour * 60 + $targetMinute;
    
    if ($currentTimeMinutes < $targetTimeMinutes) {
        continue;
    }
    
    // Já enviou hoje?
    $checkStmt = $db->prepare('SELECT id FROM notification_sent_log WHERE schedule_id = ? AND sent_date = ?');
    $checkStmt->execute([$sched['id'], $today]);
    if ($checkStmt->fetch()) {
        continue;
    }
    
    try {
        $sent = sendPushToAll($sched['title'], $sched['body']);
        $db->prepare('INSERT INTO notification_sent_log (schedule_id, sent_date) VALUES (?, ?)')->execute([$sched['id'], $today]);
    } catch (Exception $e) {
        // Log erro
    }
}

// 3. Recorrentes: daily - envia todo dia na hora configurada
$stmt = $db->query("SELECT id, title, body, recurrence_hour, recurrence_minute FROM notification_schedules WHERE status = 'pending' AND recurrence = 'daily'");
$daily = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($daily as $sched) {
    $targetHour = (int)($sched['recurrence_hour'] ?? 21);
    $targetMinute = (int)($sched['recurrence_minute'] ?? 5);
    $targetTimeMinutes = $targetHour * 60 + $targetMinute;
    
    if ($currentTimeMinutes < $targetTimeMinutes) {
        continue;
    }
    
    $checkStmt = $db->prepare('SELECT id FROM notification_sent_log WHERE schedule_id = ? AND sent_date = ?');
    $checkStmt->execute([$sched['id'], $today]);
    if ($checkStmt->fetch()) {
        continue;
    }
    
    try {
        sendPushToAll($sched['title'], $sched['body']);
        $db->prepare('INSERT INTO notification_sent_log (schedule_id, sent_date) VALUES (?, ?)')->execute([$sched['id'], $today]);
    } catch (Exception $e) {
        // Log erro
    }
}
