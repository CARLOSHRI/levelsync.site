<?php
/**
 * POST /api/notifications/subscribe.php
 * Registra subscription push do usuário autenticado
 * Body: { endpoint, keys: { p256dh, auth } }
 */

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';

setupHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

$payload = requireAuth();
$userId = (int)$payload['user_id'];

$input = json_decode(file_get_contents('php://input'), true);
$endpoint = $input['endpoint'] ?? '';
$keys = $input['keys'] ?? [];
$p256dh = $keys['p256dh'] ?? $keys['p256Dh'] ?? '';
$auth = $keys['auth'] ?? '';
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;

if (empty($endpoint) || empty($p256dh) || empty($auth)) {
    http_response_code(400);
    echo json_encode(['error' => 'endpoint e keys (p256dh, auth) são obrigatórios']);
    exit;
}

try {
    $db = getDB();
    $stmt = $db->prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?');
    $stmt->execute([$userId, $endpoint]);
    $stmt = $db->prepare('INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$userId, $endpoint, $p256dh, $auth, $userAgent]);
    echo json_encode(['ok' => true]);
} catch (Exception $e) {
    http_response_code(503);
    echo json_encode(['error' => 'Serviço temporariamente indisponível. Execute a migration de notificações.']);
}
