<?php
/**
 * LotoGrana - API: Resultado de concurso específico
 * 
 * GET /api/results/contest.php?lottery=megasena&contest=2800
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
$contest = (int)($_GET['contest'] ?? 0);

if (empty($lottery) || $contest <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Parâmetros lottery e contest são obrigatórios']);
    exit;
}

try {
    $stmt = $db->prepare('
        SELECT * FROM lottery_results
        WHERE lottery = ? AND contest = ?
        LIMIT 1
    ');
    $stmt->execute([$lottery, $contest]);
    $row = $stmt->fetch();

    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => "Resultado não encontrado para $lottery concurso $contest"]);
        exit;
    }

    echo json_encode(formatResult($row), JSON_UNESCAPED_UNICODE);

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
