<?php
/**
 * LotoGrana - Configuração Duttyfy PIX
 * Troque pela sua chave encriptada real
 */



define('DUTTYFY_API_KEY', 'W7uBES8OMV0Gm8mLh1b9pL_KCiRZeI3czRpZP5CyQdsWAReS_adM6J4QLaTsaB4mpv_1OeCP9meNBWVoZewP9w');
define('DUTTYFY_BASE_URL', 'https://www.pagamentos-seguros.app/api-pix/');

/**
 * Faz uma requisição à API da Duttyfy
 */
function duttyfyRequest(string $method, string $endpoint, ?array $body = null): array {
    $url = DUTTYFY_BASE_URL . DUTTYFY_API_KEY;
    if ($endpoint) {
        $url .= $endpoint;
    }

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

    if ($method === 'POST' && $body) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        return ['error' => 'Erro de conexão: ' . $error];
    }

    $data = json_decode($response, true);
    if (!$data) {
        return ['error' => 'Resposta inválida da Duttyfy'];
    }

    return $data;
}
