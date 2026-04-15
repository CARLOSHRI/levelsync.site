/**
 * Renders Module - Funções de renderização de UI
 * @module ui/renders
 */

import { state, officialResults } from '../core/state.js';
import { lotteries } from '../core/config.js';
import { ConfettiAnimation } from '../utils/confetti.js';

/** Alterna expandir/recolher um concurso no accordion */
export function toggleContestAccordion(contestKey, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const item = container.querySelector(`[data-contest-key="${contestKey}"]`);
    if (item) item.classList.toggle('expanded');
}

/**
 * Filtra e renderiza apostas
 * @param {string} filter - Filtro (active, won, lost)
 */
export function filterBets(filter) {
    state.currentBetsFilter = filter;
    
    // Atualiza botões de filtro
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filter) {
            btn.classList.add('active');
        }
    });
    
    renderBets(filter);
    
    // Dispara confetti ao visualizar apostas ganhas
    if (filter === 'won') {
        const wonBets = state.bets.filter(bet => bet.status === 'won');
        if (wonBets.length > 0 && ConfettiAnimation) {
            setTimeout(() => {
                ConfettiAnimation.start(3500);
            }, 300);
        }
    }
}

/**
 * Ordena apostas por data (mais recente primeiro)
 */
function sortBetsByDateDesc(bets) {
    return [...bets].sort((a, b) => {
        const dateA = parseBetDate(a);
        const dateB = parseBetDate(b);
        return dateB - dateA;
    });
}

function parseBetDate(bet) {
    const str = bet.date || bet.created_at || bet.createdAt || '';
    if (!str) return 0;
    if (str.includes('T')) return new Date(str).getTime();
    const parts = str.split(/[/-]/);
    if (parts.length >= 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        if (parts[0].length <= 2) return new Date(y, m, d).getTime();
        return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
    }
    return 0;
}

/**
 * Agrupa apostas por concurso. Grupos ordenados por concurso (maior primeiro = sorteio atual).
 * Apostas dentro de cada grupo ordenadas por data (mais recente primeiro).
 */
function groupBetsByContest(bets) {
    const groups = new Map();
    for (const bet of bets) {
        const key = String(bet.contest || '');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(bet);
    }
    const arr = Array.from(groups.entries());
    arr.sort((a, b) => {
        const numA = parseInt(a[0], 10) || 0;
        const numB = parseInt(b[0], 10) || 0;
        return numB - numA;
    });
    return arr.map(([, groupBets]) => sortBetsByDateDesc(groupBets));
}

/**
 * Agrupa apostas por loteria e concurso (para tela com todas as loterias).
 * Retorna array de { key, bets } ordenado por concurso (maior primeiro).
 */
function groupBetsByLotteryAndContest(bets) {
    const groups = new Map();
    for (const bet of bets) {
        const lotId = bet.lotteryId || bet.lottery_id || '';
        const contest = String(bet.contest || '');
        const key = `${lotId}-${contest}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(bet);
    }
    const arr = Array.from(groups.entries()).map(([key, groupBets]) => ({
        key,
        bets: sortBetsByDateDesc(groupBets)
    }));
    arr.sort((a, b) => {
        const numA = parseInt((a.bets[0]?.contest || ''), 10) || 0;
        const numB = parseInt((b.bets[0]?.contest || ''), 10) || 0;
        return numB - numA;
    });
    return arr;
}

/**
 * Renderiza apostas filtradas por loteria (para Jogos do Dia - aba Resultados)
 * Agrupa apostas do mesmo concurso em um único card
 * @param {string} lotteryId - ID da loteria
 * @param {string} filter - Filtro (active, won, lost)
 * @param {string} containerId - ID do container (ex: qg-results-list)
 */
export function renderBetsForLottery(lotteryId, filter = 'active', containerId = 'qg-results-list') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (containerId === 'qg-results-list') {
        container.dataset.filter = filter;
    }

    const filteredBets = state.bets.filter(bet => {
        const lotId = bet.lotteryId || bet.lottery_id || '';
        return lotId === lotteryId && bet.status === filter;
    });

    if (filteredBets.length === 0) {
        const messages = {
            active: 'Nenhuma aposta ativa para esta loteria',
            won: 'Nenhuma aposta ganha para esta loteria',
            lost: 'Nenhuma aposta perdida para esta loteria'
        };
        const msg = messages[filter] || 'Nenhuma aposta encontrada para esta loteria';
        container.innerHTML = `<div class="empty-state"><p>${msg}</p></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    const groups = groupBetsByContest(filteredBets);

    // Em ganhou/perdeu: accordion - lista de concursos, clicável para expandir/recolher
    const useAccordion = (filter === 'won' || filter === 'lost') && groups.length > 1;

    container.innerHTML = groups.map((bets, groupIdx) => {
        const bet = bets[0];
        const lotId = bet.lotteryId || bet.lottery_id || '';
        const lotName = bet.lotteryName || bet.lottery_name || '';
        const lottery = lotteries[lotId];
        const lotColor = lottery?.color || '#005CA9';
        const lotLogo = lottery?.logo || '';

        let statusText = 'Aguardando sorteio...';
        let statusClass = 'pending';
        if (filter === 'won') {
            statusText = '✓ Ganhou';
            statusClass = 'won';
        } else if (filter === 'lost') {
            statusText = '✗ Perdeu';
            statusClass = 'lost';
        }

        const contestInfo = `Concurso: <strong>${bet.contest || '-'}</strong>`;
        let sorteieDateInfo = '';
        if (bet.contestDate && filter === 'active') {
            sorteieDateInfo = `<span class="bet-sorteio-date">Sorteio: ${bet.contestDate}</span>`;
        }

        const betCountLabel = bets.length > 1 ? `<span class="bet-group-count">${bets.length} jogos</span>` : '';

        const gamesHtml = bets.map((b, idx) => {
            let rightHtml = '';
            if (filter === 'won' && b.hits !== undefined) {
                rightHtml = `<span class="bet-group-hits">${b.hits} acerto${b.hits !== 1 ? 's' : ''}</span>`;
            } else if (filter === 'lost' && b.hits !== undefined) {
                rightHtml = `<span class="bet-group-stats bet-group-stats-lost"><span class="bet-group-stats-value">${b.hits}</span><span class="bet-group-stats-label">acerto${b.hits !== 1 ? 's' : ''}</span></span>`;
            }
            const aiBadge = (b.isAI || b.is_ai) ? '<img src="assets/logo-ai-branca.png" alt="IA" class="bet-ai-logo bet-ai-logo-small">' : '';
            const labelHtml = (bets.length > 1 || rightHtml) ? `<span class="bet-group-item-label">Jogo ${idx + 1}</span>` : '';
            const prizeHtml = (filter === 'won' && b.prize) ? `<div class="bet-group-prize-row"><span class="bet-group-prize">R$ ${b.prize.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>` : '';
            const hasHeaderContent = labelHtml || rightHtml || aiBadge;
            return `
                <div class="bet-group-item" data-lottery="${lotId}">
                    ${hasHeaderContent ? `
                    <div class="bet-group-item-header">
                        <div class="bet-group-item-header-left">
                            ${labelHtml}
                            ${aiBadge}
                        </div>
                        ${rightHtml ? `<div class="bet-group-item-header-right">${rightHtml}</div>` : ''}
                    </div>
                    ` : ''}
                    <div class="bet-card-numbers bet-group-numbers">
                        ${b.numbers.map(n => `<span class="bet-number-ball" style="--lottery-color: ${lotColor};">${String(n).padStart(2, '0')}</span>`).join('')}
                    </div>
                    ${prizeHtml}
                </div>
            `;
        }).join('');

        let drawnNumbersHtml = '';
        let drawnNumbers = null;
        const firstWithDrawn = bets.find(b => b.drawnNumbers && b.drawnNumbers.length > 0);
        if (firstWithDrawn) {
            drawnNumbers = firstWithDrawn.drawnNumbers;
        } else if ((filter === 'won' || filter === 'lost') && bet.contest) {
            const results = officialResults[lotId];
            if (results && results.length > 0) {
                const contestNum = parseInt(bet.contest, 10);
                const match = results.find(r => parseInt(r.contest, 10) === contestNum);
                if (match && match.numbers) drawnNumbers = match.numbers;
            }
        }
        if (drawnNumbers && drawnNumbers.length > 0 && (filter === 'won' || filter === 'lost')) {
            drawnNumbersHtml = `
                <div class="bet-card-divider"></div>
                <div class="bet-drawn-section">
                    <span class="bet-drawn-label">Números sorteados:</span>
                    <div class="bet-drawn-numbers">
                        ${drawnNumbers.map(n => {
                            const anyHit = bets.some(b => (b.numbers || []).map(Number).includes(Number(n)));
                            return `<span class="bet-drawn-ball ${anyHit ? 'hit' : ''}">${String(n).padStart(2, '0')}</span>`;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        const datesLabel = bets.length === 1 ? `Aposta: ${bet.date}` : 'Apostas realizadas';

        const contestKey = `qg-${lotteryId}-${bet.contest}`;
        const isFirst = groupIdx === 0;
        const cardHtml = `
            <div class="bet-card bet-card-modern bet-card-grouped">
                <div class="bet-card-header ${statusClass}" style="--lottery-color: ${lotColor};">
                    <span class="bet-card-status">${statusText}</span>
                    <div class="bet-card-header-right">
                        ${betCountLabel}
                    </div>
                </div>
                <div class="bet-card-body">
                    <div class="bet-card-meta">
                        <div class="bet-lottery">
                            <img src="${lotLogo}" alt="${lotName}" class="bet-lottery-logo">
                        </div>
                        <span>${contestInfo}</span>
                        ${sorteieDateInfo}
                        <span class="bet-aposta-date">${datesLabel}</span>
                    </div>
                    <div class="bet-card-divider"></div>
                    <div class="bet-group-games">
                        ${gamesHtml}
                    </div>
                    ${drawnNumbersHtml}
                </div>
            </div>
        `;

        if (useAccordion) {
            return `
                <div class="contest-accordion-item ${isFirst ? 'expanded' : ''}" data-contest-key="${contestKey}">
                    <button type="button" class="contest-accordion-header" onclick="typeof toggleContestAccordion==='function'&&toggleContestAccordion('${contestKey}','${containerId}')">
                        <span class="contest-accordion-title">Concurso ${bet.contest || '-'}</span>
                        <span class="contest-accordion-meta">${bets.length} jogo${bets.length !== 1 ? 's' : ''}</span>
                        <i data-lucide="chevron-down" class="contest-accordion-chevron"></i>
                    </button>
                    <div class="contest-accordion-body">${cardHtml}</div>
                </div>
            `;
        }
        return cardHtml;
    }).join('');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Renderiza lista de apostas
 * @param {string} filter - Filtro (active, won, lost)
 */
export function renderBets(filter = 'active') {
    const container = document.getElementById('bets-list');
    if (!container) return;

    const filteredBets = state.bets.filter(bet => bet.status === filter);

    if (filteredBets.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Nenhuma aposta encontrada</p></div>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    // Em ganhou/perdeu com múltiplos concursos: accordion por concurso
    const groups = groupBetsByLotteryAndContest(filteredBets);
    const useAccordion = (filter === 'won' || filter === 'lost') && groups.length > 1;

    if (useAccordion) {
        container.innerHTML = groups.map(({ key, bets }, groupIdx) => {
            const bet = bets[0];
            const lotId = bet.lotteryId || bet.lottery_id || '';
            const lotName = bet.lotteryName || bet.lottery_name || '';
            const lottery = lotteries[lotId];
            const contestKey = `bets-${key}`;
            const isFirst = groupIdx === 0;
            const cardsHtml = bets.map(b => renderSingleBetCard(b, filter)).join('');
            return `
                <div class="contest-accordion-item ${isFirst ? 'expanded' : ''}" data-contest-key="${contestKey}">
                    <button type="button" class="contest-accordion-header" onclick="typeof toggleContestAccordion==='function'&&toggleContestAccordion('${contestKey}','bets-list')">
                        <span class="contest-accordion-title">${lotName} — Concurso ${bet.contest || '-'}</span>
                        <span class="contest-accordion-meta">${bets.length} jogo${bets.length !== 1 ? 's' : ''}</span>
                        <i data-lucide="chevron-down" class="contest-accordion-chevron"></i>
                    </button>
                    <div class="contest-accordion-body">${cardsHtml}</div>
                </div>
            `;
        }).join('');
    } else {
        container.innerHTML = filteredBets.map(bet => renderSingleBetCard(bet, filter)).join('');
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function renderSingleBetCard(bet, filter) {
    const lotId = bet.lotteryId || bet.lottery_id || '';
    const lotName = bet.lotteryName || bet.lottery_name || '';
    const lottery = lotteries[lotId];
    const lotColor = lottery?.color || '#005CA9';
        const lotLogo = lottery?.logo || '';

        let statusText = 'Aguardando sorteio...';
        let statusClass = 'pending';
        
        if (filter === 'won') {
            statusText = '✓ Ganhou';
            statusClass = 'won';
        } else if (filter === 'lost') {
            statusText = '✗ Perdeu';
            statusClass = 'lost';
        }
        
        // Informações do sorteio
        let contestInfo = `Concurso: <strong>${bet.contest || '-'}</strong>`;
        let sorteieDateInfo = '';
        if (bet.contestDate && filter === 'active') {
            sorteieDateInfo = `<span class="bet-sorteio-date">Sorteio: ${bet.contestDate}</span>`;
        }
        
        let prizeHtml = '';
        if (filter === 'won' && bet.prize) {
            prizeHtml = `
                <div class="bet-card-divider"></div>
                <div class="bet-prize">Prêmio: R$ ${bet.prize.toLocaleString('pt-BR', {minimumFractionDigits: 2})} (${bet.hits} acertos)</div>
            `;
        }

        // Números sorteados (para won e lost)
        let drawnNumbersHtml = '';
        let drawnNums = bet.drawnNumbers || bet.drawn_numbers;
        if (!drawnNums && (filter === 'won' || filter === 'lost') && bet.contest) {
            const results = officialResults[lotId];
            if (results && results.length > 0) {
                const contestNum = parseInt(bet.contest, 10);
                const match = results.find(r => parseInt(r.contest, 10) === contestNum);
                if (match && match.numbers) drawnNums = match.numbers;
            }
        }
        if ((filter === 'won' || filter === 'lost') && drawnNums && drawnNums.length > 0) {
            const betNums = new Set(bet.numbers.map(Number));
            drawnNumbersHtml = `
                <div class="bet-card-divider"></div>
                <div class="bet-drawn-section">
                    <span class="bet-drawn-label">Números sorteados:</span>
                    <div class="bet-drawn-numbers">
                        ${drawnNums.map(n => {
                            const isHit = betNums.has(Number(n));
                            return `<span class="bet-drawn-ball ${isHit ? 'hit' : ''}">${String(n).padStart(2, '0')}</span>`;
                        }).join('')}
                    </div>
                </div>
            `;
        }
        
        // Info de acertos para jogos perdidos
        let hitsInfo = '';
        if (filter === 'lost' && bet.hits !== undefined) {
            hitsInfo = `<span class="bet-hits-info">${bet.hits} acerto${bet.hits !== 1 ? 's' : ''}</span>`;
        }
        
        const aiLogoHtml = (bet.isAI || bet.is_ai) ? '<img src="assets/logo-ai-branca.png" alt="IA" class="bet-ai-logo">' : '';
        
        return `
            <div class="bet-card bet-card-modern">
                <div class="bet-card-header ${statusClass}" style="--lottery-color: ${lotColor};">
                    <span class="bet-card-status">${statusText}</span>
                    <div class="bet-card-header-right">
                        ${hitsInfo}
                        ${aiLogoHtml}
                        <button class="share-btn share-btn-small" onclick="shareGame('${lotName}', [${bet.numbers.join(',')}], ${bet.isAI || bet.is_ai || false})" title="Compartilhar">
                            <i data-lucide="share-2"></i>
                        </button>
                    </div>
                </div>
                <div class="bet-card-body">
                    <div class="bet-card-meta">
                        <div class="bet-lottery">
                            <img src="${lotLogo}" alt="${lotName}" class="bet-lottery-logo">
                        </div>
                        <span>${contestInfo}</span>
                        ${sorteieDateInfo}
                        <span class="bet-aposta-date">Aposta: ${bet.date}</span>
                    </div>
                    <div class="bet-card-divider"></div>
                    <div class="bet-card-numbers">
                        ${bet.numbers.map(n => `<span class="bet-number-ball" style="--lottery-color: ${lotColor};">${String(n).padStart(2, '0')}</span>`).join('')}
                    </div>
                    ${prizeHtml}
                    ${drawnNumbersHtml}
                </div>
            </div>
        `;
}

/**
 * Renderiza lista de transações
 */
// Controle de paginação de transações
let transactionsVisible = 10;

export function renderTransactions(showMore = false) {
    const container = document.getElementById('transactions');
    if (!container) return;
    
    // Se não for "ver mais", reseta para 10
    if (!showMore) {
        transactionsVisible = 10;
    }
    
    if (state.transactions.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Nenhuma transação encontrada</p></div>';
        return;
    }
    
    // Pega apenas as transações visíveis
    const visibleTransactions = state.transactions.slice(0, transactionsVisible);
    const hasMore = state.transactions.length > transactionsVisible;
    
    let html = visibleTransactions.map(tx => {
        let typeLabel = '';
        if (tx.type === 'deposit') typeLabel = 'Depósito PIX';
        else if (tx.type === 'withdraw') typeLabel = 'Saque PIX';
        else if (tx.type === 'prize') typeLabel = 'Prêmio ' + (tx.poolName || tx.lottery || '');
        else if (tx.type === 'pool') typeLabel = 'Bolão ' + (tx.poolName || '');
        else typeLabel = 'Aposta ' + (tx.lottery || '');
        
        const isPositive = tx.type === 'deposit' || tx.type === 'prize';
        
        return `
        <div class="transaction-item">
            <div class="transaction-info">
                <span class="transaction-type">${typeLabel}</span>
                <span class="transaction-date">${tx.date}</span>
            </div>
            <span class="transaction-value ${isPositive ? 'positive' : 'negative'}">
                ${isPositive ? '+' : '-'} R$ ${tx.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
            </span>
        </div>
    `;
    }).join('');
    
    // Adiciona botão "Ver mais" se houver mais transações
    if (hasMore) {
        html += `
            <button class="btn-load-more" onclick="loadMoreTransactions()">
                <i data-lucide="chevron-down"></i>
                Ver mais (${state.transactions.length - transactionsVisible} restantes)
            </button>
        `;
    }
    
    container.innerHTML = html;
    
    // Reinicializa ícones Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

export function loadMoreTransactions() {
    transactionsVisible += 10;
    renderTransactions(true);
}

/**
 * Atualiza os números selecionados na UI
 */
export function updateSelectedNumbers() {
    const selectedBalls = document.getElementById('selected-balls');
    const selectedCount = document.getElementById('selected-count');
    
    if (selectedBalls) {
        selectedBalls.innerHTML = state.selectedNumbers
            .map(num => `<span class="selected-ball">${String(num).padStart(2, '0')}</span>`)
            .join('');
    }
    
    if (selectedCount) {
        selectedCount.textContent = state.selectedNumbers.length;
    }

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
    
    // Atualiza botão de confirmar
    const lottery = lotteries[state.currentLottery];
    const confirmBtn = document.getElementById('btn-confirm');
    if (confirmBtn && lottery) {
        if (state.pendingBets.length > 0) {
            confirmBtn.disabled = false;
        } else {
            confirmBtn.disabled = state.selectedNumbers.length < lottery.minNumbers;
        }
    }
}

export default {
    filterBets,
    renderBets,
    renderTransactions,
    loadMoreTransactions,
    updateSelectedNumbers
};
