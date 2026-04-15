<?php
/**
 * LotoGrana - Configuração VAPID para Web Push
 * Execute: php api/scripts/generate-vapid.php (após composer install)
 */

$vapidFile = __DIR__ . '/../_vapid_keys.json';

function getVapidKeys(): array {
    global $vapidFile;
    
    if (file_exists($vapidFile)) {
        $keys = json_decode(file_get_contents($vapidFile), true);
        if (!empty($keys['publicKey'] ?? '') && !empty($keys['privateKey'] ?? '')) {
            return $keys;
        }
    }
    
    // Tenta gerar via minishlink (requer composer install)
    $vendorAutoload = __DIR__ . '/../../vendor/autoload.php';
    if (file_exists($vendorAutoload)) {
        require_once $vendorAutoload;
        $keys = \Minishlink\WebPush\VAPID::createVapidKeys();
        @file_put_contents($vapidFile, json_encode($keys));
        return $keys;
    }
    
    return ['publicKey' => '', 'privateKey' => ''];
}
