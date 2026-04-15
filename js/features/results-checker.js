/**
 * Results Checker Module - Verificação de resultados de apostas
 * @module features/results-checker
 */

import { state, officialResults, resultsLoadingState } from '../core/state.js';
import { prizeRules, lotteries, defaultPrizes, CUTOFF_HOUR, CUTOFF_MINUTE } from '../core/config.js';
import { Utils } from '../utils/utils.js';
import { LoteriasAPI } from '../utils/api.js';
import { apiUpdateBetResult } from '../api-client.js';

// ==================== COUNTDOWN TIMERS ====================
let countdownInterval = null;
const drawTargetTimes = {}; // { lotofacil: Date, megasena: Date, quina: Date }

const DAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

/**
 * Verifica se as apostas estão abertas para o sorteio de hoje
 * @returns {boolean}
 */
function canBetForToday() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    if (currentHour > CUTOFF_HOUR) return false;
    if (currentHour === CUTOFF_HOUR && currentMinute >= CUTOFF_MINUTE) return false;
    
    return true;
}

/**
 * Parseia data no formato brasileiro dd/mm/yyyy
 */
function parseDateBR(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Formata a data do sorteio: Hoje/Amanhã/Dia da semana + "às 21h"
 * Também indica o horário de corte das apostas
 */
function formatDrawDateLabel(dateStr) {
    const drawDate = parseDateBR(dateStr);
    if (!drawDate) return 'Em breve';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const drawDay = new Date(drawDate);
    drawDay.setHours(0, 0, 0, 0);

    if (drawDay.getTime() === today.getTime()) {
        return 'Hoje às 21h';
    } else if (drawDay.getTime() === tomorrow.getTime()) {
        return 'Amanhã às 21h';
    } else {
        return `${DAY_NAMES[drawDate.getDay()]} às 21h`;
    }
}

/**
 * Atualiza todos os countdowns de apostas
 * O countdown mostra o tempo até o HORÁRIO DE CORTE (20:50), não até o sorteio
 */
function updateCountdowns() {
    const now = new Date();
    for (const [lotteryId, targetTime] of Object.entries(drawTargetTimes)) {
        const el = document.getElementById(`countdown-${lotteryId}`);
        if (!el) continue;

        // Calcula o horário de corte (20:50) do dia do sorteio
        const cutoffTime = new Date(targetTime);
        cutoffTime.setHours(CUTOFF_HOUR, CUTOFF_MINUTE, 0, 0);

        const diff = cutoffTime.getTime() - now.getTime();

        if (diff <= 0) {
            el.innerHTML = '⏰ <span class="cutoff-closed">Apostas agora valem para o próximo sorteio</span>';
            continue;
        }

        const totalMinutes = Math.floor(diff / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const minStr = String(minutes).padStart(2, '0');

        // Alerta visual quando falta pouco tempo
        const isUrgent = hours === 0 && minutes <= 30;
        const urgentClass = isUrgent ? 'cutoff-urgent' : '';

        if (hours >= 24) {
            const days = Math.floor(hours / 24);
            const remainingHours = hours % 24;
            el.innerHTML = `⏰ Apostas encerram em <span class="${urgentClass}">${days} dia${days > 1 ? 's' : ''} e ${remainingHours}h</span>`;
        } else if (hours > 0) {
            el.innerHTML = `⏰ Apostas encerram em <span class="${urgentClass}">${hours}h ${minStr}min</span>`;
        } else {
            el.innerHTML = `⏰ Apostas encerram em <span class="${urgentClass}">${minutes}min</span>`;
        }
    }
}

/**
 * Inicia os timers de countdown (atualiza a cada 30s)
 */
function startCountdownTimers() {
    if (countdownInterval) clearInterval(countdownInterval);
    updateCountdowns();
    countdownInterval = setInterval(updateCountdowns, 30000);
}

/**
 * Inicializa os resultados buscando da API
 */
export async function initializeResults() {
    if (resultsLoadingState.initialized) return;
    
    console.log('[App] Inicializando resultados da API...');
    
    const lotteryIds = ['megasena', 'lotofacil', 'quina'];
    
    for (const lottery of lotteryIds) {
        try {
            await fetchLotteryResults(lottery);
        } catch (error) {
            console.error(`[App] Erro ao buscar resultados de ${lottery}:`, error);
        }
    }
    
    resultsLoadingState.initialized = true;
    
    updateHomePrizes();
}

/**
 * Busca resultados de uma loteria específica da API
 * @param {string} lotteryId - ID da loteria
 * @param {number} count - Quantidade de resultados
 */
export async function fetchLotteryResults(lotteryId, count = 5) {
    if (!LoteriasAPI) {
        console.error('[App] LoteriasAPI não disponível');
        throw new Error('API_NOT_AVAILABLE');
    }
    
    resultsLoadingState[lotteryId] = true;
    console.log(`[App] Buscando ${count} resultados de ${lotteryId}...`);
    
    try {
        const results = await LoteriasAPI.getLastResults(lotteryId, count);
        
        if (!results || results.length === 0) {
            console.warn(`[App] Nenhum resultado retornado para ${lotteryId}`);
            throw new Error('NO_RESULTS');
        }
        
        officialResults[lotteryId] = results;
        console.log(`[App] ${lotteryId}: ${results.length} resultados carregados`);
        console.log(`[App] Primeiro resultado:`, results[0]);
        return results;
    } catch (error) {
        console.error(`[App] Erro ao buscar ${lotteryId}:`, error.message);
        
        if (!officialResults[lotteryId] || officialResults[lotteryId].length === 0) {
            officialResults[lotteryId] = [];
        }
        throw error;
    } finally {
        resultsLoadingState[lotteryId] = false;
    }
}

/**
 * Atualiza os prêmios, concurso, data do sorteio e countdown na home
 */
export function updateHomePrizes() {
    console.log('[App] Atualizando cards da home...');
    
    const lotteryIds = ['megasena', 'lotofacil', 'quina'];
    
    for (const lotteryId of lotteryIds) {
        const prizeEl = document.getElementById(`prize-${lotteryId}`);
        const contestEl = document.getElementById(`contest-${lotteryId}`);
        const drawEl = document.getElementById(`draw-${lotteryId}`);
        const countdownEl = document.getElementById(`countdown-${lotteryId}`);
        if (!prizeEl) continue;
        
        if (officialResults[lotteryId] && officialResults[lotteryId].length > 0) {
            const lastResult = officialResults[lotteryId][0];
            
            // ====== PRÊMIO ======
            let prizeValue = lastResult.proximoConcurso?.valorEstimado || 
                             lastResult.proximoConcurso?.valorAcumulado ||
                             lastResult.prize || 0;
            
            prizeEl.textContent = prizeValue > 0 
                ? LoteriasAPI.formatCurrency(prizeValue) 
                : defaultPrizes[lotteryId];
            
            // ====== CONCURSO ======
            const nextContest = (lastResult.contest || 0) + 1;
            if (contestEl) {
                contestEl.textContent = `nº ${nextContest}`;
            }
            
            // ====== DATA DO SORTEIO ======
            const dataProximo = lastResult.proximoConcurso?.data;
            if (drawEl) {
                drawEl.textContent = formatDrawDateLabel(dataProximo);
            }
            
            // ====== COUNTDOWN ======
            if (dataProximo) {
                const drawDate = parseDateBR(dataProximo);
                if (drawDate) {
                    drawDate.setHours(21, 0, 0, 0);
                    drawTargetTimes[lotteryId] = drawDate;
                }
            }
            
        } else if (!resultsLoadingState[lotteryId]) {
            prizeEl.textContent = defaultPrizes[lotteryId];
            if (contestEl) contestEl.textContent = '---';
            if (drawEl) drawEl.textContent = '---';
            if (countdownEl) countdownEl.textContent = '⏰ Aguardando dados...';
        }
    }
    
    // Inicia os countdowns
    startCountdownTimers();
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Calcula quantos números acertou
 * @param {Array} betNumbers - Números da aposta
 * @param {Array} drawnNumbers - Números sorteados
 * @returns {number} - Quantidade de acertos
 */
export function calculateHits(betNumbers, drawnNumbers) {
    return betNumbers.filter(n => drawnNumbers.includes(n)).length;
}

/**
 * Determina o prêmio baseado nos acertos
 * @param {string} lotteryId - ID da loteria
 * @param {number} hits - Quantidade de acertos
 * @param {object} result - Resultado do concurso com premiação
 * @returns {object} - { won: boolean, prize: number, prizeName: string }
 */
export function determinePrize(lotteryId, hits, result) {
    const rules = prizeRules[lotteryId];
    if (!rules) {
        return { won: false, prize: 0, prizeName: '' };
    }
    
    if (hits < rules.minHitsToWin) {
        return { won: false, prize: 0, prizeName: '' };
    }
    
    const prizeRange = rules.prizeRanges.find(r => r.hits === hits);
    if (!prizeRange) {
        return { won: false, prize: 0, prizeName: '' };
    }
    
    let prizeValue = 0;
    if (result && result.premiacao) {
        const faixa = result.premiacao.find(p => p.acertos && p.acertos.toString().includes(hits.toString()));
        if (faixa && faixa.premio > 0) {
            prizeValue = faixa.premio;
        }
    }
    
    if (prizeValue === 0 && result && result.prize) {
        prizeValue = result.prize * prizeRange.multiplier;
    }
    
    if (prizeValue === 0) {
        prizeValue = 10 + (hits * 5);
    }
    
    return {
        won: true,
        prize: prizeValue,
        prizeName: prizeRange.name
    };
}

/**
 * Busca o resultado de um concurso específico
 * @param {string} lotteryId - ID da loteria
 * @param {number} contest - Número do concurso
 * @returns {Promise<object|null>} - Resultado ou null se não encontrado
 */
export async function getContestResult(lotteryId, contest) {
    if (!LoteriasAPI) {
        console.error('[App] LoteriasAPI não disponível');
        return null;
    }
    
    try {
        const result = await LoteriasAPI.getResult(lotteryId, contest);
        return result;
    } catch (error) {
        console.warn(`[App] Não foi possível buscar resultado do concurso ${contest} de ${lotteryId}:`, error.message);
        return null;
    }
}

/**
 * Verifica todas as apostas ativas contra os resultados
 */
export async function checkBetsAgainstResults() {
    console.log('[App] Verificando apostas contra resultados...');
    
    const activeBets = state.bets.filter(bet => bet.status === 'active');
    
    if (activeBets.length === 0) {
        console.log('[App] Nenhuma aposta ativa para verificar');
        return;
    }
    
    console.log(`[App] Verificando ${activeBets.length} apostas ativas`);
    
    let betsUpdated = false;
    let totalWinnings = 0;
    let winCount = 0;
    
    for (const bet of activeBets) {
        // Normaliza campos snake_case → camelCase se necessário
        if (!bet.lotteryId && bet.lottery_id) bet.lotteryId = bet.lottery_id;
        if (!bet.lotteryName && bet.lottery_name) bet.lotteryName = bet.lottery_name;

        const betContestNum = parseInt(bet.contest, 10);
        if (!bet.contest || isNaN(betContestNum)) {
            console.log(`[App] Aposta ${bet.id} sem concurso válido, pulando`);
            continue;
        }

        try {
            // Verifica se o concurso já foi sorteado comparando com os resultados conhecidos
            const knownResults = officialResults[bet.lotteryId];
            if (knownResults && knownResults.length > 0) {
                const lastDrawnContest = knownResults[0].contest;
                if (betContestNum > lastDrawnContest) {
                    console.log(`[App] Concurso ${bet.contest} de ${bet.lotteryId} ainda não foi sorteado (último sorteado: ${lastDrawnContest})`);
                    continue;
                }
            }
            
            const result = await getContestResult(bet.lotteryId, bet.contest);
            
            // Verifica se o resultado existe e se é do concurso correto
            if (!result || !result.numbers || result.numbers.length === 0) {
                console.log(`[App] Concurso ${bet.contest} de ${bet.lotteryId} ainda não foi sorteado`);
                continue;
            }
            
            // Converte para números para comparação segura
            const resultContest = parseInt(result.contest, 10);
            
            // Verifica se o concurso retornado é o mesmo que foi solicitado
            // Se a API retornar um concurso diferente ou menor, significa que o solicitado ainda não foi sorteado
            if (isNaN(resultContest) || resultContest < betContestNum) {
                console.log(`[App] Concurso ${bet.contest} de ${bet.lotteryId} ainda não foi sorteado (API retornou concurso ${result.contest})`);
                continue;
            }
            
            // Se o concurso retornado é maior que o da aposta, algo está errado - pula
            if (resultContest > betContestNum) {
                console.log(`[App] Concurso ${bet.contest} de ${bet.lotteryId} - API retornou concurso mais recente ${result.contest}, pulando`);
                continue;
            }
            
            const hits = calculateHits(bet.numbers, result.numbers);
            console.log(`[App] Aposta ${bet.id}: ${hits} acertos de ${bet.numbers.length} números`);
            
            const prizeInfo = determinePrize(bet.lotteryId, hits, result);
            
            bet.hits = hits;
            bet.drawnNumbers = result.numbers;
            bet.drawDate = result.date;
            
            if (prizeInfo.won) {
                bet.status = 'won';
                bet.prize = prizeInfo.prize;
                bet.prizeName = prizeInfo.prizeName;
                console.log(`[App] Aposta ${bet.id} GANHOU! ${prizeInfo.prizeName} - R$ ${prizeInfo.prize.toFixed(2)}`);
                
                state.balance += prizeInfo.prize;
                state.transactions.unshift({
                    id: Utils.generateId(),
                    type: 'prize',
                    lottery: bet.lotteryName,
                    value: prizeInfo.prize,
                    date: Utils.formatDate(new Date()),
                    description: `Prêmio ${prizeInfo.prizeName} - Concurso ${bet.contest}`
                });

                // Persiste no banco: atualiza status + credita premio
                apiUpdateBetResult(bet.id, 'won', hits, prizeInfo.prize)
                    .catch(err => console.warn(`[API] Erro ao atualizar aposta ${bet.id}:`, err));

                totalWinnings += prizeInfo.prize;
                winCount++;
            } else {
                bet.status = 'lost';
                console.log(`[App] Aposta ${bet.id} não ganhou (${hits} acertos)`);

                // Persiste no banco: marca como perdeu
                apiUpdateBetResult(bet.id, 'lost', hits, null)
                    .catch(err => console.warn(`[API] Erro ao atualizar aposta ${bet.id}:`, err));
            }
            
            betsUpdated = true;
            
        } catch (error) {
            console.error(`[App] Erro ao verificar aposta ${bet.id}:`, error);
        }
    }
    
    if (betsUpdated) {
        if (typeof window.saveData === 'function') {
            window.saveData();
        }
        
        const myBetsScreen = document.getElementById('screen-my-bets');
        if (myBetsScreen && myBetsScreen.classList.contains('active')) {
            if (typeof window.renderBets === 'function') {
                window.renderBets(state.currentBetsFilter);
            }
        }
        const qgScreen = document.getElementById('screen-quick-games');
        const qgResultsPanel = document.getElementById('qg-panel-results');
        if (qgScreen && qgScreen.classList.contains('active') && qgResultsPanel && !qgResultsPanel.classList.contains('hidden')) {
            const activeFilterBtn = document.querySelector('#qg-results-filter .filter-btn.active');
            const filter = activeFilterBtn?.dataset?.filter || 'active';
            if (typeof window.filterQgResults === 'function') {
                window.filterQgResults(filter);
            }
        }
        
        if (typeof window.updateBalanceDisplays === 'function') {
            window.updateBalanceDisplays();
        }

        // Notifica o usuario sobre vitorias
        if (winCount > 0) {
            const prizeFormatted = totalWinnings.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const msg = winCount === 1
                ? `Parabéns! Você ganhou R$ ${prizeFormatted}!`
                : `Parabéns! ${winCount} apostas premiadas! Total: R$ ${prizeFormatted}`;

            // Toast in-app
            if (typeof window.showToast === 'function') {
                window.showToast(msg, 'success');
            }

            // Notificação do navegador (se permitida)
            if ('Notification' in window && Notification.permission === 'granted') {
                try {
                    new Notification('LotoGrana - Você Ganhou!', {
                        body: msg,
                        icon: 'assets/icon.png',
                        badge: 'assets/icon.png'
                    });
                } catch (e) { /* falha silenciosa em ambientes que nao suportam */ }
            }
        }
        
        console.log('[App] Apostas atualizadas e salvas');
    }
}

/**
 * Exibe resultados de uma loteria
 * @param {string} lotteryId - ID da loteria
 */
export async function showResults(lotteryId) {
    // Atualiza estado ativo apenas nos cards da tela Últimos Concursos (#screen-results)
    const resultsScreen = document.getElementById('screen-results');
    if (resultsScreen) {
        resultsScreen.querySelectorAll('.lottery-filter-card, .result-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        const activeCard = resultsScreen.querySelector(`.lottery-filter-card[data-lottery="${lotteryId}"]`) 
            || resultsScreen.querySelector(`.result-tab[data-lottery="${lotteryId}"]`);
        if (activeCard) {
            activeCard.classList.add('active');
        }
    }
    
    const container = document.getElementById('results-list');
    if (!container) return;
    
    let results = officialResults[lotteryId];
    
    if (!results || results.length === 0) {
        container.innerHTML = `
            <div class="results-loading">
                <div class="loading-spinner"></div>
                <p>Carregando resultados...</p>
            </div>
        `;
        
        try {
            results = await fetchLotteryResults(lotteryId, 5);
        } catch (error) {
            container.innerHTML = `
                <div class="results-error">
                    <i data-lucide="wifi-off"></i>
                    <p>Não foi possível carregar os resultados</p>
                    <button class="btn-retry" onclick="showResults('${lotteryId}')">
                        <i data-lucide="refresh-cw"></i>
                        Tentar novamente
                    </button>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }
    }
    
    if (!results || results.length === 0) {
        container.innerHTML = `
            <div class="results-empty">
                <i data-lucide="inbox"></i>
                <p>Nenhum resultado disponível</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    const isPrime = (n) => {
        if (n < 2) return false;
        if (n === 2) return true;
        if (n % 2 === 0) return false;
        for (let i = 3; i <= Math.sqrt(n); i += 2) {
            if (n % i === 0) return false;
        }
        return true;
    };
    const getFibonacciSet = (max) => {
        const set = new Set([0, 1]);
        let a = 0;
        let b = 1;
        while (b <= max) {
            const next = a + b;
            set.add(next);
            a = b;
            b = next;
        }
        return set;
    };

    const lotteryColor = lotteries[lotteryId]?.color || '#005CA9';
    const lotteryName = lotteries[lotteryId]?.name || 'Loteria';
    const lotteryLogo = lotteries[lotteryId]?.logo || `assets/${lotteryId}.png`;
    
    // Card de destaque do próximo sorteio
    let nextDrawCard = '';
    const latestResult = results[0];
    if (latestResult && latestResult.proximoConcurso) {
        const valorProximo = latestResult.proximoConcurso.valorEstimado || latestResult.proximoConcurso.valorAcumulado || 0;
        const dataProximo = latestResult.proximoConcurso.data || 'Em breve';
        const acumulou = latestResult.acumulou;
        const proximoConcursoNum = (latestResult.contest || 0) + 1;
        
        // Verificar se o sorteio é hoje ou amanhã
        const hoje = new Date();
        const amanha = new Date(hoje);
        amanha.setDate(amanha.getDate() + 1);
        
        const dataFormatada = dataProximo.toLowerCase();
        const diaHoje = String(hoje.getDate()).padStart(2, '0');
        const mesHoje = String(hoje.getMonth() + 1).padStart(2, '0');
        const diaAmanha = String(amanha.getDate()).padStart(2, '0');
        const mesAmanha = String(amanha.getMonth() + 1).padStart(2, '0');
        
        const isHoje = dataFormatada.includes(diaHoje + '/' + mesHoje) || 
                       dataFormatada.includes('hoje') ||
                       dataFormatada === hoje.toLocaleDateString('pt-BR');
        const isAmanha = dataFormatada.includes(diaAmanha + '/' + mesAmanha) ||
                         dataFormatada.includes('amanhã') ||
                         dataFormatada === amanha.toLocaleDateString('pt-BR');
        
        let dataIndicator = '';
        if (isHoje) dataIndicator = ' <span class="date-highlight">(Hoje)</span>';
        else if (isAmanha) dataIndicator = ' <span class="date-highlight">(Amanhã)</span>';
        
        nextDrawCard = `
            <div class="next-draw-item" style="--lottery-color: ${lotteryColor};">
                <div class="next-draw-header-bar">
                    <span class="next-draw-header-title">PRÓXIMO CONCURSO</span>
                    ${acumulou ? '<span class="badge-acumulou">ACUMULADO</span>' : ''}
                </div>
                <div class="next-draw-body">
                    <div class="next-draw-info-section">
                        <div class="next-draw-info-row">
                            <span class="next-draw-info-label">Concurso ${proximoConcursoNum}</span>
                        </div>
                        <div class="next-draw-info-row">
                            <span class="next-draw-info-date">Data do sorteio: ${dataProximo}${dataIndicator}</span>
                        </div>
                    </div>
                    <div class="next-draw-prize-section">
                        <span class="next-draw-prize-title">Prêmio Estimado</span>
                        <span class="next-draw-prize-value">${LoteriasAPI.formatCurrency(valorProximo)}</span>
                    </div>
                    <button class="next-draw-bet-btn next-draw-bet-btn-ai" onclick="goToQuickGames('${lotteryId}')">
                        <span class="next-draw-ai-badge">
                            <img src="assets/logo-ia.png" alt="IA" class="next-draw-ai-logo">
                        </span>
                        <span class="next-draw-btn-text">FAZER APOSTA</span>
                    </button>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = nextDrawCard + results.map((result, index) => {
        const numbers = result.numbers || [];
        const maxNumber = numbers.length > 0 ? Math.max(...numbers, 0) : 0;
        const fibSet = getFibonacciSet(maxNumber);
        const isFirst = index === 0;
        
        const acumulouBadge = result.acumulou ? `<span class="badge-acumulou">ACUMULOU</span>` : '';
        
        let premiacaoHtml = '';
        if (result.premiacao && result.premiacao.length > 0) {
            premiacaoHtml = `
                <div class="result-premiacao">
                    <div class="premiacao-title">Premiação</div>
                    ${result.premiacao.map(p => {
                        const ganhadores = p.ganhadores || 0;
                        return `
                        <div class="premiacao-row">
                            <span class="premiacao-acertos">${p.acertos || '-'}</span>
                            <span class="premiacao-ganhadores">${ganhadores.toLocaleString('pt-BR')} ${ganhadores === 1 ? 'ganhador' : 'ganhadores'}</span>
                            <span class="premiacao-valor">${(p.premio && p.premio > 0) ? LoteriasAPI.formatCurrencyFull(p.premio) : '-'}</span>
                        </div>
                    `;
                    }).join('')}
                </div>
            `;
        }
        
        return `
            <div class="result-item ${isFirst ? 'result-item-latest' : ''}">
                <div class="result-item-header-bar" style="--lottery-color: ${lotteryColor};">
                    <div class="result-header-left">
                        <span class="result-item-title">Concurso ${result.contest}</span>
                        ${acumulouBadge}
                    </div>
                    <span class="result-item-date">${result.date}</span>
                </div>
                <div class="result-item-body">
                    <div class="result-numbers-grid">
                        ${numbers.map(n => `<span class="result-number-ball" style="--lottery-color: ${lotteryColor};">${String(n).padStart(2, '0')}</span>`).join('')}
                    </div>
                </div>
                ${premiacaoHtml}
                <div class="result-item-stats">
                    <div class="stat-item">
                        <span class="stat-label">Ímpares</span>
                        <span class="stat-value">${numbers.filter(n => n % 2 !== 0).length}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Pares</span>
                        <span class="stat-value">${numbers.filter(n => n % 2 === 0).length}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Primos</span>
                        <span class="stat-value">${numbers.filter(isPrime).length}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Soma</span>
                        <span class="stat-value">${numbers.reduce((sum, n) => sum + n, 0)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Fibo</span>
                        <span class="stat-value">${numbers.filter(n => fibSet.has(n)).length}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

export default {
    initializeResults,
    fetchLotteryResults,
    updateHomePrizes,
    calculateHits,
    determinePrize,
    getContestResult,
    checkBetsAgainstResults,
    showResults
};
