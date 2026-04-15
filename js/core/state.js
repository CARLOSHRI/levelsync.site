/**
 * State Module - Gerenciamento de estado global da aplicação
 * @module core/state
 */

/**
 * Estado principal da aplicação
 */
export const state = {
    balance: 0,
    bets: [],
    transactions: [],
    // Participações em bolões
    poolParticipations: [],
    currentLottery: null,
    selectedNumbers: [],
    currentMode: 'manual',
    gamesToGenerate: 1,
    pendingMode: null,
    pendingBets: [],
    depositAmount: 100,
    currentBetsFilter: 'active',
    currentPoolFilter: 'all',
    qrCodeGenerated: false,
    showPastContests: false
};

/**
 * Resultados oficiais das loterias - populados pela API
 */
export const officialResults = {
    megasena: [],
    lotofacil: [],
    quina: []
};

/**
 * Estado de carregamento dos resultados
 */
export const resultsLoadingState = {
    megasena: false,
    lotofacil: false,
    quina: false,
    initialized: false
};

/**
 * Reseta o estado para valores iniciais
 */
export function resetState() {
    state.balance = 0;
    state.bets = [];
    state.transactions = [];
    state.currentLottery = null;
    state.selectedNumbers = [];
    state.currentMode = 'manual';
    state.gamesToGenerate = 1;
    state.pendingMode = null;
    state.pendingBets = [];
    state.depositAmount = 100;
    state.currentBetsFilter = 'active';
    state.currentPoolFilter = 'all';
    state.qrCodeGenerated = false;
    state.showPastContests = false;
}

/**
 * Atualiza o saldo do usuário
 * @param {number} newBalance - Novo valor do saldo
 */
export function updateBalance(newBalance) {
    state.balance = newBalance;
}

/**
 * Adiciona uma transação ao histórico
 * @param {Object} transaction - Objeto da transação
 */
export function addTransaction(transaction) {
    state.transactions.unshift(transaction);
}

/**
 * Adiciona uma aposta ao estado
 * @param {Object} bet - Objeto da aposta
 */
export function addBet(bet) {
    state.bets.unshift(bet);
}

/**
 * Remove jogos ganhos e perdidos (mantém apenas ativos)
 * Útil para testes
 */
export function clearFinishedBets() {
    const activeBets = state.bets.filter(bet => bet.status === 'active');
    const removedCount = state.bets.length - activeBets.length;
    state.bets = activeBets;
    console.log(`[App] Removidos ${removedCount} jogos (ganhos/perdidos). Restam ${activeBets.length} jogos ativos.`);
    return removedCount;
}

/**
 * Adiciona uma participação em bolão
 * @param {Object} participation - Objeto da participação
 */
export function addPoolParticipation(participation) {
    state.poolParticipations.unshift(participation);
}

/**
 * Obtém participações do usuário em um bolão específico
 * @param {string} poolId - ID do bolão
 * @returns {Object|null} Participação encontrada ou null
 */
export function getPoolParticipation(poolId) {
    return state.poolParticipations.find(p => p.poolId === poolId) || null;
}

/**
 * Obtém total de cotas do usuário em um bolão
 * @param {string} poolId - ID do bolão
 * @returns {number} Total de cotas
 */
export function getUserQuotasInPool(poolId) {
    const participation = getPoolParticipation(poolId);
    return participation ? participation.quotas : 0;
}

/**
 * Atualiza status de uma participação em bolão
 * @param {string} poolId - ID do bolão
 * @param {string} status - Novo status (active, won, lost)
 * @param {number} prize - Prêmio ganho (opcional)
 */
export function updatePoolParticipationStatus(poolId, status, prize = 0) {
    const participation = state.poolParticipations.find(p => p.poolId === poolId);
    if (participation) {
        participation.status = status;
        if (prize > 0) {
            participation.prize = prize;
        }
    }
}

export default state;
