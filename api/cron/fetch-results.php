<?php
/**
 * LotoGrana - Cron: Buscar resultados de loterias da API externa
 * 
 * Uso via crontab (a cada 10 minutos):
 *   *\/10 * * * * php /caminho/para/api/cron/fetch-results.php
 * 
 * Uso via URL com token secreto:
 *   GET /api/cron/fetch-results.php?token=SEU_TOKEN_SECRETO
 */

// Token de segurança para execução via URL
define('CRON_SECRET_TOKEN', 'lotograna_cron_2024_secret');

// Se executado via web, verifica token
if (php_sapi_name() !== 'cli') {
    header('Content-Type: application/json; charset=utf-8');

    $token = $_GET['token'] ?? '';
    if ($token !== CRON_SECRET_TOKEN) {
        http_response_code(403);
        echo json_encode(['error' => 'Token inválido']);
        exit;
    }
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/loterias-api.php';

$db = getDB();
$log = [];

/**
 * Insere ou atualiza um resultado no banco
 */
function upsertResult(PDO $db, string $lottery, array $transformed): bool {
    $contest = $transformed['contest'];
    if (!$contest) return false;

    // Verifica se já existe
    $stmt = $db->prepare('SELECT id FROM lottery_results WHERE lottery = ? AND contest = ?');
    $stmt->execute([$lottery, $contest]);

    if ($stmt->fetch()) {
        // Já existe - atualiza (pode ter dados novos como next_contest)
        $stmt = $db->prepare('
            UPDATE lottery_results SET
                date = ?,
                numbers = ?,
                prize = ?,
                acumulou = ?,
                premiacao = ?,
                next_contest_date = ?,
                next_contest_prize = ?,
                raw_data = ?
            WHERE lottery = ? AND contest = ?
        ');
        $stmt->execute([
            $transformed['date'],
            json_encode($transformed['numbers']),
            $transformed['prize'],
            $transformed['acumulou'] ? 1 : 0,
            json_encode($transformed['premiacao']),
            $transformed['next_contest_date'],
            $transformed['next_contest_prize'],
            json_encode($transformed['raw_data']),
            $lottery,
            $contest
        ]);
        return false; // Não é novo
    }

    // Insere novo
    $stmt = $db->prepare('
        INSERT INTO lottery_results (lottery, contest, date, numbers, prize, acumulou, premiacao, next_contest_date, next_contest_prize, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
        $lottery,
        $contest,
        $transformed['date'],
        json_encode($transformed['numbers']),
        $transformed['prize'],
        $transformed['acumulou'] ? 1 : 0,
        json_encode($transformed['premiacao']),
        $transformed['next_contest_date'],
        $transformed['next_contest_prize'],
        json_encode($transformed['raw_data'])
    ]);
    return true; // É novo
}

// ==================== PROCESSO PRINCIPAL ====================

$totalNew = 0;
$totalUpdated = 0;
$errors = [];

foreach (LOTERIAS_SUPORTADAS as $lottery) {
    $log[] = "Processando: $lottery";

    // 1. Busca o último resultado
    $data = loteriasApiRequest($lottery);
    if ($data) {
        $transformed = transformLotteryResult($data);
        $isNew = upsertResult($db, $lottery, $transformed);
        if ($isNew) {
            $totalNew++;
            $log[] = "  [NOVO] Concurso {$transformed['contest']} de $lottery";
        } else {
            $totalUpdated++;
            $log[] = "  [ATUALIZADO] Concurso {$transformed['contest']} de $lottery";
        }
    } else {
        $errors[] = "Falha ao buscar último resultado de $lottery";
        $log[] = "  [ERRO] Falha ao buscar último resultado";
    }

    // 2. Busca últimos 5 resultados para popular histórico
    sleep(1); // Rate limit
    $dataHistory = loteriasApiRequest($lottery, null, 5);
    if ($dataHistory) {
        $items = is_array($dataHistory) && isset($dataHistory[0]) ? $dataHistory : [$dataHistory];
        foreach ($items as $item) {
            $transformed = transformLotteryResult($item);
            if ($transformed['contest']) {
                $isNew = upsertResult($db, $lottery, $transformed);
                if ($isNew) {
                    $totalNew++;
                    $log[] = "  [NOVO] Histórico concurso {$transformed['contest']}";
                }
            }
        }
    } else {
        $log[] = "  [AVISO] Falha ao buscar histórico";
    }

    sleep(1); // Rate limit entre loterias
}

// ==================== RESULTADO ====================

$summary = [
    'success' => true,
    'timestamp' => date('Y-m-d H:i:s'),
    'new_results' => $totalNew,
    'updated_results' => $totalUpdated,
    'errors' => $errors,
    'log' => $log
];

if (php_sapi_name() === 'cli') {
    echo "\n=== LotoGrana Cron - Fetch Results ===\n";
    echo "Hora: " . $summary['timestamp'] . "\n";
    echo "Novos: $totalNew | Atualizados: $totalUpdated\n";
    if (!empty($errors)) {
        echo "Erros: " . implode(', ', $errors) . "\n";
    }
    foreach ($log as $line) {
        echo "$line\n";
    }
    echo "=====================================\n";
} else {
    echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
