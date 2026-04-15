/**
 * Betting Module - Lógica principal de apostas
 * @module features/betting
 */

import { state, officialResults } from '../core/state.js';
import { lotteries, modeDescriptions, calculateBetValue, generateRandomNumbers, CUTOFF_HOUR, CUTOFF_MINUTE, DRAW_HOUR, DRAW_MINUTE } from '../core/config.js';
import { showScreen } from '../core/navigation.js';
import { Utils } from '../utils/utils.js';
import { Validators } from '../utils/validators.js';
import { ErrorHandler } from '../utils/errors.js';
import { apiSaveBets, apiSaveTransaction } from '../api-client.js';

/**
 * Dias de sorteio por loteria
 * 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
 */
const DRAW_DAYS = {
    megasena: [2, 4, 6],      // Terça, Quinta, Sábado
    lotofacil: [1, 2, 3, 4, 5, 6], // Segunda a Sábado
    quina: [1, 2, 3, 4, 5, 6] // Segunda a Sábado
};

/**
 * Verifica se as apostas estão abertas para o sorteio de hoje
 * @returns {boolean} true se ainda pode apostar para hoje
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
 * Verifica se hoje é dia de sorteio para a loteria
 * @param {string} lotteryId - ID da loteria
 * @returns {boolean}
 */
function isTodayDrawDay(lotteryId) {
    const drawDays = DRAW_DAYS[lotteryId] || [1, 2, 3, 4, 5, 6];
    const today = new Date().getDay();
    return drawDays.includes(today);
}

/**
 * Obtém informações sobre o status das apostas
 * @returns {Object}
 */
function getBettingStatus() {
    const canBetToday = canBetForToday();
    const now = new Date();
    
    return {
        canBetForToday: canBetToday,
        cutoffTime: `${String(CUTOFF_HOUR).padStart(2, '0')}:${String(CUTOFF_MINUTE).padStart(2, '0')}`,
        drawTime: `${String(DRAW_HOUR).padStart(2, '0')}:${String(DRAW_MINUTE).padStart(2, '0')}`,
        currentTime: now.toLocaleTimeString('pt-BR'),
        message: canBetToday 
            ? 'Apostas abertas para o sorteio de hoje' 
            : 'Apostas agora valem para o próximo sorteio'
    };
}

/**
 * Abre a tela de apostas para uma loteria
 * @param {string} lotteryId - ID da loteria
 * @param {string} mode - Modo de aposta (manual ou ai)
 */
export function openBetting(lotteryId, mode = 'manual') {
    state.currentLottery = lotteryId;
    state.selectedNumbers = [];
    state.currentMode = mode;
    if (mode === 'manual') {
        state.pendingBets = [];
    }
    
    const lottery = lotteries[lotteryId];
    
    // Adiciona classe da loteria para estilo dinâmico
    const screenEl = document.getElementById('screen-betting');
    if (screenEl) {
        screenEl.classList.remove('bet-lotofacil', 'bet-megasena', 'bet-quina');
        screenEl.classList.add(`bet-${lotteryId}`);
    }
    
    // Atualiza logo
    const bettingLogo = document.getElementById('betting-logo');
    if (bettingLogo) {
        bettingLogo.src = lottery.logo;
        bettingLogo.alt = lottery.name;
    }
    
    // Atualiza número do concurso
    const contestInfo = document.getElementById('betting-contest-info');
    if (contestInfo) {
        const nextContest = getNextContestNumber(lotteryId);
        contestInfo.textContent = `Concurso ${nextContest}`;
    }
    
    // Exibe a data do sorteio e countdown (igual home)
    const drawDateEl = document.getElementById('betting-draw-date');
    const countdownEl = document.getElementById('betting-countdown');
    const nextDate = getNextContestDate(lotteryId);
    
    console.log('[Betting] Data do próximo sorteio:', lotteryId, nextDate);
    
    if (drawDateEl) {
        if (nextDate) {
            drawDateEl.textContent = `Sorteio: ${formatDrawDateLabelBetting(nextDate)}`;
        } else {
            drawDateEl.textContent = 'Sorteio: Em breve';
        }
    }
    
    // Inicia countdown na tela de apostas
    if (countdownEl) {
        if (nextDate) {
            startBettingCountdown(nextDate, countdownEl);
        } else {
            countdownEl.textContent = '⏰ Aguardando dados...';
        }
    }
    
    document.getElementById('max-numbers').textContent = lottery.minNumbers;
    
    // Reset mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('mode-manual').classList.add('active');

    // Esconde opções de modo e mostra modo escolhido
    const modesEl = document.querySelector('.betting-modes');
    const selectedEl = document.getElementById('mode-selected');
    if (modesEl) modesEl.classList.add('hidden');
    if (selectedEl) selectedEl.classList.add('visible');
    
    // Gera grid de números
    generateNumberGrid(lotteryId);
    
    // Renderiza números quentes/frios
    if (typeof window.renderHotColdNumbers === 'function') {
        window.renderHotColdNumbers(lotteryId);
    }
    
    // Exibe tela de apostas
    showScreen('betting');
    
    // Define modo inicial
    setMode(mode);
    renderGeneratedBets();
}

/**
 * Gera o grid de números para seleção
 * @param {string} lotteryId - ID da loteria
 */
export function generateNumberGrid(lotteryId) {
    const lottery = lotteries[lotteryId];
    const grid = document.getElementById('number-grid');
    
    if (!grid) return;
    
    grid.innerHTML = '';
    
    for (let i = 1; i <= lottery.maxNumber; i++) {
        const btn = document.createElement('button');
        btn.className = 'number-btn';
        btn.textContent = String(i).padStart(2, '0');
        btn.setAttribute('aria-label', `Selecionar número ${i}`);
        btn.setAttribute('role', 'checkbox');
        btn.setAttribute('aria-checked', 'false');
        btn.onclick = () => toggleNumber(i);
        btn.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleNumber(i);
            }
        };
        grid.appendChild(btn);
    }
}

/**
 * Alterna a seleção de um número
 * @param {number} number - Número a alternar
 */
export function toggleNumber(number) {
    const idx = state.selectedNumbers.indexOf(number);
    const lottery = lotteries[state.currentLottery];
    
    if (idx === -1) {
        if (state.selectedNumbers.length < lottery.maxNumbers) {
            state.selectedNumbers.push(number);
            state.selectedNumbers.sort((a, b) => a - b);
        }
    } else {
        state.selectedNumbers.splice(idx, 1);
    }
    
    updateNumberDisplay();
    updateBetValue();
}

/**
 * Define o modo de aposta
 * @param {string} mode - Modo (manual ou ai)
 */
export function setMode(mode) {
    state.currentMode = mode;
    state.selectedNumbers = [];
    
    // Atualiza estilos dos botões
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`mode-${mode}`)?.classList.add('active');
    
    // Atualiza descrição
    const description = modeDescriptions[mode];
    const descEl = document.getElementById('mode-description');
    if (descEl) {
        descEl.innerHTML = `<i data-lucide="${description.icon}"></i><span>${description.text}</span>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Atualiza display do modo selecionado
    const selectedValue = document.getElementById('mode-selected-value');
    const selectedIcon = document.getElementById('mode-selected-icon');
    if (selectedValue) selectedValue.textContent = description.label;
    if (selectedIcon) {
        selectedIcon.innerHTML = `<i data-lucide="${description.icon}"></i>`;
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // Atualiza visibilidade do grid
    const numberGrid = document.getElementById('number-grid');
    if (mode === 'manual') {
        if (numberGrid) numberGrid.classList.remove('hidden');
    } else {
        if (numberGrid) numberGrid.classList.add('hidden');
        if (state.pendingBets.length === 0 && mode === 'ai') {
            generateAINumbers();
        }
    }
    
    updateNumberDisplay();
    updateBetValue();
}

/**
 * Gera números usando IA
 */
export function generateAINumbers() {
    const lottery = lotteries[state.currentLottery];
    state.selectedNumbers = [];
    
    const available = Array.from({length: lottery.maxNumber}, (_, i) => i + 1);
    for (let i = 0; i < lottery.minNumbers; i++) {
        const idx = Math.floor(Math.random() * available.length);
        state.selectedNumbers.push(available[idx]);
        available.splice(idx, 1);
    }
    
    state.selectedNumbers.sort((a, b) => a - b);
    updateNumberDisplay();
    updateBetValue();
}

/**
 * Adiciona o jogo manual atual à lista de jogos pendentes e reseta o grid
 */
export function addManualGame() {
    const lottery = lotteries[state.currentLottery];
    if (!lottery) return;
    
    // Verifica se tem números mínimos selecionados
    if (state.selectedNumbers.length < lottery.minNumbers) return;
    
    // Salva o jogo atual nos pendentes
    state.pendingBets.push([...state.selectedNumbers]);
    
    // Reseta os números selecionados
    state.selectedNumbers = [];
    
    // Atualiza tudo
    updateNumberDisplay();
    updateBetValue();
    renderGeneratedBets();
}

/**
 * Atualiza o display de números selecionados
 */
export function updateNumberDisplay() {
    const selectedBalls = document.getElementById('selected-balls');
    const selectedCount = document.getElementById('selected-count');
    const selectedNumbersSection = document.getElementById('selected-numbers');
    const addGameBtn = document.getElementById('btn-add-game');
    const lottery = lotteries[state.currentLottery];
    
    // Seção de números selecionados: mostrar no modo manual (mesmo com jogos pendentes)
    if (selectedNumbersSection) {
        if (state.currentMode !== 'manual') {
            selectedNumbersSection.classList.add('hidden');
        } else {
            selectedNumbersSection.classList.remove('hidden');
        }
    }
    
    if (selectedBalls) {
        selectedBalls.innerHTML = state.selectedNumbers
            .map(num => `<span class="selected-ball">${String(num).padStart(2, '0')}</span>`)
            .join('');
    }
    
    if (selectedCount) {
        selectedCount.textContent = state.selectedNumbers.length;
    }

    renderGeneratedBets();
    
    // Atualiza botões do grid
    document.querySelectorAll('.number-btn').forEach(btn => {
        const num = parseInt(btn.textContent);
        const isSelected = state.selectedNumbers.includes(num);
        if (isSelected) {
            btn.classList.add('selected');
            btn.setAttribute('aria-checked', 'true');
        } else {
            btn.classList.remove('selected');
            btn.setAttribute('aria-checked', 'false');
        }
    });
    
    // Mostra/esconde botão "+ ADICIONAR JOGO" no modo manual
    if (addGameBtn) {
        if (state.currentMode === 'manual' && lottery && state.selectedNumbers.length >= lottery.minNumbers) {
            addGameBtn.classList.remove('hidden');
        } else {
            addGameBtn.classList.add('hidden');
        }
    }
    
    // Atualiza botão de confirmar
    const confirmBtn = document.getElementById('btn-confirm');
    if (confirmBtn && lottery) {
        if (state.pendingBets.length > 0) {
            confirmBtn.disabled = false;
        } else {
            confirmBtn.disabled = state.selectedNumbers.length < lottery.minNumbers;
        }
    }
}

/**
 * Atualiza o valor da aposta
 */
export function updateBetValue() {
    const lottery = lotteries[state.currentLottery];
    if (!lottery) return;

    let totalValue = 0;
    
    // Soma valor dos jogos já pendentes
    if (state.pendingBets.length > 0) {
        totalValue = state.pendingBets.reduce((sum, numbers) => sum + calculateBetValue(state.currentLottery, numbers), 0);
    }
    
    // Soma valor do jogo em construção (manual) se tem números suficientes
    if (state.currentMode === 'manual' && state.selectedNumbers.length >= lottery.minNumbers) {
        totalValue += calculateBetValue(state.currentLottery, state.selectedNumbers);
    } else if (state.pendingBets.length === 0) {
        // Se não tem pendentes e está selecionando, mostra o valor parcial
        totalValue = calculateBetValue(state.currentLottery, state.selectedNumbers);
    }

    const valueEl = document.getElementById('bet-price');
    const countEl = document.getElementById('bet-count');
    if (valueEl) {
        valueEl.textContent = Utils.formatCurrency(totalValue);
    }
    if (countEl) {
        // Conta jogos pendentes + jogo em construção (se completo)
        let betsCount = state.pendingBets.length;
        if (state.currentMode === 'manual' && state.selectedNumbers.length >= lottery.minNumbers) {
            betsCount += 1;
        }
        betsCount = Math.max(1, betsCount);
        countEl.textContent = betsCount === 1 ? '(1 jogo)' : `(${betsCount} jogos)`;
    }
}

/**
 * Renderiza as apostas geradas
 */
export function renderGeneratedBets() {
    const container = document.getElementById('generated-bets');
    const list = document.getElementById('generated-list');
    const iaHeader = document.getElementById('ia-generated-header');
    if (!container || !list) return;

    if (state.pendingBets.length === 0) {
        container.classList.add('hidden');
        container.classList.remove('visible');
        list.innerHTML = '';
        if (iaHeader) iaHeader.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    container.classList.add('visible');
    
    if (iaHeader) {
        if (state.currentMode === 'ai') {
            iaHeader.classList.remove('hidden');
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        } else {
            iaHeader.classList.add('hidden');
        }
    }

    const lotteryColor = lotteries[state.currentLottery]?.color || '#005CA9';
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
    const fibSet = getFibonacciSet(80);

    const lotteryName = lotteries[state.currentLottery]?.name || 'Loteria';
    const isAIMode = state.currentMode === 'ai';
    const nextContest = getNextContestNumber(state.currentLottery);
    
    const aiBadgeHtml = isAIMode ? `
        <div class="generated-ai-badge-inline">
            <img src="assets/logo-ai-branca.png" alt="IA" class="ai-badge-logo">
        </div>
    ` : '';
    
    list.innerHTML = state.pendingBets.map((numbers, index) => `
        <div class="generated-item ${isAIMode ? 'generated-item-ai' : ''}" style="--lottery-color: ${lotteryColor};">
            <div class="generated-item-header-bar">
                <div class="generated-item-title-group">
                    <span class="generated-item-title">Aposta ${index + 1}</span>
                    <span class="generated-item-contest">Concurso ${nextContest}</span>
                </div>
                <div class="header-actions">
                    ${aiBadgeHtml}
                    <button class="share-btn" onclick="shareGame('${lotteryName}', [${numbers.join(',')}], ${isAIMode})" title="Compartilhar jogo">
                        <i data-lucide="share-2"></i>
                    </button>
                </div>
            </div>
            <div class="generated-item-body">
                <div class="generated-item-numbers-grid">
                    ${numbers.map(num => `<span class="generated-number-ball">${String(num).padStart(2, '0')}</span>`).join('')}
                </div>
            </div>
            <div class="generated-item-stats">
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
    `).join('');
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ==================== DATA / COUNTDOWN BETTING ====================

const DAY_NAMES_BETTING = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
let bettingCountdownInterval = null;

/**
 * Parseia data no formato brasileiro dd/mm/yyyy
 */
function parseDateBRBetting(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Formata data do sorteio: Hoje/Amanhã/Dia da semana + "às 21h"
 * Também indica se as apostas já encerraram para o sorteio de hoje
 */
function formatDrawDateLabelBetting(dateStr) {
    const drawDate = parseDateBRBetting(dateStr);
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
        return `${DAY_NAMES_BETTING[drawDate.getDay()]} às 21h`;
    }
}

/**
 * Inicia countdown na tela de apostas
 * O countdown mostra o tempo até o HORÁRIO DE CORTE (20:50), não até o sorteio
 */
function startBettingCountdown(dateStr, el) {
    if (bettingCountdownInterval) clearInterval(bettingCountdownInterval);
    
    const drawDate = parseDateBRBetting(dateStr);
    if (!drawDate) {
        el.textContent = '';
        return;
    }
    
    // Define o horário de CORTE (20:50), não o horário do sorteio
    const cutoffDate = new Date(drawDate);
    cutoffDate.setHours(CUTOFF_HOUR, CUTOFF_MINUTE, 0, 0);
    
    function updateBettingCountdown() {
        const now = new Date();
        const diff = cutoffDate.getTime() - now.getTime();
        
        if (diff <= 0) {
            el.innerHTML = '⏰ <span class="cutoff-closed">Apostas agora valem para o próximo sorteio</span>';
            clearInterval(bettingCountdownInterval);
            
            // Atualiza informação do concurso para mostrar que vai para o próximo
            const contestInfo = document.getElementById('betting-contest-info');
            if (contestInfo && state.currentLottery) {
                const nextContest = getNextContestNumber(state.currentLottery);
                contestInfo.innerHTML = `Concurso ${nextContest + 1} <span class="next-contest-badge">(próximo)</span>`;
            }
            return;
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
    
    updateBettingCountdown();
    bettingCountdownInterval = setInterval(updateBettingCountdown, 30000);
}

// ==================== CONTEST HELPERS ====================

/**
 * Obtém o número do próximo concurso para uma loteria
 * Considera o horário de corte: após 20:50, retorna o concurso seguinte
 * @param {string} lotteryId - ID da loteria
 * @returns {number} - Número do próximo concurso disponível para apostas
 */
function getNextContestNumber(lotteryId) {
    const results = officialResults[lotteryId];
    if (results && results.length > 0) {
        const lastResult = results[0];
        const baseContest = (lastResult.contest || 0) + 1;
        
        // Se passou do horário de corte E hoje é dia de sorteio,
        // o concurso de hoje já fechou, então retorna +2
        if (!canBetForToday() && isTodayDrawDay(lotteryId)) {
            return baseContest + 1;
        }
        
        return baseContest;
    }
    // Fallback: retorna null para o UI exibir "---" até os resultados carregarem
    return null;
}

/**
 * Obtém a data do próximo sorteio para uma loteria
 * Considera o horário de corte: após 20:50, calcula a próxima data disponível
 * @param {string} lotteryId - ID da loteria
 * @returns {string} - Data do próximo sorteio disponível para apostas
 */
function getNextContestDate(lotteryId) {
    const results = officialResults[lotteryId];
    
    // Se passou do horário de corte, precisamos calcular a próxima data
    if (!canBetForToday() && isTodayDrawDay(lotteryId)) {
        return calculateNextDrawDate(lotteryId);
    }
    
    if (results && results.length > 0) {
        const lastResult = results[0];
        // Tenta pegar de proximoConcurso.data
        if (lastResult.proximoConcurso && lastResult.proximoConcurso.data) {
            return lastResult.proximoConcurso.data;
        }
        // Tenta campo dataProximoConcurso
        if (lastResult.dataProximoConcurso) {
            return lastResult.dataProximoConcurso;
        }
        // Tenta nextDate
        if (lastResult.nextDate) {
            return lastResult.nextDate;
        }
        console.log('[Betting] Estrutura do resultado para', lotteryId, ':', JSON.stringify(Object.keys(lastResult)));
    }
    return null;
}

/**
 * Calcula a próxima data de sorteio para uma loteria
 * @param {string} lotteryId - ID da loteria
 * @returns {string} - Data no formato dd/mm/yyyy
 */
function calculateNextDrawDate(lotteryId) {
    const drawDays = DRAW_DAYS[lotteryId] || [1, 2, 3, 4, 5, 6];
    const today = new Date();
    
    // Começa a partir de amanhã
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() + 1);
    
    // Procura nos próximos 7 dias
    for (let i = 0; i < 7; i++) {
        if (drawDays.includes(checkDate.getDay())) {
            const day = String(checkDate.getDate()).padStart(2, '0');
            const month = String(checkDate.getMonth() + 1).padStart(2, '0');
            const year = checkDate.getFullYear();
            return `${day}/${month}/${year}`;
        }
        checkDate.setDate(checkDate.getDate() + 1);
    }
    
    // Fallback: amanhã
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const year = tomorrow.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Adiciona uma aposta ao estado
 * @param {string} lotteryId - ID da loteria
 * @param {Array} numbers - Números da aposta
 */
export function addBetToState(lotteryId, numbers) {
    const lottery = lotteries[lotteryId];
    const value = calculateBetValue(lotteryId, numbers);
    const betId = Utils.generateId();
    const isAIGenerated = state.currentMode === 'ai';
    
    // Busca o próximo concurso real da API
    const nextContest = getNextContestNumber(lotteryId);
    const nextContestDate = getNextContestDate(lotteryId);
    const dateStr = Utils.formatDate(new Date());

    const betObj = {
        id: betId,
        lotteryId: lotteryId,
        lotteryName: lottery.name,
        numbers: [...numbers],
        value: value,
        status: 'active',
        date: dateStr,
        contest: nextContest,
        contestDate: nextContestDate,
        isAI: isAIGenerated
    };

    state.bets.unshift(betObj);
    state.balance -= value;

    const txObj = {
        id: betId,
        type: 'bet',
        lottery: lottery.name,
        value: value,
        date: dateStr
    };
    state.transactions.unshift(txObj);

    // Persiste no banco de dados (fire-and-forget)
    apiSaveBets([{
        lottery_id: lotteryId,
        lottery_name: lottery.name,
        numbers: [...numbers],
        value: value,
        status: 'active',
        date: dateStr,
        contest: nextContest
    }]).catch(err => console.warn('[API] Erro ao salvar aposta:', err));

    apiSaveTransaction({
        type: 'bet',
        lottery: lottery.name,
        value: value,
        date: dateStr
    }).catch(err => console.warn('[API] Erro ao salvar transação:', err));
}

/**
 * Prepara apostas automáticas
 * @param {string} lotteryId - ID da loteria
 * @param {string} mode - Modo de geração
 * @param {number} count - Quantidade de apostas
 */
export function prepareAutoBets(lotteryId, mode, count) {
    return ErrorHandler.wrapSync(() => {
        if (typeof window.Loading !== 'undefined') {
            window.Loading.show(`Gerando ${count} jogo${count === 1 ? '' : 's'}...`);
        }
        
        setTimeout(() => {
            const pending = [];
            for (let i = 0; i < count; i++) {
                pending.push(generateRandomNumbers(lotteryId));
            }

            state.pendingBets = pending;
            if (typeof window.Loading !== 'undefined') {
                window.Loading.hide();
            }
            openBetting(lotteryId, mode);
            renderGeneratedBets();
            updateBetValue();
        }, 500);
    }, 'prepareAutoBets');
}

/**
 * Confirma a aposta
 */
export function confirmBet() {
    return ErrorHandler.wrapSync(() => {
        const lottery = lotteries[state.currentLottery];
        
        // Se tem números selecionados no grid (jogo em construção), adiciona aos pendentes
        if (state.currentMode === 'manual' && state.selectedNumbers.length >= lottery.minNumbers) {
            state.pendingBets.push([...state.selectedNumbers]);
            state.selectedNumbers = [];
        }
        
        if (state.pendingBets.length > 0) {
            const totalValue = state.pendingBets.reduce((sum, numbers) => sum + calculateBetValue(state.currentLottery, numbers), 0);
            const validation = Validators.validateMultipleBets(
                state.pendingBets,
                lottery,
                totalValue,
                state.balance
            );

            if (!validation.valid) {
                if (validation.error === 'Saldo insuficiente') {
                    if (typeof window.showBalanceModal === 'function') {
                        window.showBalanceModal(totalValue);
                    }
                    return;
                }
                if (typeof window.showToast === 'function') {
                    window.showToast(validation.error, 'error');
                }
                return;
            }

            const betsCount = state.pendingBets.length;
            const nextContest = getNextContestNumber(state.currentLottery);
            const betData = {
                lottery: lottery.name,
                count: betsCount,
                value: totalValue,
                gamesCount: betsCount,
                lotteryType: state.currentLottery,
                contestNumber: nextContest
            };
            
            if (typeof window.BetConfirmationAnimation !== 'undefined') {
                window.BetConfirmationAnimation.start(betData, () => {
                    state.pendingBets.forEach(numbers => {
                        addBetToState(state.currentLottery, numbers);
                    });
                    
                    state.pendingBets = [];
                    renderGeneratedBets();
                    if (typeof window.updateBalanceDisplays === 'function') {
                        window.updateBalanceDisplays();
                    }
                    if (typeof window.saveData === 'function') {
                        window.saveData();
                    }
                });
            } else {
                state.pendingBets.forEach(numbers => {
                    addBetToState(state.currentLottery, numbers);
                });
                
                state.pendingBets = [];
                renderGeneratedBets();
                if (typeof window.updateBalanceDisplays === 'function') {
                    window.updateBalanceDisplays();
                }
                if (typeof window.saveData === 'function') {
                    window.saveData();
                }

                const plural = betsCount === 1 ? 'aposta' : 'apostas';
                if (typeof window.showSuccessModal === 'function') {
                    window.showSuccessModal(`${betsCount} ${plural} realizada${betsCount === 1 ? '' : 's'} com sucesso!`);
                }
                showScreen('my-bets');
            }
            return;
        }

        const numbersValidation = Validators.validateLotteryNumbers(state.selectedNumbers, lottery);
        if (!numbersValidation.valid) {
            if (typeof window.showToast === 'function') {
                window.showToast(numbersValidation.error, 'error');
            }
            return;
        }

        const value = calculateBetValue(state.currentLottery, state.selectedNumbers);
        const balanceValidation = Validators.validateBetBalance(value, state.balance);
        if (!balanceValidation.valid) {
            if (balanceValidation.error === 'Saldo insuficiente') {
                if (typeof window.showBalanceModal === 'function') {
                    window.showBalanceModal(value);
                }
                return;
            }
            if (typeof window.showToast === 'function') {
                window.showToast(balanceValidation.error, 'error');
            }
            return;
        }

        const nextContestManual = getNextContestNumber(state.currentLottery);
        const betData = {
            lottery: lottery.name,
            count: 1,
            value: value,
            gamesCount: 1,
            lotteryType: state.currentLottery,
            contestNumber: nextContestManual
        };
        
        if (typeof window.BetConfirmationAnimation !== 'undefined') {
            window.BetConfirmationAnimation.start(betData, () => {
                addBetToState(state.currentLottery, state.selectedNumbers);
                if (typeof window.updateBalanceDisplays === 'function') {
                    window.updateBalanceDisplays();
                }
                if (typeof window.saveData === 'function') {
                    window.saveData();
                }
            });
        } else {
            addBetToState(state.currentLottery, state.selectedNumbers);
            if (typeof window.updateBalanceDisplays === 'function') {
                window.updateBalanceDisplays();
            }
            if (typeof window.saveData === 'function') {
                window.saveData();
            }

            if (typeof window.showSuccessModal === 'function') {
                window.showSuccessModal('1 aposta realizada com sucesso!');
            }
            showScreen('home');
        }
    }, 'confirmBet');
}

// Exporta funções de concurso para uso em outros módulos
export { getNextContestNumber, getNextContestDate };

export default {
    openBetting,
    generateNumberGrid,
    toggleNumber,
    setMode,
    generateAINumbers,
    updateNumberDisplay,
    updateBetValue,
    renderGeneratedBets,
    addBetToState,
    prepareAutoBets,
    confirmBet,
    getNextContestNumber,
    getNextContestDate
};
