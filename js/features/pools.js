/**
 * Pools Module - Gerenciamento de bolões
 * @module features/pools
 */

import { state, addPoolParticipation, getPoolParticipation, getUserQuotasInPool } from '../core/state.js';
import { pools, lotteries, DEFAULT_POOL, DEFAULT_POOL_LOTOFACIL, DEFAULT_POOL_QUINA } from '../core/config.js';
import { Storage } from '../utils/storage.js';
import { updateBalanceDisplays } from '../wallet/balance.js';
import LoteriasAPI from '../utils/api.js';
import { apiParticipatePool } from '../api-client.js';

// Estado local do modal
let currentPoolId = null;
let selectedQuotas = 1;
let poolFilledSpots = {}; // Cache local de cotas preenchidas
let poolParticipationInFlight = false; // Evita cliques duplos

/** Cache: próximo sorteio e prêmio por loteria (data da API) */
let nextDrawByLottery = {};

/**
 * Encontra um bolão por ID (aceita string ou number da API)
 * @param {string|number} id
 * @returns {Object|undefined}
 */
function findPoolById(id) {
    if (id === undefined || id === null) return undefined;
    const s = String(id);
    return pools.find(p => String(p.id) === s);
}

/**
 * Formata data da API para DD/MM/YYYY
 * @param {string} dateStr - Data (pode ser DD/MM/YYYY ou YYYY-MM-DD)
 * @returns {string}
 */
function formatDrawDate(dateStr) {
    if (!dateStr) return '';
    const s = String(dateStr).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
    return s;
}

/**
 * Carrega da API a data do próximo sorteio e o prêmio estimado para cada loteria dos bolões.
 * Atualiza o cache nextDrawByLottery e re-renderiza a lista quando terminar.
 */
export async function loadNextDrawForPools() {
    const lotteryIds = [...new Set(pools.map(p => p.lottery))];
    const promises = lotteryIds.map(async (lotteryId) => {
        try {
            const result = await LoteriasAPI.getResult(lotteryId);
            const prox = result?.proximoConcurso;
            if (!prox) return;
            const date = formatDrawDate(prox.data);
            const prize = prox.valorEstimado || prox.valorAcumulado || 0;
            const nextContest = (result?.contest || 0) + 1;
            nextDrawByLottery[lotteryId] = { date: date || null, prize: Number(prize) || 0, contest: nextContest };
        } catch (e) {
            console.warn('[Pools] Erro ao carregar próximo sorteio para', lotteryId, e);
        }
    });
    await Promise.all(promises);
}

/**
 * Inicializa o módulo de bolões
 */
export function initPools() {
    // Carrega participações salvas
    const savedParticipations = Storage.loadPoolParticipations();
    if (savedParticipations && savedParticipations.length > 0) {
        state.poolParticipations = savedParticipations;
    }
    
    // Carrega cotas preenchidas salvas
    const savedFilledSpots = Storage.loadPoolFilledSpots();
    if (savedFilledSpots) {
        poolFilledSpots = savedFilledSpots;
    }
    
    // Garante bolões padrão disponíveis antes da API carregar
    if (pools.length === 0) {
        pools.push({ ...DEFAULT_POOL });
        pools.push({ ...DEFAULT_POOL_LOTOFACIL });
        pools.push({ ...DEFAULT_POOL_QUINA });
    }
}

/**
 * Obtém o número de cotas preenchidas de um bolão
 * @param {Object} pool - Objeto do bolão
 * @returns {number} Número de cotas preenchidas
 */
function getFilledSpots(pool) {
    // Se tiver valor salvo localmente, usa ele
    if (poolFilledSpots[pool.id] !== undefined) {
        return poolFilledSpots[pool.id];
    }
    // Caso contrário, usa o valor default do config
    return pool.filledSpots;
}

/**
 * Filtra bolões por tipo de loteria
 * @param {string} filter - Filtro (all, megasena, lotofacil, quina)
 */
export function filterPools(filter) {
    state.currentPoolFilter = filter;
    
    // Atualiza botões de filtro
    document.querySelectorAll('.pool-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event?.target?.classList.add('active');
    
    renderPools();
}

/**
 * Filtra bolões por loteria (usado pelos botões lottery-filter-card)
 * @param {string} lotteryId - lotofacil, megasena ou quina
 * @param {HTMLElement} btn - Botão clicado
 */
export function filterPoolsByLottery(lotteryId, btn) {
    state.currentPoolFilter = lotteryId;
    document.querySelectorAll('.pools-lottery-filter .lottery-filter-card').forEach(b => {
        b.classList.toggle('active', b === btn);
    });
    renderPoolsPage();
}

/**
 * Renderiza lista de bolões (na home - legado)
 */
export function renderPools() {
    const container = document.getElementById('pools-list');
    if (!container) return;
    renderPoolsInContainer(container);
}

/**
 * Renderiza lista de bolões na página dedicada
 */
export function renderPoolsPage() {
    const container = document.getElementById('pools-list-page');
    if (!container) return;
    renderPoolsInContainer(container);
}

/**
 * Renderiza lista de bolões em um container específico
 * @param {HTMLElement} container - Container onde renderizar
 */
function renderPoolsInContainer(container) {
    if (!container) return;
    
    const filteredPools = state.currentPoolFilter === 'all' 
        ? pools 
        : pools.filter(p => p.lottery === state.currentPoolFilter);
    
    const isNewLayout = container.id === 'pools-list-page';
    
    if (filteredPools.length === 0) {
        container.innerHTML = `
            <div class="pools-empty-state">
                <i data-lucide="users" class="pools-empty-icon"></i>
                <p class="pools-empty-title">Nenhum bolão disponível</p>
                <p class="pools-empty-text">Novos bolões em breve!</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    container.innerHTML = filteredPools.map((pool, idx) => {
        const userQuotas = getUserQuotasInPool(pool.id);
        const filledSpots = getFilledSpots(pool);
        const isFull = filledSpots >= pool.totalSpots;
        const availableSpots = pool.totalSpots - filledSpots;
        const apiNext = nextDrawByLottery[pool.lottery];
        const drawDate = (apiNext?.date && apiNext.date !== '') ? apiNext.date : pool.drawDate;
        const prize = (apiNext?.prize && apiNext.prize > 0) ? apiNext.prize : pool.prize;
        
        if (isNewLayout) {
            const lotteryClass = `pool-card-${pool.lottery || 'default'}`;
            const displayName = pool.name || '';
            const lotteryName = lotteries[pool.lottery]?.name || '';
            const showLogoInHeader = ['megasena', 'lotofacil', 'quina'].includes(pool.lottery);
            const participation = getPoolParticipation(pool.id);
            const totalInvested = participation ? participation.totalValue : 0;
            const contestNum = (apiNext?.contest && apiNext.contest > 0) ? apiNext.contest : '---';
            return `
                <div class="pool-card-v2 ${lotteryClass} ${userQuotas > 0 ? 'pool-card-participating' : ''} ${isFull ? 'pool-card-full' : ''}" ${!isFull ? `onclick="openPoolModal('${pool.id}')"` : ''}>
                    <div class="pool-card-v2-header">
                        ${showLogoInHeader
                            ? `<img class="pool-card-v2-logo" src="${lotteries[pool.lottery]?.logo || `assets/${pool.lottery || ''}.png`}" alt="${lotteryName}">`
                            : `<span class="pool-card-v2-header-name">${displayName}</span>`
                        }
                    </div>
                    <div class="pool-card-v2-body">
                        <div class="pool-card-v2-prize">
                            <span class="pool-card-v2-prize-value">${LoteriasAPI.formatCurrency(prize)}</span>
                            <span class="pool-card-v2-prize-label">Prêmio estimado do concurso ${contestNum}</span>
                        </div>
                        <div class="pool-card-v2-info">
                            <div class="pool-card-v2-info-row">
                                <span><i data-lucide="calendar"></i> Sorteio</span>
                                <strong>${drawDate || '--/--/----'}</strong>
                            </div>
                            <div class="pool-card-v2-info-row">
                                <span><i data-lucide="users"></i> Suas cotas</span>
                                <strong>${userQuotas}</strong>
                            </div>
                            <div class="pool-card-v2-info-row">
                                <span><i data-lucide="wallet"></i> Investido</span>
                                <strong>R$ ${Number(totalInvested).toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</strong>
                            </div>
                        </div>
                        <button class="pool-card-v2-cta" onclick="event.stopPropagation(); openPoolModal('${pool.id}')" ${isFull ? 'disabled' : ''}>
                            ${!isFull ? '<i data-lucide="plus-circle"></i> ' : ''}${isFull ? 'Esgotado' : (userQuotas > 0 ? 'Comprar mais cotas' : 'Participar')}
                        </button>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="pool-card ${userQuotas > 0 ? 'pool-card-participating' : ''} ${isFull ? 'pool-card-full' : ''}">
                <div class="pool-card-header">
                    <img class="pool-lottery-logo" src="${lotteries[pool.lottery]?.logo || ''}" alt="${pool.lotteryName}">
                    <span class="pool-spots">${filledSpots}/${pool.totalSpots} cotas</span>
                </div>
                <h4 class="pool-name">${pool.name}</h4>
                ${userQuotas > 0 ? `<div class="pool-user-badge"><i data-lucide="check-circle"></i> Você participa (${userQuotas} cota${userQuotas > 1 ? 's' : ''})</div>` : ''}
                <div class="pool-card-meta">
                    <div class="pool-meta-item pool-meta-price">
                        <span class="pool-meta-label">Cota</span>
                        <span class="pool-meta-value">R$ ${pool.quotaPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                    </div>
                    <div class="pool-meta-item">
                        <span class="pool-meta-label">Sorteio</span>
                        <span class="pool-meta-value">${drawDate}</span>
                    </div>
                    <div class="pool-meta-item pool-meta-prize">
                        <span class="pool-meta-label">Prêmio</span>
                        <span class="pool-meta-value">${LoteriasAPI.formatCurrency(prize)}</span>
                    </div>
                </div>
                <button class="btn-participate ${isFull ? 'btn-participate-full' : ''}" onclick="openPoolModal('${pool.id}')" ${isFull ? 'disabled' : ''}>
                    ${!isFull ? '<i data-lucide="plus-circle"></i> ' : ''}${isFull ? 'Esgotado' : (userQuotas > 0 ? 'Comprar mais cotas' : 'Participar')}
                </button>
            </div>
        `;
    }).join('');
    
    // Reinicializa ícones Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Abre o modal de detalhes do bolão
 * @param {string|number} poolId - ID do bolão
 * @param {number} [initialQuotas=1] - Cotas pré-selecionadas (ex: 1, 5, 10)
 */
export function openPoolModal(poolId, initialQuotas = 1) {
    const pool = findPoolById(poolId);
    if (!pool) {
        if (typeof window.showToast === 'function') {
            window.showToast('Bolão não encontrado. Atualize a página.', 'error');
        }
        return;
    }

    const filledSpots = getFilledSpots(pool);
    const availableSpots = pool.totalSpots - filledSpots;
    const maxQuotas = Math.max(1, Math.min(initialQuotas || 1, availableSpots));

    currentPoolId = pool.id;
    selectedQuotas = maxQuotas;

    const userQuotas = getUserQuotasInPool(pool.id);

    const modalEl = document.getElementById('pool-modal');
    if (!modalEl) return;

    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    const quotaPrice = pool.quotaPrice || pool.quota_price || 100;
    const setPrice = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`; };
    setPrice('pool-quota-price-1', quotaPrice * 1);
    setPrice('pool-quota-price-5', quotaPrice * 5);
    setPrice('pool-quota-price-10', quotaPrice * 10);
    setText('pool-modal-balance', `R$ ${Number(state.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

    const userInfoEl = document.getElementById('pool-modal-user-info');
    const userQuotasEl = document.getElementById('pool-modal-user-quotas');
    if (userInfoEl && userQuotasEl) {
        if (userQuotas > 0) {
            userInfoEl.classList.remove('hidden');
            userQuotasEl.textContent = userQuotas;
        } else {
            userInfoEl.classList.add('hidden');
        }
    }

    modalEl.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Imagem de fundo (mesmo padrão de Jogos do Dia)
    const contentEl = modalEl.querySelector('.pool-modal-content');
    if (contentEl) {
        const imgUrl = new URL('assets/imagem-fundo-card.png', window.location.href).href;
        contentEl.style.backgroundColor = '#fff';
        contentEl.style.backgroundImage = `url('${imgUrl}')`;
        contentEl.style.backgroundSize = 'cover';
        contentEl.style.backgroundPosition = 'center';
        contentEl.style.backgroundRepeat = 'no-repeat';
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Fecha o modal do bolão
 */
export function closePoolModal() {
    document.getElementById('pool-modal').classList.add('hidden');
    document.body.style.overflow = '';
    currentPoolId = null;
    selectedQuotas = 1;
}

/**
 * Aumenta a quantidade de cotas selecionadas
 */
export function increasePoolQuotas() {
    if (!currentPoolId) return;
    const pool = findPoolById(currentPoolId);
    if (!pool) return;
    
    const filledSpots = getFilledSpots(pool);
    const availableSpots = pool.totalSpots - filledSpots;
    
    if (selectedQuotas < availableSpots) {
        selectedQuotas++;
        updatePoolModalTotal();
    }
}

/**
 * Diminui a quantidade de cotas selecionadas
 */
export function decreasePoolQuotas() {
    if (selectedQuotas > 1) {
        selectedQuotas--;
        updatePoolModalTotal();
    }
}

/**
 * Define quantidade de cotas pelo tier (1, 5, 10) - usado pelos botões rápidos
 */
export function setPoolModalQuotas(qty) {
    if (!currentPoolId) return;
    const pool = findPoolById(currentPoolId);
    if (!pool) return;
    const filledSpots = getFilledSpots(pool);
    const availableSpots = pool.totalSpots - filledSpots;
    selectedQuotas = Math.max(1, Math.min(qty, availableSpots));
    updatePoolModalTotal();
}

/**
 * Seleciona cotas e confirma participação (usado pelos 3 cards fixos)
 */
export function selectQuotaAndConfirm(qty) {
    if (!currentPoolId) return;
    setPoolModalQuotas(qty);
    confirmPoolParticipation();
}

/**
 * Atualiza o total no modal (compatibilidade - cards fixos não precisam)
 */
function updatePoolModalTotal() {
    if (!currentPoolId) return;
    // Cards fixos: sem seletor +/- , apenas setPoolModalQuotas atualiza selectedQuotas
}

/**
 * Confirma a participação no bolão (chama API para persistir no servidor)
 */
export async function confirmPoolParticipation() {
    if (!currentPoolId) return;
    if (poolParticipationInFlight) return;
    const pool = findPoolById(currentPoolId);
    if (!pool) return;
    
    const total = selectedQuotas * (pool.quotaPrice || pool.quota_price || 100);
    
    // Verifica saldo - se insuficiente, mostra modal e depois opção PIX ou cartão
    if (total > (state.balance || 0)) {
        if (typeof window.showBalanceModal === 'function') {
            window.showBalanceModal(total, { useDepositModal: true });
        }
        return;
    }
    
    // Verifica disponibilidade de cotas
    const filledSpots = getFilledSpots(pool);
    const availableSpots = pool.totalSpots - filledSpots;
    
    if (selectedQuotas > availableSpots) {
        if (typeof window.showToast === 'function') {
            window.showToast('Cotas indisponíveis', 'error');
        }
        return;
    }
    
    // Chama API para persistir no servidor (débito de saldo + participação)
    poolParticipationInFlight = true;
    try {
        await apiParticipatePool(currentPoolId, selectedQuotas);
    } catch (err) {
        const msg = err?.message || 'Erro ao participar do bolão. Tente novamente.';
        if (typeof window.showToast === 'function') {
            window.showToast(msg, 'error');
        }
        return;
    } finally {
        poolParticipationInFlight = false;
    }
    
    // Desconta do saldo (local, já debitado no servidor)
    state.balance -= total;
    
    // Verifica se já tem participação neste bolão
    const existingParticipation = getPoolParticipation(currentPoolId);
    
    if (existingParticipation) {
        // Adiciona mais cotas à participação existente
        existingParticipation.quotas += selectedQuotas;
        existingParticipation.totalValue += total;
    } else {
        // Cria nova participação
        const participation = {
            id: `part_${Date.now()}`,
            poolId: currentPoolId,
            poolName: pool.name,
            lotteryId: pool.lottery,
            lotteryName: pool.lotteryName,
            quotas: selectedQuotas,
            valuePerQuota: pool.quotaPrice,
            totalValue: total,
            date: new Date().toLocaleDateString('pt-BR'),
            drawDate: pool.drawDate,
            numbers: [...pool.numbers],
            status: 'active'
        };
        
        addPoolParticipation(participation);
    }
    
    // Atualiza cotas preenchidas
    poolFilledSpots[currentPoolId] = filledSpots + selectedQuotas;
    
    // Registra transação
    state.transactions.unshift({
        id: Date.now(),
        type: 'pool',
        poolName: pool.name,
        lottery: pool.lotteryName,
        quotas: selectedQuotas,
        value: total,
        date: new Date().toLocaleDateString('pt-BR')
    });
    
    // Salva no localStorage
    Storage.saveBalance(state.balance);
    Storage.savePoolParticipations(state.poolParticipations);
    Storage.savePoolFilledSpots(poolFilledSpots);
    Storage.saveTransactions(state.transactions);
    
    // Atualiza UI do saldo (via função centralizada com debounce)
    updateBalanceDisplays();
    
    // Fecha o modal
    closePoolModal();
    
    // Mostra mensagem de sucesso
    if (typeof window.showToast === 'function') {
        window.showToast(`Você entrou no bolão "${pool.name}" com ${selectedQuotas} cota(s)!`, 'success');
    }
    
    // Re-renderiza as listas de bolões (home e tela de bolões)
    renderPools();
    renderMyPools();
    renderPoolsPage();
    renderMyPoolsPage();
}

/**
 * Participa de um bolão (função legada - redireciona para o modal)
 * @param {string} poolId - ID do bolão
 */
export function participatePool(poolId) {
    openPoolModal(poolId);
}

/**
 * Verifica os resultados dos bolões e atualiza status
 */
export function checkPoolsAgainstResults() {
    if (state.poolParticipations.length === 0) return;
    
    // Importa resultados oficiais (se disponível)
    const officialResults = window.officialResults || {};
    
    state.poolParticipations.forEach(participation => {
        // Só verifica participações ativas
        if (participation.status !== 'active') return;
        
        const pool = findPoolById(participation.poolId);
        if (!pool) return;
        
        // Verifica se tem resultados para essa loteria
        const results = officialResults[pool.lottery];
        if (!results || results.length === 0) return;
        
        // Busca resultado para a data do sorteio do bolão
        const poolDrawDate = parseDate(pool.drawDate);
        if (!poolDrawDate) return;
        
        // Verifica se o sorteio já ocorreu
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (poolDrawDate > today) return; // Ainda não sorteou
        
        // Busca o resultado correspondente
        const result = results.find(r => {
            const resultDate = parseDate(r.date);
            return resultDate && resultDate.getTime() === poolDrawDate.getTime();
        });
        
        if (!result || !result.numbers) return;
        
        // Calcula acertos
        const hits = pool.numbers.filter(n => result.numbers.includes(n)).length;
        
        // Determina se ganhou (depende da loteria)
        const minHitsToWin = {
            megasena: 4, // Quadra ou mais
            lotofacil: 11, // 11 acertos ou mais
            quina: 2 // Duque ou mais
        };
        
        const won = hits >= (minHitsToWin[pool.lottery] || 0);
        
        // Atualiza status
        participation.status = won ? 'won' : 'lost';
        participation.hits = hits;
        participation.resultNumbers = result.numbers;
        
        if (won) {
            // Calcula prêmio proporcional (simplificado)
            const poolPrize = result.prize || pool.prize;
            const prizePerQuota = poolPrize / pool.totalSpots;
            participation.prize = prizePerQuota * participation.quotas;
            
            // Adiciona ao saldo se ganhou
            state.balance += participation.prize;
            
            // Registra transação de prêmio
            state.transactions.unshift({
                id: Date.now(),
                type: 'prize',
                poolName: participation.poolName,
                lottery: participation.lotteryName,
                value: participation.prize,
                date: new Date().toLocaleDateString('pt-BR')
            });
        }
    });
    
    // Salva alterações
    Storage.saveBalance(state.balance);
    Storage.savePoolParticipations(state.poolParticipations);
    Storage.saveTransactions(state.transactions);
    
    // Atualiza UI
    renderMyPools();
    renderPools();
    
    // Atualiza display de saldo
    if (typeof window.updateBalanceDisplays === 'function') {
        window.updateBalanceDisplays();
    }
}

/**
 * Converte string de data para objeto Date
 * @param {string} dateStr - Data no formato dd/mm/yyyy
 * @returns {Date|null} Objeto Date ou null
 */
function parseDate(dateStr) {
    if (!dateStr) return null;
    
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }
    }
    
    return new Date(dateStr);
}

/**
 * Renderiza a seção "Meus Bolões" (legado - home)
 */
export function renderMyPools() {
    const container = document.getElementById('my-pools-list');
    const section = document.getElementById('my-pools-section');
    renderMyPoolsInContainer(container, section);
}

/**
 * Renderiza a seção "Meus Bolões" na página dedicada
 */
export function renderMyPoolsPage() {
    const container = document.getElementById('my-pools-list-page');
    renderMyPoolsInContainer(container, null);
}

/**
 * Renderiza "Meus Bolões" em containers específicos
 * @param {HTMLElement} container - Container da lista
 * @param {HTMLElement} section - Seção pai
 */
function renderMyPoolsInContainer(container, section) {
    if (!container) return;
    
    // Filtra participações ativas
    const activeParticipations = state.poolParticipations.filter(p => p.status === 'active');
    
    if (activeParticipations.length === 0) {
        container.innerHTML = `
            <div class="pools-empty-state">
                <i data-lucide="users" class="pools-empty-icon"></i>
                <p class="pools-empty-title">Você ainda não participa de nenhum bolão</p>
                <p class="pools-empty-text">Escolha um bolão abaixo para participar.</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    // Calcula totais
    const totalInvested = activeParticipations.reduce((sum, p) => sum + p.totalValue, 0);
    const totalQuotas = activeParticipations.reduce((sum, p) => sum + p.quotas, 0);
    
    let html = `
        <div class="my-pools-summary">
            <div class="my-pools-summary-item">
                <span class="my-pools-summary-label">Bolões ativos</span>
                <span class="my-pools-summary-value">${activeParticipations.length}</span>
            </div>
            <div class="my-pools-summary-divider"></div>
            <div class="my-pools-summary-item">
                <span class="my-pools-summary-label">Cotas totais</span>
                <span class="my-pools-summary-value">${totalQuotas}</span>
            </div>
            <div class="my-pools-summary-divider"></div>
            <div class="my-pools-summary-item">
                <span class="my-pools-summary-label">Investido</span>
                <span class="my-pools-summary-value">R$ ${totalInvested.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
            </div>
        </div>
    `;
    
    html += '<div class="my-pools-cards">';
    
    html += activeParticipations.map(participation => {
        const pool = findPoolById(participation.poolId);
        const apiNext = pool ? nextDrawByLottery[pool.lottery] : null;
        const prizeForPool = (pool && apiNext?.prize && apiNext.prize > 0) ? apiNext.prize : (pool ? pool.prize : 0);
        const potentialPrize = pool ? (prizeForPool / pool.totalSpots) * participation.quotas : 0;
        const lotteryClass = pool ? `my-pool-card-v2-${pool.lottery}` : 'my-pool-card-v2-default';
        const lotteryName = participation.lotteryName || (pool ? lotteries[pool.lottery]?.name : '') || '';
        
        return `
            <div class="my-pool-card-v2 ${lotteryClass}" onclick="openPoolModal('${participation.poolId}')">
                <div class="my-pool-card-v2-header">
                    <img class="my-pool-card-v2-logo" src="${pool ? (lotteries[pool.lottery]?.logo || '') : ''}" alt="${lotteryName}">
                    <div class="my-pool-card-v2-header-info">
                        <span class="my-pool-card-v2-name">${participation.poolName}</span>
                        ${lotteryName ? `<span class="my-pool-card-v2-lottery">${lotteryName}</span>` : ''}
                        <span class="my-pool-card-v2-status"><i data-lucide="clock"></i> Aguardando sorteio</span>
                    </div>
                </div>
                <div class="my-pool-card-v2-body">
                    <div class="my-pool-card-v2-prize-box">
                        <span class="my-pool-card-v2-prize-label">Prêmio potencial</span>
                        <span class="my-pool-card-v2-prize-value">${LoteriasAPI.formatCurrency(potentialPrize)}</span>
                    </div>
                    <div class="my-pool-card-v2-numbers">
                        ${(participation.numbers || []).map(n => `<span class="my-pool-number-v2">${String(n).padStart(2, '0')}</span>`).join('')}
                    </div>
                    <div class="my-pool-card-v2-info">
                        <div class="my-pool-card-v2-info-row">
                            <span><i data-lucide="users"></i> Suas cotas</span>
                            <strong>${participation.quotas}</strong>
                        </div>
                        <div class="my-pool-card-v2-info-row">
                            <span><i data-lucide="wallet"></i> Investido</span>
                            <strong>R$ ${participation.totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</strong>
                        </div>
                    </div>
                    <button class="my-pool-card-v2-cta" onclick="event.stopPropagation(); openPoolModal('${participation.poolId}')">
                        <i data-lucide="plus-circle"></i>
                        Comprar mais cotas
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    html += '</div>';
    
    container.innerHTML = html;
    
    // Reinicializa ícones Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

export default {
    initPools,
    loadNextDrawForPools,
    filterPools,
    filterPoolsByLottery,
    renderPools,
    renderPoolsPage,
    renderMyPools,
    renderMyPoolsPage,
    checkPoolsAgainstResults,
    participatePool,
    openPoolModal,
    closePoolModal,
    increasePoolQuotas,
    decreasePoolQuotas,
    setPoolModalQuotas,
    selectQuotaAndConfirm,
    confirmPoolParticipation
};
