<?php
/**
 * LotoGrana - Configuração da API de Loterias Externa
 * API: https://apiloterias.com.br/
 */

define('LOTERIAS_API_URL', 'https://apiloterias.com.br/app/v2/resultado');
define('LOTERIAS_API_TOKEN', 'PT8gtyJokGWN0YV');

// Loterias suportadas
define('LOTERIAS_SUPORTADAS', ['megasena', 'lotofacil', 'quina']);

/**
 * Faz requisição à API de Loterias
 * @param string $lottery - ID da loteria
 * @param int|null $contest - Número do concurso (null = último)
 * @param int|null $ultimos - Buscar últimos N resultados
 * @return array|null
 */
function loteriasApiRequest(string $lottery, ?int $contest = null, ?int $ultimos = null): ?array {
    $url = LOTERIAS_API_URL . '?loteria=' . urlencode($lottery) . '&token=' . LOTERIAS_API_TOKEN;

    if ($contest) {
        $url .= '&concurso=' . $contest;
    } elseif ($ultimos) {
        $url .= '&concurso=ultimos' . $ultimos;
    }

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json']);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        error_log("[LoteriasAPI] Erro cURL: $error");
        return null;
    }

    if ($httpCode !== 200) {
        error_log("[LoteriasAPI] HTTP $httpCode para $url");
        return null;
    }

    $data = json_decode($response, true);
    if (!$data) {
        error_log("[LoteriasAPI] Resposta inválida para $url");
        return null;
    }

    if (isset($data['erro'])) {
        error_log("[LoteriasAPI] Erro da API: " . $data['erro']);
        return null;
    }

    return $data;
}

/**
 * Transforma dados brutos da API no formato padronizado do app
 */
function transformLotteryResult(array $apiData): array {
    $numbers = array_map('intval', $apiData['dezenas'] ?? []);

    $mainPrize = 0;
    if (!empty($apiData['premiacao'])) {
        foreach ($apiData['premiacao'] as $p) {
            if (($p['faixa'] ?? 0) === 1) {
                $mainPrize = (float)($p['valor_premio'] ?? 0);
                break;
            }
        }
    }

    if ($mainPrize === 0) {
        $mainPrize = (float)($apiData['valor_acumulado_proximo_concurso'] ??
                             $apiData['valor_estimado_proximo_concurso'] ?? 0);
    }

    $nextDate = $apiData['data_proximo_concurso'] ?? null;
    $nextPrize = (float)($apiData['valor_estimado_proximo_concurso'] ??
                         $apiData['valor_acumulado_proximo_concurso'] ?? 0);

    $premiacao = [];
    foreach ($apiData['premiacao'] ?? [] as $p) {
        $premiacao[] = [
            'faixa' => (int)($p['faixa'] ?? 0),
            'acertos' => $p['quantidade_acertos'] ?? $p['descricao'] ?? '-',
            'ganhadores' => (int)($p['numero_ganhadores'] ?? $p['ganhadores'] ?? 0),
            'premio' => (float)($p['valor_premio'] ?? 0)
        ];
    }

    return [
        'contest' => (int)($apiData['numero_concurso'] ?? $apiData['concurso'] ?? 0),
        'date' => $apiData['data_concurso'] ?? $apiData['data'] ?? '',
        'numbers' => $numbers,
        'prize' => $mainPrize,
        'name' => $apiData['nome'] ?? '',
        'acumulou' => (bool)($apiData['acumulou'] ?? false),
        'premiacao' => $premiacao,
        'next_contest_date' => $nextDate,
        'next_contest_prize' => $nextPrize,
        'raw_data' => $apiData
    ];
}
