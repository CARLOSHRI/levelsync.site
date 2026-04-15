<?php
/**
 * LotoGrana - Regras de Loterias
 * Configurações de horários de corte e validação de apostas
 */

// Timezone oficial do Brasil (Brasília)
define('BRAZIL_TIMEZONE', 'America/Sao_Paulo');

// Horário de corte para apostas (20:50 - 10 minutos antes do sorteio das 21:00)
define('CUTOFF_HOUR', 20);
define('CUTOFF_MINUTE', 50);

// Horário do sorteio
define('DRAW_HOUR', 21);
define('DRAW_MINUTE', 0);

/**
 * Obtém a data/hora atual no fuso horário de Brasília
 * @return DateTime
 */
function getBrasiliaTime(): DateTime {
    return new DateTime('now', new DateTimeZone(BRAZIL_TIMEZONE));
}

/**
 * Verifica se as apostas estão abertas para o sorteio de hoje
 * @return bool true se ainda pode apostar para hoje, false se passou do horário de corte
 */
function canBetForToday(): bool {
    $now = getBrasiliaTime();
    $currentHour = (int)$now->format('H');
    $currentMinute = (int)$now->format('i');
    
    // Se passou das 20:50, não pode mais apostar para hoje
    if ($currentHour > CUTOFF_HOUR) {
        return false;
    }
    if ($currentHour === CUTOFF_HOUR && $currentMinute >= CUTOFF_MINUTE) {
        return false;
    }
    
    return true;
}

/**
 * Obtém informações sobre o status das apostas
 * @return array
 */
function getBettingStatus(): array {
    $now = getBrasiliaTime();
    $canBetToday = canBetForToday();
    
    $cutoffTime = clone $now;
    $cutoffTime->setTime(CUTOFF_HOUR, CUTOFF_MINUTE, 0);
    
    $drawTime = clone $now;
    $drawTime->setTime(DRAW_HOUR, DRAW_MINUTE, 0);
    
    return [
        'current_time' => $now->format('Y-m-d H:i:s'),
        'timezone' => BRAZIL_TIMEZONE,
        'can_bet_for_today' => $canBetToday,
        'cutoff_time' => $cutoffTime->format('H:i'),
        'draw_time' => $drawTime->format('H:i'),
        'message' => $canBetToday 
            ? 'Apostas abertas para o sorteio de hoje' 
            : 'Apostas agora valem para o próximo sorteio'
    ];
}

/**
 * Dias de sorteio por loteria
 * 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
 */
function getDrawDays(string $lotteryId): array {
    $drawDays = [
        'megasena' => [2, 4, 6],      // Terça, Quinta, Sábado
        'lotofacil' => [1, 2, 3, 4, 5, 6], // Segunda a Sábado
        'quina' => [1, 2, 3, 4, 5, 6] // Segunda a Sábado
    ];
    
    return $drawDays[$lotteryId] ?? [1, 2, 3, 4, 5, 6];
}

/**
 * Calcula a data do próximo sorteio para uma loteria
 * @param string $lotteryId ID da loteria
 * @param bool $forceNext Se true, sempre retorna o próximo sorteio (não o de hoje)
 * @return DateTime
 */
function getNextDrawDate(string $lotteryId, bool $forceNext = false): DateTime {
    $now = getBrasiliaTime();
    $drawDays = getDrawDays($lotteryId);
    $canBetToday = canBetForToday();
    
    $currentDayOfWeek = (int)$now->format('w');
    
    // Se pode apostar para hoje E hoje é dia de sorteio E não está forçando próximo
    if ($canBetToday && !$forceNext && in_array($currentDayOfWeek, $drawDays)) {
        $drawDate = clone $now;
        $drawDate->setTime(DRAW_HOUR, DRAW_MINUTE, 0);
        return $drawDate;
    }
    
    // Procura o próximo dia de sorteio
    $checkDate = clone $now;
    
    // Se passou do horário de corte hoje, começa a busca a partir de amanhã
    if (!$canBetToday || $forceNext) {
        $checkDate->modify('+1 day');
    } else {
        // Se ainda pode apostar mas hoje não é dia de sorteio, começa de amanhã
        if (!in_array($currentDayOfWeek, $drawDays)) {
            $checkDate->modify('+1 day');
        }
    }
    
    // Procura nos próximos 7 dias
    for ($i = 0; $i < 7; $i++) {
        $dayOfWeek = (int)$checkDate->format('w');
        if (in_array($dayOfWeek, $drawDays)) {
            $checkDate->setTime(DRAW_HOUR, DRAW_MINUTE, 0);
            return $checkDate;
        }
        $checkDate->modify('+1 day');
    }
    
    // Fallback: retorna amanhã
    $tomorrow = clone $now;
    $tomorrow->modify('+1 day');
    $tomorrow->setTime(DRAW_HOUR, DRAW_MINUTE, 0);
    return $tomorrow;
}

/**
 * Determina o número do concurso para uma aposta baseado no horário atual
 * @param string $lotteryId ID da loteria
 * @param int $lastKnownContest Último concurso conhecido
 * @param string|null $lastKnownDate Data do último concurso (dd/mm/yyyy)
 * @return array ['contest' => int, 'draw_date' => string, 'is_next' => bool]
 */
function determineContestForBet(string $lotteryId, int $lastKnownContest, ?string $lastKnownDate = null): array {
    $canBetToday = canBetForToday();
    $now = getBrasiliaTime();
    $drawDays = getDrawDays($lotteryId);
    $currentDayOfWeek = (int)$now->format('w');
    $isTodayDrawDay = in_array($currentDayOfWeek, $drawDays);
    
    // Próximo concurso = último + 1
    $nextContest = $lastKnownContest + 1;
    
    // Se pode apostar para hoje E hoje é dia de sorteio
    if ($canBetToday && $isTodayDrawDay) {
        $drawDate = $now->format('d/m/Y');
        return [
            'contest' => $nextContest,
            'draw_date' => $drawDate,
            'is_next' => false,
            'message' => 'Aposta registrada para o sorteio de hoje'
        ];
    }
    
    // Caso contrário, aposta vai para o próximo sorteio disponível
    $nextDrawDate = getNextDrawDate($lotteryId, true);
    
    // Se hoje é dia de sorteio mas passou do horário, o próximo concurso é +2
    // (porque o +1 é o de hoje que já fechou)
    if (!$canBetToday && $isTodayDrawDay) {
        // Conta quantos dias de sorteio existem entre hoje e a próxima data
        $daysUntilNext = (int)$now->diff($nextDrawDate)->days;
        if ($daysUntilNext > 0) {
            // O concurso de hoje (que fechou) é lastKnownContest + 1
            // O próximo disponível é lastKnownContest + 2
            $nextContest = $lastKnownContest + 2;
        }
    }
    
    return [
        'contest' => $nextContest,
        'draw_date' => $nextDrawDate->format('d/m/Y'),
        'is_next' => true,
        'message' => 'Aposta registrada para o próximo sorteio'
    ];
}
