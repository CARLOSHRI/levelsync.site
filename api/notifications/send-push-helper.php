<?php
/**
 * Helper para enviar push notifications
 * Usado por send.php e cron
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/vapid.php';

function sendPushToAll(string $title, string $body): int {
    $db = getDB();
    $stmt = $db->query('SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth FROM push_subscriptions ps');
    $subscriptions = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($subscriptions)) {
        return 0;
    }
    
    $vendor = dirname(__DIR__, 2) . '/vendor/autoload.php';
    if (!file_exists($vendor)) {
        throw new RuntimeException('Composer dependencies não instaladas. Execute: composer install');
    }
    require_once $vendor;
    
    $keys = getVapidKeys();
    if (empty($keys['publicKey']) || empty($keys['privateKey'])) {
        throw new RuntimeException('Chaves VAPID não configuradas. Execute: php api/scripts/generate-vapid.php');
    }
    
    $auth = [
        'VAPID' => [
            'subject' => 'mailto:admin@lotograna.com',
            'publicKey' => $keys['publicKey'],
            'privateKey' => $keys['privateKey']
        ]
    ];
    
    $webPush = new \Minishlink\WebPush\WebPush($auth);
    
    $payload = json_encode([
        'title' => $title,
        'body' => $body,
        'icon' => '/assets/icon.png',
        'tag' => 'lotograna-' . time()
    ]);
    
    $sent = 0;
    foreach ($subscriptions as $sub) {
        try {
            $subscription = \Minishlink\WebPush\Subscription::create([
                'endpoint' => $sub['endpoint'],
                'keys' => [
                    'p256dh' => $sub['p256dh'],
                    'auth' => $sub['auth']
                ]
            ]);
            $result = $webPush->sendOneNotification($subscription, $payload);
            if ($result->isSuccess()) {
                $sent++;
            } else {
                // Subscription expirada - remove
                if ($result->isSubscriptionExpired()) {
                    $del = $db->prepare('DELETE FROM push_subscriptions WHERE id = ?');
                    $del->execute([$sub['id']]);
                }
            }
        } catch (Exception $e) {
            // Log e continua
        }
    }
    
    return $sent;
}
