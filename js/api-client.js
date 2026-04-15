/**
 * LotoGrana - API Client
 * Wrapper centralizado para comunicação com a API PHP via JWT
 * @module api-client
 */

import { AUTH_REQUIRED } from './core/config.js';

const API_BASE = 'api';

// ==================== TOKEN ====================

export function getToken() {
    return localStorage.getItem('lotograna_token');
}

export function setToken(token) {
    if (token) {
        localStorage.setItem('lotograna_token', token);
    } else {
        localStorage.removeItem('lotograna_token');
    }
}

export function isAuthenticated() {
    return !!getToken();
}

export function logout() {
    setToken(null);
    localStorage.removeItem('lotograna_user_name');
    localStorage.removeItem('lotograna_user_email');
    localStorage.removeItem('lotoexpert_auth');
    if (AUTH_REQUIRED) {
        window.location.href = 'login.html';
    }
}

// ==================== FETCH WRAPPER ====================

async function apiFetch(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/${endpoint}`, {
        ...options,
        headers
    });

    // Token expirado / inválido
    if (response.status === 401 && AUTH_REQUIRED) {
        setToken(null);
        localStorage.removeItem('lotoexpert_auth');
        window.location.href = 'login.html';
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `Erro ${response.status}`);
    }

    return data;
}

// ==================== AUTH ====================

export async function apiRegister(name, email, password, phone) {
    const data = await apiFetch('auth/register.php', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, phone: phone || null })
    });
    setToken(data.token);
    localStorage.setItem('lotograna_user_name', data.user.name);
    localStorage.setItem('lotograna_user_email', data.user.email);
    localStorage.setItem('lotoexpert_auth', '1');
    return data;
}

export async function apiLogin(email) {
    const data = await apiFetch('auth/login.php', {
        method: 'POST',
        body: JSON.stringify({ email })
    });
    setToken(data.token);
    localStorage.setItem('lotograna_user_name', data.user.name);
    localStorage.setItem('lotograna_user_email', data.user.email);
    localStorage.setItem('lotoexpert_auth', '1');
    return data;
}

export async function apiGetMe() {
    return apiFetch('auth/me.php');
}

// ==================== BETS ====================

export async function apiGetBets() {
    return apiFetch('bets/list.php');
}

export async function apiSaveBets(bets) {
    const result = await apiFetch('bets/save.php', {
        method: 'POST',
        body: JSON.stringify({ bets })
    });
    
    // Se houve ajustes de concurso devido ao horário de corte, notifica o usuário
    if (result.contest_adjustments && result.contest_adjustments.length > 0) {
        console.log('[API] Apostas ajustadas para próximo concurso:', result.contest_adjustments);
        if (result.notice && typeof window.showToast === 'function') {
            window.showToast(result.notice, 'info', 5000);
        }
    }
    
    return result;
}

/**
 * Obtém o status das apostas (horário de corte)
 * @returns {Promise<Object>} Status das apostas
 */
export async function apiBettingStatus() {
    return apiFetch('bets/status.php');
}

export async function apiUpdateBetResult(betId, status, hits, prize) {
    return apiFetch('bets/update-result.php', {
        method: 'PUT',
        body: JSON.stringify({ bet_id: betId, status, hits, prize: prize || null })
    });
}

// ==================== TRANSACTIONS ====================

export async function apiGetTransactions() {
    return apiFetch('transactions/list.php');
}

export async function apiSaveTransaction(tx) {
    return apiFetch('transactions/save.php', {
        method: 'POST',
        body: JSON.stringify(tx)
    });
}

// ==================== USER SELF-UPDATE ====================

export async function apiUpdateSelf(data) {
    return apiFetch('users/update-self.php', {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

// ==================== WITHDRAWALS ====================

export async function apiCreateWithdrawal(amount, pixKey) {
    return apiFetch('withdrawals/create.php', {
        method: 'POST',
        body: JSON.stringify({ amount, pix_key: pixKey })
    });
}

// ==================== POOLS ====================

export async function apiGetPools() {
    return apiFetch('pools/list.php');
}

export async function apiGetMyPools() {
    return apiFetch('pools/my.php');
}

export async function apiParticipatePool(poolId, quotas) {
    return apiFetch('pools/participate.php', {
        method: 'POST',
        body: JSON.stringify({ poolId, quotas })
    });
}

// ==================== ADMIN ====================

export async function apiAdminGetUsers() {
    return apiFetch('users/list.php');
}

export async function apiAdminGetUserDetail(userId) {
    return apiFetch(`users/detail.php?id=${userId}`);
}

export async function apiAdminAdjustBalance(userId, amount, reason) {
    return apiFetch('users/balance.php', {
        method: 'PUT',
        body: JSON.stringify({ user_id: userId, amount, reason })
    });
}

export async function apiAdminGetAllBets() {
    return apiFetch('bets/all.php');
}

export async function apiAdminGetAllTransactions() {
    return apiFetch('transactions/all.php');
}

export async function apiAdminCreatePool(pool) {
    return apiFetch('pools/create.php', {
        method: 'POST',
        body: JSON.stringify(pool)
    });
}

export async function apiAdminUpdatePool(poolId, data) {
    return apiFetch(`pools/update.php?id=${poolId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

export async function apiAdminDeletePool(poolId) {
    return apiFetch(`pools/delete.php?id=${poolId}`, {
        method: 'DELETE'
    });
}

export async function apiAdminGetPoolParticipants(poolId) {
    return apiFetch(`pools/participants.php?id=${poolId}`);
}

// ==================== DEPOSITS (DUTTYFY PIX) ====================

export async function apiCreateDeposit(amount, customer) {
    return apiFetch('deposits/create.php', {
        method: 'POST',
        body: JSON.stringify({ amount, customer })
    });
}

export async function apiCheckDepositStatus(transactionId) {
    return apiFetch(`deposits/status.php?transactionId=${encodeURIComponent(transactionId)}`);
}

export async function apiCheckPendingDeposits() {
    return apiFetch('deposits/pending.php');
}

// ==================== ADMIN - DEPOSITS ====================

export async function apiAdminGetDeposits(status = '') {
    const qs = status ? `?status=${status}` : '';
    return apiFetch(`deposits/list.php${qs}`);
}

export async function apiAdminMarkDepositPaid(depositId) {
    return apiFetch('deposits/mark-paid.php', {
        method: 'PUT',
        body: JSON.stringify({ deposit_id: depositId })
    });
}

export async function apiAdminUpdateDeposit(depositId, status) {
    return apiFetch('deposits/update.php', {
        method: 'PUT',
        body: JSON.stringify({ deposit_id: depositId, status })
    });
}

// ==================== ADMIN - USERS EXTENDED ====================

export async function apiAdminUpdateUser(userId, data) {
    return apiFetch('users/update.php', {
        method: 'PUT',
        body: JSON.stringify({ user_id: userId, ...data })
    });
}

export async function apiAdminBlockUser(userId, blocked) {
    return apiFetch('users/block.php', {
        method: 'PUT',
        body: JSON.stringify({ user_id: userId, blocked })
    });
}

// ==================== ADMIN - BETS EXTENDED ====================

export async function apiAdminUpdateBet(betId, data) {
    return apiFetch('bets/update.php', {
        method: 'PUT',
        body: JSON.stringify({ bet_id: betId, ...data })
    });
}

export async function apiAdminDeleteBet(betId) {
    return apiFetch(`bets/delete.php?id=${betId}`, {
        method: 'DELETE'
    });
}

// ==================== LOTTERY RESULTS ====================

/**
 * Busca últimos resultados de loterias do nosso banco
 * @param {string} lottery - ID da loteria (megasena, lotofacil, quina) ou vazio para todas
 * @param {number} count - Quantidade de resultados (padrão 1)
 */
export async function apiGetResults(lottery = '', count = 1) {
    let qs = '';
    if (lottery) {
        qs = `?lottery=${encodeURIComponent(lottery)}&count=${count}`;
    }
    // Endpoint público, não precisa de token, mas usamos apiFetch por conveniência
    const response = await fetch(`${API_BASE}/results/latest.php${qs}`);
    if (!response.ok) {
        throw new Error(`Erro ${response.status}`);
    }
    return response.json();
}

/**
 * Busca resultado de um concurso específico
 * @param {string} lottery - ID da loteria
 * @param {number} contest - Número do concurso
 */
export async function apiGetContestResult(lottery, contest) {
    const response = await fetch(`${API_BASE}/results/contest.php?lottery=${encodeURIComponent(lottery)}&contest=${contest}`);
    if (!response.ok) {
        throw new Error(`Erro ${response.status}`);
    }
    return response.json();
}

export default {
    getToken, setToken, isAuthenticated, logout,
    apiRegister, apiLogin, apiGetMe,
    apiGetBets, apiSaveBets, apiUpdateBetResult, apiBettingStatus,
    apiGetTransactions, apiSaveTransaction,
    apiUpdateSelf,
    apiCreateWithdrawal,
    apiGetPools, apiGetMyPools, apiParticipatePool,
    apiCreateDeposit, apiCheckDepositStatus, apiCheckPendingDeposits,
    apiAdminGetUsers, apiAdminGetUserDetail, apiAdminAdjustBalance,
    apiAdminGetAllBets, apiAdminGetAllTransactions,
    apiAdminCreatePool, apiAdminUpdatePool, apiAdminDeletePool, apiAdminGetPoolParticipants,
    apiAdminGetDeposits, apiAdminMarkDepositPaid, apiAdminUpdateDeposit,
    apiAdminUpdateUser, apiAdminBlockUser,
    apiAdminUpdateBet, apiAdminDeleteBet,
    apiGetResults, apiGetContestResult
};
