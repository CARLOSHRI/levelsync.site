<?php
/**
 * LotoGrana - Middleware de Autenticação
 * Verifica JWT no header Authorization
 */

require_once __DIR__ . '/../config/jwt.php';

/**
 * Verifica autenticação e retorna dados do usuário do token.
 * Encerra a request com 401 se inválido.
 */
function requireAuth(): array {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    
    if (empty($header) && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    
    if (empty($header) || !preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
        http_response_code(401);
        echo json_encode(['error' => 'Token não fornecido']);
        exit;
    }
    
    $payload = validateToken($matches[1]);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Token inválido ou expirado']);
        exit;
    }
    
    return $payload;
}

/**
 * Verifica se o usuário é admin
 */
function requireAdmin(): array {
    $payload = requireAuth();
    if (($payload['role'] ?? '') !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Acesso negado. Permissão de admin necessária.']);
        exit;
    }
    return $payload;
}

/**
 * Headers CORS e JSON padrão
 */
function setupHeaders(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}
