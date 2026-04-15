<?php
/**
 * GET /api/notifications/vapid-public.php
 * Retorna a chave pública VAPID (público, não requer auth)
 */

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/vapid.php';

setupHeaders();

$keys = getVapidKeys();
if (empty($keys['publicKey'])) {
    http_response_code(503);
    echo json_encode(['error' => 'Push notifications não configuradas. Execute: composer install && php api/scripts/generate-vapid.php']);
    exit;
}

echo json_encode(['publicKey' => $keys['publicKey']]);
