<?php
/** GET /api/bets/status.php - Retorna status das apostas (horário de corte) */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/lottery-rules.php';
setupHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

// Este endpoint não requer autenticação para permitir verificação pública
$status = getBettingStatus();

// Adiciona informações extras úteis para o frontend
$now = getBrasiliaTime();
$status['server_time'] = $now->format('Y-m-d H:i:s');
$status['server_timestamp'] = $now->getTimestamp();

// Calcula tempo restante até o horário de corte (se ainda estiver aberto)
if ($status['can_bet_for_today']) {
    $cutoffToday = clone $now;
    $cutoffToday->setTime(CUTOFF_HOUR, CUTOFF_MINUTE, 0);
    $diff = $now->diff($cutoffToday);
    $status['time_until_cutoff'] = [
        'hours' => (int)$diff->h,
        'minutes' => (int)$diff->i,
        'seconds' => (int)$diff->s,
        'total_seconds' => ($diff->h * 3600) + ($diff->i * 60) + $diff->s
    ];
} else {
    $status['time_until_cutoff'] = null;
}

echo json_encode($status);
