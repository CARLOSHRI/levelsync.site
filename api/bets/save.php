<?php
/** POST /api/bets/save.php - Salvar apostas (array ou única) */
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/lottery-rules.php';
setupHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método não permitido']);
    exit;
}

$payload = requireAuth();
$userId = (int)$payload['sub'];
$input = json_decode(file_get_contents('php://input'), true);

// Aceita array de apostas ou aposta única
$bets = isset($input['bets']) ? $input['bets'] : [$input];

$db = getDB();

// Usa transação para garantir atomicidade (aposta + débito de saldo)
$db->beginTransaction();

try {
    // Verifica saldo antes de deduzir (FOR UPDATE trava a linha contra race conditions)
    $stmtBal = $db->prepare('SELECT balance FROM users WHERE id = ? FOR UPDATE');
    $stmtBal->execute([$userId]);
    $userRow = $stmtBal->fetch();
    $currentBalance = (float)($userRow['balance'] ?? 0);

    // Calcula valor total das apostas
    $totalValue = 0;
    foreach ($bets as $b) { $totalValue += (float)($b['value'] ?? 0); }

    if ($totalValue > $currentBalance) {
        $db->rollBack();
        http_response_code(400);
        echo json_encode(['error' => 'Saldo insuficiente', 'balance' => $currentBalance, 'required' => $totalValue]);
        exit;
    }

    // Obtém status das apostas (horário de corte)
    $bettingStatus = getBettingStatus();
    $canBetForToday = $bettingStatus['can_bet_for_today'];

    $stmtBet = $db->prepare('INSERT INTO bets (user_id, lottery_id, lottery_name, numbers, value, status, date, contest) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmtBalance = $db->prepare('UPDATE users SET balance = balance - ? WHERE id = ?');

    // Query para buscar último concurso conhecido de cada loteria
    $stmtLastContest = $db->prepare('SELECT MAX(contest) as last_contest FROM lottery_results WHERE lottery = ?');

    $ids = [];
    $totalDeducted = 0;
    $contestAdjustments = [];

    foreach ($bets as $bet) {
        $value = (float)($bet['value'] ?? 0);
        $lotteryId = $bet['lotteryId'] ?? $bet['lottery_id'] ?? '';
        $lotteryName = $bet['lotteryName'] ?? $bet['lottery_name'] ?? '';
        $clientContest = $bet['contest'] ?? null;

        // Busca o último concurso conhecido no banco
        $stmtLastContest->execute([$lotteryId]);
        $lastContestRow = $stmtLastContest->fetch();
        $lastKnownContest = (int)($lastContestRow['last_contest'] ?? 0);

        // Se não temos dados no banco, usa o concurso enviado pelo cliente
        if ($lastKnownContest === 0 && $clientContest) {
            $lastKnownContest = (int)$clientContest - 1;
        }

        // Determina o concurso correto baseado no horário de Brasília
        $contestInfo = determineContestForBet($lotteryId, $lastKnownContest);
        $finalContest = $contestInfo['contest'];
        $drawDate = $contestInfo['draw_date'];

        // Se o cliente enviou um concurso e passou do horário de corte,
        // verifica se precisa ajustar
        if ($clientContest && !$canBetForToday) {
            // Se o concurso do cliente é o mesmo que seria para hoje (que já fechou),
            // ajusta para o próximo
            if ((int)$clientContest <= $lastKnownContest + 1) {
                $finalContest = $contestInfo['contest'];
                $contestAdjustments[] = [
                    'lottery' => $lotteryName,
                    'original_contest' => $clientContest,
                    'adjusted_contest' => $finalContest,
                    'reason' => $contestInfo['message']
                ];
            }
        }

        $stmtBet->execute([
            $userId,
            $lotteryId,
            $lotteryName,
            json_encode($bet['numbers'] ?? []),
            $value,
            $bet['status'] ?? 'active',
            $bet['date'] ?? date('d/m/Y'),
            $finalContest
        ]);
        $ids[] = (int)$db->lastInsertId();
        $totalDeducted += $value;
    }

    // Deduz o saldo total do usuário no banco
    if ($totalDeducted > 0) {
        $stmtBalance->execute([$totalDeducted, $userId]);
    }

    $db->commit();

    $response = [
        'success' => true, 
        'ids' => $ids,
        'betting_status' => $bettingStatus
    ];

    // Se houve ajustes de concurso, informa ao cliente
    if (!empty($contestAdjustments)) {
        $response['contest_adjustments'] = $contestAdjustments;
        $response['notice'] = 'Algumas apostas foram registradas para o próximo concurso devido ao horário de corte (20:50).';
    }

    echo json_encode($response);
} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Erro ao salvar apostas: ' . $e->getMessage()]);
}
