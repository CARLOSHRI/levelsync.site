<?php
/**
 * LotoGrana - API: Últimos resultados de loterias
 * 
 * GET /api/results/latest.php                   → último resultado de TODAS as loterias
 * GET /api/results/latest.php?lottery=megasena   → último resultado da Mega-Sena
 * GET /api/results/latest.php?lottery=megasena&count=5 → últimos 5 resultados da Mega-Sena
 * 
 * Endpoint público (não requer autenticação)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

require_once __DIR__ . '/../config/database.php';

$db = getDB();

$lottery = trim($_GET['lottery'] ?? '');
$count = (int)($_GET['count'] ?? 1);
if ($count < 1) $count = 1;
if ($count > 50) $count = 50;

try {
    if (!empty($lottery)) {
        // Resultados de uma loteria específica
        $stmt = $db->prepare('
            SELECT * FROM lottery_results
            WHERE lottery = ?
            ORDER BY contest DESC
            LIMIT ?
        ');
        $stmt->execute([$lottery, $count]);
        $rows = $stmt->fetchAll();

        if (empty($rows)) {
            http_response_code(404);
            echo json_encode(['error' => 'Nenhum resultado encontrado para ' . $lottery]);
            exit;
        }

        $results = array_map('formatResult', $rows);

        if ($count === 1) {
            echo json_encode($results[0], JSON_UNESCAPED_UNICODE);
        } else {
            echo json_encode($results, JSON_UNESCAPED_UNICODE);
        }
    } else {
        // Último resultado de TODAS as loterias
        $stmt = $db->query('
            SELECT lr.* FROM lottery_results lr
            INNER JOIN (
                SELECT lottery, MAX(contest) as max_contest
                FROM lottery_results
                GROUP BY lottery
            ) latest ON lr.lottery = latest.lottery AND lr.contest = latest.max_contest
            ORDER BY lr.lottery
        ');
        $rows = $stmt->fetchAll();

        $results = [];
        foreach ($rows as $row) {
            $results[$row['lottery']] = formatResult($row);
        }

        echo json_encode($results, JSON_UNESCAPED_UNICODE);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erro interno: ' . $e->getMessage()]);
}

/**
 * Formata um registro do banco para a resposta JSON
 */
function formatResult(array $row): array {
    return [
        'lottery' => $row['lottery'],
        'contest' => (int)$row['contest'],
        'date' => $row['date'],
        'numbers' => json_decode($row['numbers'], true) ?: [],
        'prize' => (float)$row['prize'],
        'acumulou' => (bool)$row['acumulou'],
        'premiacao' => json_decode($row['premiacao'], true) ?: [],
        'next_contest_date' => $row['next_contest_date'],
        'next_contest_prize' => $row['next_contest_prize'] !== null ? (float)$row['next_contest_prize'] : null,
    ];
}
