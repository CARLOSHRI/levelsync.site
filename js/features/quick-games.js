/**
 * Quick Games Module - Jogos Prontos Diários
 * Gera jogos aleatórios diariamente (mesmos jogos durante o dia todo)
 */

import { state, officialResults } from '../core/state.js';
import { lotteries, calculateBetValue, defaultPrizes } from '../core/config.js';
import { apiSaveBets } from '../api-client.js';
import { Utils } from '../utils/utils.js';
import { LoteriasAPI } from '../utils/api.js';

let selectedQuickGame = null;
let dailyGamesCache = {};
let qgCountdownInterval = null;
const qgDrawTargetTimes = {};
let currentQgLottery = 'lotofacil';
if (typeof window !== 'undefined') window.currentQgLottery = currentQgLottery;

const CUTOFF_HOUR = 20;
const CUTOFF_MINUTE = 50;
const DAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

/**
 * Verifica se ainda pode apostar para o sorteio de hoje
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
 * Formata a data do sorteio com dia da semana e horário
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
 * Obtém o identificador do período atual de apostas
 * O período vai de 20:50 de um dia até 20:49 do próximo
 * Isso garante que os jogos mudam após o horário de corte
 */
function getCurrentBettingPeriod() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Se passou das 20:50, estamos no período do próximo dia
    if (currentHour > CUTOFF_HOUR || (currentHour === CUTOFF_HOUR && currentMinute >= CUTOFF_MINUTE)) {
        // Avança para o próximo dia
        const nextDay = new Date(now);
        nextDay.setDate(nextDay.getDate() + 1);
        return nextDay.toISOString().split('T')[0];
    }
    
    // Antes das 20:50, estamos no período do dia atual
    return now.toISOString().split('T')[0];
}

/**
 * Obtém a chave do localStorage para apostas do período atual
 */
function getPeriodBetsKey() {
    const period = getCurrentBettingPeriod();
    return `qg-bets-${period}`;
}

/**
 * Obtém as apostas feitas no período atual
 */
function getPeriodBets() {
    try {
        const key = getPeriodBetsKey();
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        return {};
    }
}

/**
 * Salva uma aposta como feita no período atual
 */
function savePeriodBet(lotteryId, gameIndex) {
    try {
        const key = getPeriodBetsKey();
        const bets = getPeriodBets();
        bets[`${lotteryId}-${gameIndex}`] = true;
        localStorage.setItem(key, JSON.stringify(bets));
    } catch (e) {
        console.error('Erro ao salvar aposta:', e);
    }
}

/**
 * Verifica se já apostou em um jogo no período atual
 */
function hasBetInPeriod(lotteryId, gameIndex) {
    const bets = getPeriodBets();
    return bets[`${lotteryId}-${gameIndex}`] === true;
}

/**
 * Gera um hash numérico a partir de uma string (para usar como seed)
 */
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

/**
 * Gerador de números pseudo-aleatórios com seed (Linear Congruential Generator)
 */
function seededRandom(seed) {
    const a = 1664525;
    const c = 1013904223;
    const m = Math.pow(2, 32);
    let state = seed;
    
    return function() {
        state = (a * state + c) % m;
        return state / m;
    };
}

/**
 * Gera números aleatórios usando um seed específico
 */
function generateSeededNumbers(seed, count, maxNumber) {
    const rng = seededRandom(seed);
    const numbers = [];
    const available = Array.from({length: maxNumber}, (_, i) => i + 1);
    
    for (let i = 0; i < count; i++) {
        const idx = Math.floor(rng() * available.length);
        numbers.push(available[idx]);
        available.splice(idx, 1);
    }
    
    return numbers.sort((a, b) => a - b);
}

/**
 * Gera 30 jogos para o período de apostas atual
 * Os jogos são resetados às 20:50 (horário de corte)
 */
function generateDailyGames(lotteryId) {
    const lottery = lotteries[lotteryId];
    if (!lottery) return [];
    
    const period = getCurrentBettingPeriod();
    const cacheKey = `${lotteryId}-${period}`;
    
    if (dailyGamesCache[cacheKey]) {
        return dailyGamesCache[cacheKey];
    }
    
    const games = [];
    for (let i = 0; i < 30; i++) {
        const seed = hashCode(`${period}-${lotteryId}-${i}-lotograna`);
        const numbers = generateSeededNumbers(seed, lottery.minNumbers, lottery.maxNumber);
        games.push({
            name: `Jogo ${i + 1}`,
            numbers: numbers
        });
    }
    
    dailyGamesCache[cacheKey] = games;
    return games;
}

/**
 * Renderiza os jogos diários no HTML
 */
function renderDailyGames(lotteryId) {
    const container = document.getElementById('qg-games-list');
    if (!container) return;
    
    const lottery = lotteries[lotteryId];
    const games = generateDailyGames(lotteryId);
    const value = calculateBetValue(lotteryId, games[0]?.numbers || []);
    const lotteryColor = lottery?.color || '#005CA9';
    
    // Busca o próximo concurso (fallback '---' se API ainda não carregou)
    const nextContestRaw = typeof window.getNextContestNumber === 'function' 
        ? window.getNextContestNumber(lotteryId) 
        : null;
    const nextContest = (nextContestRaw != null && nextContestRaw !== '') ? nextContestRaw : '---';
    
    container.innerHTML = games.map((game, index) => {
        const alreadyBet = hasBetInPeriod(lotteryId, index);
        const btnClass = alreadyBet ? 'qg-bet-btn qg-bet-btn-done' : 'qg-bet-btn';
        const btnDisabled = alreadyBet ? 'disabled' : '';
        const btnIcon = alreadyBet ? 'check' : 'ticket';
        const btnText = alreadyBet ? 'APOSTADO' : 'APOSTAR';
        const numbers = game.numbers;
        
        return `
            <div class="generated-item" id="qg-game-${lotteryId}-${index}" style="--lottery-color: ${lotteryColor};">
                <div class="generated-item-header-bar">
                    <div class="generated-item-title-group">
                        <span class="generated-item-title">${game.name}</span>
                        <span class="generated-item-contest">Concurso ${nextContest}</span>
                    </div>
                    <div class="header-actions">
                        <span class="qg-game-price">R$ ${value.toFixed(2).replace('.', ',')}</span>
                    </div>
                </div>
                <div class="generated-item-body">
                    <div class="generated-item-numbers-grid">
                        ${numbers.map(n => `<span class="generated-number-ball">${String(n).padStart(2, '0')}</span>`).join('')}
                    </div>
                </div>
                <div class="qg-game-footer">
                    <button class="${btnClass}" id="qg-bet-btn-${lotteryId}-${index}" onclick="betOnDailyGame('${lotteryId}', ${index})" ${btnDisabled}>
                        <i data-lucide="${btnIcon}"></i>
                        ${btnText}
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Inicializa ícones Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Aposta diretamente em um jogo diário (sem modal)
 */
export function betOnDailyGame(lotteryId, gameIndex) {
    const games = generateDailyGames(lotteryId);
    const game = games[gameIndex];
    const lottery = lotteries[lotteryId];
    
    if (!game || !lottery) return;
    
    const value = calculateBetValue(lotteryId, game.numbers);
    const btn = document.getElementById(`qg-bet-btn-${lotteryId}-${gameIndex}`);
    
    // Verifica saldo - mostra modal de saldo insuficiente; se clicar em adicionar, abre modal PIX
    if (state.balance < value) {
        if (typeof window.showBalanceModal === 'function') {
            window.showBalanceModal(value, { useDepositModal: true });
        } else if (typeof window.showScreen === 'function') {
            window.showScreen('deposit');
        }
        return;
    }
    
    // Salva a aposta
    const betId = Utils.generateId();
    const dateStr = Utils.formatDate(new Date());
    
    const nextContest = typeof window.getNextContestNumber === 'function' 
        ? window.getNextContestNumber(lotteryId) 
        : null;
    const nextContestDate = typeof window.getNextContestDate === 'function' 
        ? window.getNextContestDate(lotteryId) 
        : null;
    
    const betObj = {
        id: betId,
        lotteryId,
        lottery_name: lottery.name,
        lotteryName: lottery.name,
        lottery: lottery.name,
        numbers: [...game.numbers],
        value,
        date: dateStr,
        status: 'active',
        isAI: false,
        contest: nextContest,
        contestDate: nextContestDate
    };
    
    state.bets.unshift(betObj);
    state.balance -= value;
    
    const txObj = {
        id: betId,
        type: 'bet',
        lottery: lottery.name,
        value: -value,
        date: dateStr
    };
    state.transactions.unshift(txObj);
    
    apiSaveBets([{
        lottery_id: lotteryId,
        lottery_name: lottery.name,
        numbers: [...game.numbers],
        value: value,
        status: 'active',
        is_ai: false,
        contest: nextContest,
        contest_date: nextContestDate
    }]).catch(err => console.error('Erro ao salvar aposta:', err));
    
    // Salva no localStorage que apostou neste jogo no período atual
    savePeriodBet(lotteryId, gameIndex);
    
    // Atualiza o botão para mostrar que apostou
    if (btn) {
        btn.innerHTML = '<i data-lucide="check"></i> APOSTADO';
        btn.classList.add('qg-bet-btn-done');
        btn.disabled = true;
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
    
    if (typeof window.updateBalanceDisplays === 'function') {
        window.updateBalanceDisplays();
    }
    
    if (typeof window.saveData === 'function') {
        window.saveData();
    }
    
    if (typeof window.showToast === 'function') {
        window.showToast(`Aposta de R$ ${value.toFixed(2).replace('.', ',')} realizada com sucesso!`, 'success');
    }
    
    const resultsPanel = document.getElementById('qg-panel-results');
    if (resultsPanel && !resultsPanel.classList.contains('hidden') && typeof window.filterQgResults === 'function') {
        const activeBtn = document.querySelector('#qg-results-filter .filter-btn.active');
        window.filterQgResults(activeBtn?.dataset?.filter || 'active');
    }
}
    
/**
 * Seleciona um jogo diário para apostar
 */
export function selectDailyGame(lotteryId, gameIndex) {
    const games = generateDailyGames(lotteryId);
    const game = games[gameIndex];
    
    if (!game) return;
    
    openQuickBetModal(lotteryId, game.numbers, game.name);
}

/**
 * Parseia data no formato DD/MM/YYYY
 */
function parseDateBR(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts.map(Number);
    return new Date(year, month - 1, day, 20, 0, 0);
}

/**
 * Atualiza o countdown da loteria atual
 */
function updateQgCountdown() {
    const lotteryId = currentQgLottery;
    const el = document.getElementById('qg-info-countdown');
    if (!el) return;
    
    const targetTime = qgDrawTargetTimes[lotteryId];
    if (!targetTime) {
        el.textContent = '⏰ Aguardando dados...';
        return;
    }

    const now = new Date();
    const cutoffTime = new Date(targetTime);
    cutoffTime.setHours(CUTOFF_HOUR, CUTOFF_MINUTE, 0, 0);

    const diff = cutoffTime - now;

    if (diff <= 0) {
        el.innerHTML = '⏰ Apostas agora valem para o próximo sorteio';
        el.style.color = '#64748B';
    } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        let timeStr = '';
        if (days > 0) {
            timeStr = `${days}d ${hours}h ${minutes}min`;
        } else if (hours > 0) {
            timeStr = `${hours}h ${minutes}min`;
        } else {
            timeStr = `${minutes}min`;
        }
        el.textContent = `⏰ Apostas encerram em ${timeStr}`;
        el.style.color = '#dc2626';
    }
}

/**
 * Inicia os timers de countdown
 */
function startQgCountdownTimers() {
    if (qgCountdownInterval) clearInterval(qgCountdownInterval);
    updateQgCountdown();
    qgCountdownInterval = setInterval(updateQgCountdown, 30000);
}

/**
 * Atualiza o card de informações da loteria selecionada
 */
function updateInfoCard(lotteryId) {
    const lottery = lotteries[lotteryId];
    if (!lottery) return;
    
    const headerEl = document.getElementById('qg-info-header');
    const logoEl = document.getElementById('qg-info-logo');
    const prizeEl = document.getElementById('qg-info-prize');
    const contestEl = document.getElementById('qg-info-contest');
    const drawEl = document.getElementById('qg-info-draw');
    const countdownEl = document.getElementById('qg-info-countdown');
    
    // Atualiza header com cor da loteria
    if (headerEl) {
        headerEl.className = `game-card-header ${lotteryId}-header`;
    }
    
    // Atualiza logo
    if (logoEl) {
        logoEl.src = `assets/${lotteryId}.png`;
        logoEl.alt = lottery.name;
    }

    // Atualiza título do header com nome da loteria
    const headerTitle = document.getElementById('qg-header-title');
    if (headerTitle) {
        headerTitle.textContent = lottery.name;
    }
    
    // Atualiza prêmio
    if (prizeEl) {
        prizeEl.className = `game-card-prize ${lotteryId}-prize`;
        if (officialResults[lotteryId] && officialResults[lotteryId].length > 0) {
            const lastResult = officialResults[lotteryId][0];
            let prizeValue = lastResult.proximoConcurso?.valorEstimado || 
                             lastResult.proximoConcurso?.valorAcumulado ||
                             lastResult.prize || 0;
            
            prizeEl.textContent = prizeValue > 0 
                ? LoteriasAPI.formatCurrency(prizeValue) 
                : defaultPrizes[lotteryId];
        } else {
            prizeEl.textContent = defaultPrizes[lotteryId];
        }
    }
    
    // Atualiza concurso
    if (contestEl && typeof window.getNextContestNumber === 'function') {
        const contestNumber = window.getNextContestNumber(lotteryId);
        contestEl.textContent = contestNumber || '---';
    }
    
    // Atualiza data do sorteio
    if (typeof window.getNextContestDate === 'function') {
        const drawDate = window.getNextContestDate(lotteryId);
        if (drawEl) {
            drawEl.textContent = formatDrawDateLabel(drawDate);
        }
        
        // Configura o target time para o countdown
        if (drawDate) {
            const targetDate = parseDateBR(drawDate);
            if (targetDate) {
                qgDrawTargetTimes[lotteryId] = targetDate;
            }
        }
    }
    
    // Atualiza countdown
    updateQgCountdown();
}

/**
 * Mostra o seletor de loteria (quando entra pelo menu)
 */
function showPicker() {
    const picker = document.getElementById('qg-lottery-picker');
    const content = document.getElementById('qg-content');
    const headerTitle = document.getElementById('qg-header-title');
    if (picker) picker.classList.remove('hidden');
    if (content) content.classList.add('hidden');
    if (headerTitle) headerTitle.textContent = 'Jogos do Dia';
    updateQgPickerPrizes();
    const main = document.getElementById('main-content');
    if (main) main.scrollTop = 0;
}

/**
 * Mostra o conteúdo (jogos + resultados) para a loteria selecionada
 */
function showContent(lotteryId) {
    const picker = document.getElementById('qg-lottery-picker');
    const content = document.getElementById('qg-content');
    if (picker) picker.classList.add('hidden');
    if (content) content.classList.remove('hidden');
    showQuickGames(lotteryId);
}

/**
 * Atualiza os cards do seletor de loteria (prêmio, concurso, sorteio)
 */
function updateQgPickerPrizes() {
    const lotteryIds = ['lotofacil', 'megasena', 'quina'];
    for (const lotteryId of lotteryIds) {
        const prizeEl = document.getElementById(`qg-picker-prize-${lotteryId}`);
        const contestEl = document.getElementById(`qg-picker-contest-${lotteryId}`);
        const drawEl = document.getElementById(`qg-picker-draw-${lotteryId}`);
        const countdownEl = document.getElementById(`qg-picker-countdown-${lotteryId}`);
        if (!prizeEl) continue;

        if (officialResults[lotteryId] && officialResults[lotteryId].length > 0) {
            const lastResult = officialResults[lotteryId][0];
            let prizeValue = lastResult.proximoConcurso?.valorEstimado ||
                lastResult.proximoConcurso?.valorAcumulado || lastResult.prize || 0;
            prizeEl.textContent = prizeValue > 0 ? LoteriasAPI.formatCurrency(prizeValue) : defaultPrizes[lotteryId];
            const nextContest = (lastResult.contest || 0) + 1;
            if (contestEl) contestEl.textContent = `nº ${nextContest}`;
            const dataProximo = lastResult.proximoConcurso?.data;
            if (drawEl) drawEl.textContent = formatDrawDateLabel(dataProximo);
            if (dataProximo) {
                const targetDate = parseDateBR(dataProximo);
                if (targetDate) qgDrawTargetTimes[lotteryId] = targetDate;
            }
            if (countdownEl) {
                const targetTime = qgDrawTargetTimes[lotteryId];
                if (targetTime) {
                    const now = new Date();
                    const cutoffTime = new Date(targetTime);
                    cutoffTime.setHours(CUTOFF_HOUR, CUTOFF_MINUTE, 0, 0);
                    const diff = cutoffTime - now;
                    if (diff <= 0) {
                        countdownEl.textContent = '⏰ Apostas valem para o próximo sorteio';
                    } else {
                        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                        const timeStr = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
                        countdownEl.textContent = `⏰ Apostas encerram em ${timeStr}`;
                    }
                } else {
                    countdownEl.textContent = '⏰ Aguardando dados...';
                }
            }
        } else {
            prizeEl.textContent = defaultPrizes[lotteryId];
            if (contestEl) contestEl.textContent = '---';
            if (drawEl) drawEl.textContent = '---';
            if (countdownEl) countdownEl.textContent = '⏰ Carregando...';
        }
    }
}

/**
 * Seleciona loteria no picker (chamado ao clicar em um card)
 */
export function selectQgLottery(lotteryId) {
    currentQgLottery = lotteryId;
    window.currentQgLottery = lotteryId;
    showContent(lotteryId);
}

/**
 * Alterna entre abas Jogos do Dia e Resultados
 */
export function switchQgTab(tab) {
    const gamesPanel = document.getElementById('qg-panel-games');
    const resultsPanel = document.getElementById('qg-panel-results');
    const resultsFilter = document.getElementById('qg-results-filter');
    document.querySelectorAll('.qg-tab').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tab) btn.classList.add('active');
    });
    if (tab === 'games') {
        if (gamesPanel) gamesPanel.classList.remove('hidden');
        if (resultsPanel) resultsPanel.classList.add('hidden');
        if (resultsFilter) resultsFilter.classList.add('hidden');
    } else {
        if (gamesPanel) gamesPanel.classList.add('hidden');
        if (resultsPanel) resultsPanel.classList.remove('hidden');
        if (resultsFilter) resultsFilter.classList.remove('hidden');
        // Sempre abre com filtro Ativas
        document.querySelectorAll('#qg-results-filter .filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === 'active');
        });
        if (typeof window.renderBetsForLottery === 'function') {
            window.renderBetsForLottery(currentQgLottery, 'active', 'qg-results-list');
        }
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Filtra resultados na aba Resultados
 */
export function filterQgResults(filter) {
    document.querySelectorAll('#qg-results-filter .filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filter) btn.classList.add('active');
    });
    if (typeof window.renderBetsForLottery === 'function') {
        window.renderBetsForLottery(currentQgLottery, filter, 'qg-results-list');
    }
}

/**
 * Mostra os jogos de uma loteria específica
 */
export function showQuickGames(lotteryId) {
    currentQgLottery = lotteryId;
    window.currentQgLottery = lotteryId;
    const lottery = lotteries[lotteryId];
    if (lottery) {
        const headerTitle = document.getElementById('qg-header-title');
        if (headerTitle) headerTitle.textContent = lottery.name;
    }
    updateInfoCard(lotteryId);
    renderDailyGames(lotteryId);
    switchQgTab('games');
    // Rolagem para o topo ao selecionar loteria
    const main = document.getElementById('main-content');
    if (main) main.scrollTop = 0;
}

/**
 * Inicializa a tela de Jogos Prontos
 * @param {string} [initialLotteryId] - Loteria a exibir (quando vindo da home)
 */
export function initQuickGames(initialLotteryId) {
    const lotteryIds = ['lotofacil', 'megasena', 'quina'];

    lotteryIds.forEach(lotteryId => {
        if (typeof window.getNextContestDate === 'function') {
            const drawDate = window.getNextContestDate(lotteryId);
            if (drawDate) {
                const targetDate = parseDateBR(drawDate);
                if (targetDate) qgDrawTargetTimes[lotteryId] = targetDate;
            }
        }
    });

    const lotteryFromHome = window._pendingQuickGamesLottery;
    if (window._pendingQuickGamesLottery) delete window._pendingQuickGamesLottery;

    if (lotteryFromHome || initialLotteryId) {
        const lotteryToShow = lotteryFromHome || initialLotteryId;
        currentQgLottery = lotteryToShow;
        window.currentQgLottery = lotteryToShow;
        showContent(lotteryToShow);
    } else {
        showPicker();
    }

    if (typeof window.checkBetsAgainstResults === 'function') {
        window.checkBetsAgainstResults().catch(() => {});
    }

    startQgCountdownTimers();

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}


/**
 * Abre o modal de confirmação de aposta
 */
function openQuickBetModal(lotteryId, numbers, gameName) {
    const lottery = lotteries[lotteryId];
    if (!lottery) return;
    
    selectedQuickGame = {
        lotteryId,
        numbers: [...numbers],
        gameName
    };
    
    const modal = document.getElementById('quick-bet-modal');
    const logoEl = document.getElementById('quick-bet-logo');
    const titleEl = document.getElementById('quick-bet-game-title');
    const numbersEl = document.getElementById('quick-bet-numbers');
    const priceEl = document.getElementById('quick-bet-price');
    
    if (logoEl) {
        logoEl.src = `assets/${lotteryId}.png`;
        logoEl.alt = lottery.name;
    }
    
    if (titleEl) {
        titleEl.textContent = gameName;
    }
    
    if (numbersEl) {
        numbersEl.innerHTML = numbers.map(n => 
            `<span class="quick-bet-number ${lotteryId}-ball">${String(n).padStart(2, '0')}</span>`
        ).join('');
    }
    
    if (priceEl) {
        const value = calculateBetValue(lotteryId, numbers);
        priceEl.textContent = `R$ ${value.toFixed(2).replace('.', ',')}`;
    }
    
    if (modal) {
        modal.classList.remove('hidden');
    }
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Fecha o modal de confirmação
 */
export function closeQuickBetModal() {
    const modal = document.getElementById('quick-bet-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    selectedQuickGame = null;
}

/**
 * Confirma a aposta rápida
 */
export function confirmQuickBet() {
    if (!selectedQuickGame) return;
    
    const { lotteryId, numbers } = selectedQuickGame;
    const lottery = lotteries[lotteryId];
    
    if (!lottery) {
        closeQuickBetModal();
        return;
    }
    
    const value = calculateBetValue(lotteryId, numbers);
    
    if (state.balance < value) {
        closeQuickBetModal();
        if (typeof window.showBalanceModal === 'function') {
            window.showBalanceModal(value, { useDepositModal: true });
        } else if (typeof window.showScreen === 'function') {
            window.showScreen('deposit');
        }
        return;
    }
    
    const betId = Utils.generateId();
    const dateStr = Utils.formatDate(new Date());
    
    // Busca o próximo concurso real da API
    const nextContest = typeof window.getNextContestNumber === 'function' 
        ? window.getNextContestNumber(lotteryId) 
        : null;
    const nextContestDate = typeof window.getNextContestDate === 'function' 
        ? window.getNextContestDate(lotteryId) 
        : null;
    
    const betObj = {
        id: betId,
        lotteryId,
        lottery_name: lottery.name,
        lotteryName: lottery.name,
        lottery: lottery.name,
        numbers: [...numbers],
        value,
        date: dateStr,
        status: 'active',
        isAI: false,
        contest: nextContest,
        contestDate: nextContestDate
    };
    
    state.bets.unshift(betObj);
    state.balance -= value;
    
    const txObj = {
        id: betId,
        type: 'bet',
        lottery: lottery.name,
        value: -value,
        date: dateStr
    };
    state.transactions.unshift(txObj);
    
    apiSaveBets([{
        lottery_id: lotteryId,
        lottery_name: lottery.name,
        numbers: [...numbers],
        value: value,
        status: 'active',
        is_ai: false,
        contest: nextContest,
        contest_date: nextContestDate
    }]).catch(err => console.error('Erro ao salvar aposta:', err));
    
    closeQuickBetModal();
    
    if (typeof window.updateBalanceDisplays === 'function') {
        window.updateBalanceDisplays();
    }
    
    if (typeof window.saveData === 'function') {
        window.saveData();
    }
    
    if (typeof window.showToast === 'function') {
        window.showToast(`Aposta de R$ ${value.toFixed(2).replace('.', ',')} realizada com sucesso!`, 'success');
    }
    
    const resultsPanel = document.getElementById('qg-panel-results');
    if (resultsPanel && !resultsPanel.classList.contains('hidden') && typeof window.filterQgResults === 'function') {
        const activeBtn = document.querySelector('#qg-results-filter .filter-btn.active');
        window.filterQgResults(activeBtn?.dataset?.filter || 'active');
    }
}

export default {
    initQuickGames,
    showQuickGames,
    selectDailyGame,
    selectQgLottery,
    switchQgTab,
    betOnDailyGame,
    closeQuickBetModal,
    confirmQuickBet
};
