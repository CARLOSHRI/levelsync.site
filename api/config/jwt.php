<?php
/**
 * LotoGrana - JWT (JSON Web Token) sem biblioteca externa
 * HMAC-SHA256
 */

// Carrega .env se existir
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos($line, '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            [$key, $val] = explode('=', $line, 2);
            $_ENV[trim($key)] = trim($val);
            putenv(trim($key) . '=' . trim($val));
        }
    }
}

define('JWT_SECRET', getenv('JWT_SECRET') ?: ($_ENV['JWT_SECRET'] ?? 'lotograna_dev_fallback_key'));
define('JWT_EXPIRY', 60 * 60 * 24 * 7); // 7 dias

function base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/'));
}

/**
 * Gera um token JWT
 */
function generateToken(int $userId, string $role = 'user'): string {
    $header = base64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    
    $payload = base64url_encode(json_encode([
        'sub'  => $userId,
        'role' => $role,
        'iat'  => time(),
        'exp'  => time() + JWT_EXPIRY
    ]));
    
    $signature = base64url_encode(
        hash_hmac('sha256', "$header.$payload", JWT_SECRET, true)
    );
    
    return "$header.$payload.$signature";
}

/**
 * Valida e decodifica um token JWT
 * Retorna o payload ou null se inválido
 */
function validateToken(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    
    [$header, $payload, $signature] = $parts;
    
    // Verifica assinatura
    $expectedSig = base64url_encode(
        hash_hmac('sha256', "$header.$payload", JWT_SECRET, true)
    );
    
    if (!hash_equals($expectedSig, $signature)) return null;
    
    // Decodifica payload
    $data = json_decode(base64url_decode($payload), true);
    if (!$data) return null;
    
    // Verifica expiração
    if (isset($data['exp']) && $data['exp'] < time()) return null;
    
    return $data;
}
