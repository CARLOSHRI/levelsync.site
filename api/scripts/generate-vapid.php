<?php
/**
 * Gera chaves VAPID para Web Push
 * Execute: php api/scripts/generate-vapid.php
 */

$vendor = dirname(__DIR__, 2) . '/vendor/autoload.php';
if (!file_exists($vendor)) {
    echo "Execute primeiro: composer install\n";
    exit(1);
}
require $vendor;

$keys = \Minishlink\WebPush\VAPID::createVapidKeys();
$file = dirname(__DIR__) . '/_vapid_keys.json';
file_put_contents($file, json_encode($keys, JSON_PRETTY_PRINT));
echo "Chaves VAPID geradas em: $file\n";
echo "Public: " . substr($keys['publicKey'], 0, 20) . "...\n";
