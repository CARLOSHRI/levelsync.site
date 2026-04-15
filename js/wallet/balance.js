/**
 * Balance Module - Gerenciamento de saldo
 * @module wallet/balance
 */

import { state } from '../core/state.js';
import { pools, DEFAULT_POOL, DEFAULT_POOL_LOTOFACIL, DEFAULT_POOL_QUINA } from '../core/config.js';
import { Storage } from '../utils/storage.js';
import { ErrorHandler } from '../utils/errors.js';
import { apiGetMe, apiGetBets, apiGetTransactions, apiGetPools, apiGetMyPools } from '../api-client.js';

// Debounce para evitar flickering do saldo
let _balanceUpdateTimer = null;

/**
 * Atualiza os displays de saldo em toda a aplicação (com debounce)
 */
export function updateBalanceDisplays() {
    if (_balanceUpdateTimer) clearTimeout(_balanceUpdateTimer);
    _balanceUpdateTimer = setTimeout(_doUpdateBalanceDisplays, 50);
}

function _doUpdateBalanceDisplays() {
    const balanceEl = document.getElementById('balance');
    const walletBalanceEl = document.getElementById('wallet-balance');
    const withdrawAvailableEl = document.getElementById('withdraw-available');
    
    const formattedBalance = `R$ ${state.balance.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    
    if (balanceEl) balanceEl.textContent = formattedBalance;
    if (walletBalanceEl) walletBalanceEl.textContent = formattedBalance;
    if (withdrawAvailableEl) withdrawAvailableEl.textContent = formattedBalance;
}

let balanceModalUseDepositModal = false;

/**
 * Exibe o modal de saldo insuficiente
 * @param {number} costValue - Valor necessário
 * @param {Object} options - { useDepositModal: true } para abrir modal PIX na mesma página (Jogos do Dia)
 */
export function showBalanceModal(costValue = 0, options = {}) {
    balanceModalUseDepositModal = !!options.useDepositModal;

    const modal = document.getElementById('balance-modal');
    if (modal) modal.classList.remove('hidden');

    const balanceEl = document.getElementById('balance-modal-balance');
    if (balanceEl) {
        balanceEl.textContent = `R$ ${(state.balance || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    }

    const costEl = document.getElementById('balance-modal-cost');
    if (costEl) {
        costEl.textContent = `R$ ${(costValue || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    }
}

/**
 * Handler do botão "Adicionar saldo" no modal de saldo insuficiente.
 * Se useDepositModal, abre o modal PIX na mesma página; senão vai para tela de depósito.
 */
export function handleAddBalanceFromBalanceModal() {
    closeBalanceModal();
    if (balanceModalUseDepositModal && typeof window.openDepositModal === 'function') {
        window.openDepositModal();
    } else {
        goToDeposit();
    }
}

/**
 * Fecha o modal de saldo insuficiente
 */
export function closeBalanceModal() {
    const modal = document.getElementById('balance-modal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Navega para a tela de depósito
 */
export function goToDeposit() {
    closeBalanceModal();
    if (typeof window.showScreen === 'function') {
        window.showScreen('deposit');
    }
}

/**
 * Exibe o modal de sucesso
 * @param {string} message - Mensagem de sucesso
 */
export function showSuccessModal(message) {
    const modal = document.getElementById('success-modal');
    const messageEl = document.getElementById('success-modal-message');
    if (messageEl) {
        messageEl.textContent = message || 'Sua aposta foi registrada com sucesso.';
    }
    if (modal) modal.classList.remove('hidden');
}

/**
 * Fecha o modal de sucesso
 */
export function closeSuccessModal() {
    const modal = document.getElementById('success-modal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Navega para a tela de apostas
 */
export function goToMyBets() {
    closeSuccessModal();
    if (typeof window.showScreen === 'function') {
        window.showScreen('my-bets');
    }
}

/**
 * Carrega dados salvos (localStorage como cache rápido)
 */
export function loadSavedData() {
    if (!Storage.isAvailable()) {
        console.warn('localStorage não disponível. Dados não serão salvos.');
        return;
    }

    try {
        const savedBalance = Storage.loadBalance();
        if (savedBalance !== null) {
            state.balance = savedBalance;
        }

        const savedBets = Storage.loadBets();
        if (savedBets !== null) {
            // Normaliza campos snake_case → camelCase (bets salvas antes da normalização)
            state.bets = savedBets.map(b => ({
                ...b,
                lotteryId: b.lotteryId || b.lottery_id || '',
                lotteryName: b.lotteryName || b.lottery_name || '',
                isAI: b.isAI || b.is_ai || false,
                drawnNumbers: b.drawnNumbers || b.drawn_numbers
            }));
        }

        const savedTransactions = Storage.loadTransactions();
        if (savedTransactions !== null) {
            state.transactions = savedTransactions;
        }

        const preferences = Storage.loadPreferences();
        if (preferences.currentBetsFilter) {
            state.currentBetsFilter = preferences.currentBetsFilter;
        }
        if (preferences.currentPoolFilter) {
            state.currentPoolFilter = preferences.currentPoolFilter;
        }
    } catch (error) {
        ErrorHandler.handle(error, 'loadSavedData');
    }
}

/**
 * Carrega dados da API PHP para o state (chamado após autenticação JWT)
 */
export async function loadFromAPI() {
    try {
        // Dados do usuário (servidor é fonte de verdade para o saldo)
        const user = await apiGetMe();
        if (user && typeof user.balance === 'number') {
            state.balance = user.balance;
            localStorage.setItem('lotograna_user_name', user.name || 'Apostador');
            localStorage.setItem('lotograna_user_email', user.email || '');
        }

        // Apostas (normaliza campos snake_case → camelCase)
        const bets = await apiGetBets();
        const previousBets = state.bets;
        if (bets && bets.length > 0) {
            const apiBets = bets.map(b => ({
                ...b,
                lotteryId: b.lotteryId || b.lottery_id || '',
                lotteryName: b.lotteryName || b.lottery_name || '',
                isAI: b.isAI || b.is_ai || false,
                drawnNumbers: b.drawnNumbers || b.drawn_numbers
            }));
            const betKey = (b) => `${b.lotteryId || b.lottery_id || ''}-${(b.numbers || []).join(',')}-${b.contest || ''}`;
            const apiKeys = new Set(apiBets.map(betKey));
            const localOnly = previousBets.filter(b => {
                const key = betKey(b);
                return !apiKeys.has(key) && b.status === 'active';
            });
            state.bets = [...apiBets, ...localOnly];
        }

        // Transações
        const transactions = await apiGetTransactions();
        if (transactions && transactions.length > 0) {
            state.transactions = transactions;
        }

        // Bolões (carrega da API; se vazio, usa bolão padrão)
        try {
            const fetchedPools = await apiGetPools();
            pools.length = 0;
            if (fetchedPools && fetchedPools.length > 0) {
                pools.push(...fetchedPools);
                console.log(`[API] ${fetchedPools.length} bolões carregados`);
            } else {
                pools.push({ ...DEFAULT_POOL });
                console.log('[API] Bolão padrão disponível');
            }
        } catch (poolErr) {
            console.warn('[API] Erro ao carregar bolões:', poolErr);
            pools.length = 0;
            pools.push({ ...DEFAULT_POOL });
        }

        // Participações em bolões (servidor é fonte de verdade)
        try {
            const myPools = await apiGetMyPools();
            if (myPools && Array.isArray(myPools)) {
                state.poolParticipations = myPools.map(p => ({
                    id: `part_${p.id}`,
                    poolId: p.pool_id ?? p.poolId,
                    poolName: p.pool_name ?? p.poolName,
                    lotteryId: p.lottery ?? p.lotteryId,
                    lotteryName: p.lottery_name ?? p.lotteryName,
                    quotas: p.quotas ?? 0,
                    valuePerQuota: p.quota_price ?? p.quotaPrice,
                    totalValue: (p.quotas ?? 0) * (p.quota_price ?? p.quotaPrice ?? 100),
                    date: p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
                    drawDate: p.draw_date ?? p.drawDate,
                    numbers: p.numbers ?? [],
                    status: 'active'
                }));
                Storage.savePoolParticipations(state.poolParticipations);
            } else {
                state.poolParticipations = [];
            }
        } catch (myPoolsErr) {
            console.warn('[API] Erro ao carregar minhas participações em bolões:', myPoolsErr);
        }

        // Salva no cache local
        saveData();
        console.log('[API] Dados carregados da API PHP');
    } catch (err) {
        console.warn('[API] Erro ao carregar da API, usando cache local:', err);
    } finally {
        // Garante que sempre há pelo menos os bolões padrão disponíveis
        if (pools.length === 0) {
            pools.push({ ...DEFAULT_POOL });
            pools.push({ ...DEFAULT_POOL_LOTOFACIL });
            pools.push({ ...DEFAULT_POOL_QUINA });
        }
    }
}

/**
 * Salva dados no localStorage (cache local)
 */
export function saveData() {
    if (!Storage.isAvailable()) return;

    try {
        Storage.saveBalance(state.balance);
        Storage.saveBets(state.bets);
        Storage.saveTransactions(state.transactions);
        Storage.savePreferences({
            currentBetsFilter: state.currentBetsFilter,
            currentPoolFilter: state.currentPoolFilter
        });
    } catch (error) {
        ErrorHandler.handle(error, 'saveData');
    }
}

export default {
    updateBalanceDisplays,
    showBalanceModal,
    closeBalanceModal,
    goToDeposit,
    showSuccessModal,
    closeSuccessModal,
    goToMyBets,
    loadSavedData,
    loadFromAPI,
    saveData
};
