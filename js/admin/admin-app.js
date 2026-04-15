/**
 * LotoGrana Admin Dashboard
 * @module admin/admin-app
 */

// ==================== API CONFIG ====================
const API_BASE = './api';

function getAdminToken() {
    return localStorage.getItem('lotograna_admin_token');
}

function setAdminToken(token) {
    if (token) localStorage.setItem('lotograna_admin_token', token);
    else localStorage.removeItem('lotograna_admin_token');
}

async function adminFetch(endpoint, options = {}) {
    const token = getAdminToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let response;
    try {
        response = await fetch(`${API_BASE}/${endpoint}`, { ...options, headers });
    } catch (err) {
        const e = new Error('Não foi possível conectar ao servidor. Verifique se a API está rodando.');
        e.status = 0;
        e.isNetworkError = true;
        throw e;
    }

    let data;
    try {
        data = await response.json();
    } catch (_) {
        const e = new Error(response.status === 404 ? 'API não encontrada. Verifique se o servidor PHP está rodando.' : `Erro ${response.status}`);
        e.status = response.status;
        throw e;
    }

    if (response.status === 401) {
        setAdminToken(null);
        document.getElementById('admin-login').style.display = '';
        document.getElementById('admin-app').style.display = 'none';
        const e = new Error('Sessão expirada');
        e.status = 401;
        throw e;
    }

    if (!response.ok) {
        const e = new Error(data.error || `Erro ${response.status}`);
        e.status = response.status;
        throw e;
    }
    return data;
}

// ==================== STATE ====================
let allUsers = [];
let allPools = [];
let allBets = [];
let allTx = [];
let allDeposits = [];
let depositTotals = {};
let currentBetFilter = 'all';
let currentTxFilter = 'all';
let currentDepositFilter = 'all';
let balanceAdjustUid = null;

// ==================== LOTTERIES CONFIG ====================
const lotteryNames = {
    megasena: 'Mega Sena',
    lotofacil: 'LotoFácil',
    quina: 'Quina'
};

// ==================== AUTH ====================
document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;
    const btn = document.getElementById('admin-login-btn');
    const errorEl = document.getElementById('admin-login-error');

    btn.disabled = true;
    btn.textContent = 'Verificando...';
    errorEl.classList.add('hidden');

    try {
        const data = await adminFetch('auth/admin-login.php', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        setAdminToken(data.token);
        showDashboard();
    } catch (err) {
        showLoginError(err.message || 'Erro ao fazer login.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Entrar';
    }
});

// Modo Demo - listener do evento disparado pelo script inline no head
document.addEventListener('admin-enter-demo', function() {
    if (typeof window._enterDemoModeImpl === 'function') {
        window._enterDemoModeImpl();
    }
});
// Se o módulo carregou depois do clique em Demo, executa ao ficar pronto
if (window._demoRequested && typeof window._enterDemoModeImpl === 'function') {
    setTimeout(function() {
        if (window._demoRequested) window._enterDemoModeImpl();
    }, 0);
}

// Auto-login se tem token salvo
(async function checkSavedToken() {
    if (window._demoRequested) return; // Modo demo solicitado, não sobrescrever
    const token = getAdminToken();
    if (!token) {
        document.getElementById('admin-login').style.display = '';
        document.getElementById('admin-app').style.display = 'none';
        return;
    }

    try {
        const me = await adminFetch('auth/me.php');
        if (me.role === 'admin') {
            showDashboard();
            return;
        }
    } catch (e) {
        // Só limpa token quando for 401 (sessão expirada)
        if (e.status === 401) {
            setAdminToken(null);
            showLoginError('Sessão expirada. Faça login novamente.');
        } else {
            // Erro de rede/404/500: mantém token e mostra opção de retry
            showConnectionError(e.message);
            return;
        }
    }

    document.getElementById('admin-login').style.display = '';
    document.getElementById('admin-app').style.display = 'none';
})();

function showConnectionError(msg) {
    document.getElementById('admin-login').style.display = '';
    document.getElementById('admin-app').style.display = 'none';
    const errorEl = document.getElementById('admin-login-error');
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
    errorEl.classList.add('admin-connection-error');
    // Adiciona botão de retry se não existir
    let retryWrap = document.getElementById('admin-retry-wrap');
    if (!retryWrap) {
        retryWrap = document.createElement('div');
        retryWrap.id = 'admin-retry-wrap';
        retryWrap.className = 'admin-retry-wrap';
        retryWrap.innerHTML = '<button type="button" class="admin-login-btn admin-retry-btn" onclick="retryCheckToken()">Tentar novamente</button>';
        document.getElementById('admin-login-form').after(retryWrap);
    }
    retryWrap.classList.remove('hidden');
}

window.retryCheckToken = async function() {
    const retryWrap = document.getElementById('admin-retry-wrap');
    if (retryWrap) retryWrap.classList.add('hidden');
    document.getElementById('admin-login-error').classList.add('hidden');
    document.getElementById('admin-login-error').classList.remove('admin-connection-error');

    const token = getAdminToken();
    if (!token) return;

    try {
        const me = await adminFetch('auth/me.php');
        if (me.role === 'admin') {
            showDashboard();
            return;
        }
    } catch (e) {
        if (e.status === 401) {
            setAdminToken(null);
            showLoginError('Sessão expirada. Faça login novamente.');
        } else {
            showConnectionError(e.message);
        }
        return;
    }
    
    document.getElementById('admin-login').style.display = '';
    document.getElementById('admin-app').style.display = 'none';
};

function showLoginError(msg) {
    const el = document.getElementById('admin-login-error');
    el.textContent = msg;
    el.classList.remove('hidden');
}

window.adminLogout = function() {
    setAdminToken(null);
    document.getElementById('admin-retry-wrap')?.classList.add('hidden');
    document.getElementById('admin-login-error')?.classList.add('hidden');
    document.getElementById('admin-login').style.display = '';
    document.getElementById('admin-app').style.display = 'none';
};

// ==================== DASHBOARD INIT ====================
const ADMIN_SECTION_KEY = 'lotograna_admin_section';

async function showDashboard() {
    document.getElementById('admin-login').style.display = 'none';
    document.getElementById('admin-app').style.display = 'flex';
    document.getElementById('admin-retry-wrap')?.classList.add('hidden');
    updateModeBadge();
    document.getElementById('stats-date').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    await loadAllData();
    renderStats();
    startDepositPolling();
    const savedSection = sessionStorage.getItem(ADMIN_SECTION_KEY);
    if (savedSection && document.getElementById(`section-${savedSection}`)) {
        showSection(savedSection);
    }
}

function updateModeBadge() {
    const badge = document.getElementById('admin-mode-badge');
    if (badge) {
        badge.textContent = isDemoMode ? 'Demo' : 'Online';
        badge.classList.toggle('demo', isDemoMode);
    }
}

window.refreshAdminData = async function() {
    const btn = document.querySelector('.admin-refresh-btn');
    if (btn) {
        btn.disabled = true;
        btn.classList.add('admin-refresh-loading');
    }
    try {
        if (isDemoMode) {
            enterDemoMode();
            showToast('Dados atualizados', 'success');
        } else {
            await loadAllData();
            const activeSection = document.querySelector('.admin-section.active')?.id?.replace('section-', '') || 'stats';
            showSection(activeSection);
            showToast('Dados atualizados com sucesso', 'success');
        }
    } catch (err) {
        showToast(err.message || 'Erro ao atualizar dados', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('admin-refresh-loading');
        }
    }
};

async function loadAllData() {
    try {
        const [users, pools, bets, txs, depositsData, withdrawalsData] = await Promise.all([
            adminFetch('users/list.php'),
            adminFetch('pools/list.php'),
            adminFetch('bets/all.php'),
            adminFetch('transactions/all.php'),
            adminFetch('deposits/list.php').catch(() => ({ deposits: [], totals: {} })),
            adminFetch('withdrawals/list.php').catch(() => ({ withdrawals: [], totals: {} }))
        ]);

        allUsers = users;
        allPools = pools;
        allBets = bets.map(b => ({
            ...b,
            userName: b.user_name || b.userName || '-',
            lotteryName: b.lottery_name || b.lotteryName || '-',
            lotteryId: b.lottery_id || b.lotteryId || ''
        }));
        allTx = txs.map(t => ({
            ...t,
            userName: t.user_name || t.userName || '-',
            userEmail: t.user_email || t.userEmail || '',
            userPhone: t.user_phone || t.userPhone || ''
        }));
        allDeposits = (depositsData.deposits || []).map(d => ({
            ...d,
            userName: d.user_name || '-',
            userEmail: d.user_email || '-',
            userPhone: d.user_phone || ''
        }));
        depositTotals = depositsData.totals || {};
        allWithdrawals = withdrawalsData.withdrawals || [];
        withdrawalTotals = withdrawalsData.totals || {};
    } catch (err) {
        console.error('[Admin] Erro ao carregar dados:', err);
        showToast('Erro ao carregar dados', 'error');
    }
}

// ==================== NAVIGATION ====================
// Event delegation: garante que cliques no menu funcionem mesmo com carregamento assíncrono
document.addEventListener('click', function(e) {
    const btn = e.target.closest('.admin-nav-item');
    if (btn && btn.dataset.section) {
        e.preventDefault();
        if (typeof window.showSection === 'function') window.showSection(btn.dataset.section);
    }
});

window.toggleAdminSidebar = function() {
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('admin-sidebar-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('hidden', !sidebar.classList.contains('open'));
        document.body.classList.toggle('admin-sidebar-open', sidebar.classList.contains('open'));
    }
};

window.showSection = function(section) {
    document.querySelectorAll('.admin-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.admin-nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`section-${section}`)?.classList.add('active');
    const navItem = document.querySelector(`.admin-nav-item[data-section="${section}"]`);
    if (navItem) navItem.classList.add('active');
    try { sessionStorage.setItem(ADMIN_SECTION_KEY, section); } catch (_) {}
    // Fecha sidebar no mobile ao trocar de seção
    if (window.matchMedia('(max-width: 768px)').matches) {
        const sidebar = document.getElementById('admin-sidebar');
        const overlay = document.getElementById('admin-sidebar-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.add('hidden');
        document.body.classList.remove('admin-sidebar-open');
    }

    if (section === 'stats') renderStats();
    if (section === 'users') renderUsers();
    if (section === 'deposits') renderDeposits();
    if (section === 'pools') renderPools();
    if (section === 'bets') renderBets();
    if (section === 'withdrawals') renderWithdrawals();
    if (section === 'transactions') renderTransactions();
    if (section === 'notifications') renderNotifications();
};

// ==================== STATS ====================
// Converte string de data para objeto Date (suporta dd/mm/yyyy, yyyy-mm-dd, ISO)
function parseToDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    if (typeof dateStr === 'string') {
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
        }
        return new Date(dateStr);
    }
    return null;
}

// Filtra array por range de datas
function filterByDateRange(arr, dateField, startDate, endDate) {
    if (!startDate && !endDate) return arr;
    return arr.filter(item => {
        const d = parseToDate(item[dateField] || item.created_at || item.createdAt);
        if (!d || isNaN(d.getTime())) return true; // Inclui itens sem data válida
        if (startDate && d < startDate) return false;
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (d > end) return false;
        }
        return true;
    });
}

function getStatsDateRange() {
    const startEl = document.getElementById('stats-filter-start');
    const endEl = document.getElementById('stats-filter-end');
    const startVal = startEl ? startEl.value : '';
    const endVal = endEl ? endEl.value : '';
    return {
        start: startVal ? new Date(startVal + 'T00:00:00') : null,
        end: endVal ? new Date(endVal + 'T23:59:59') : null
    };
}

window.applyStatsDateFilter = function() {
    renderStats();
};

window.clearStatsDateFilter = function() {
    const startEl = document.getElementById('stats-filter-start');
    const endEl = document.getElementById('stats-filter-end');
    if (startEl) startEl.value = '';
    if (endEl) endEl.value = '';
    renderStats();
};

function renderStats() {
    try {
        const { start, end } = getStatsDateRange();

        const filteredBets = filterByDateRange(allBets || [], 'date', start, end);
        const filteredTx = filterByDateRange(allTx || [], 'date', start, end);
        const filteredDeposits = filterByDateRange(allDeposits || [], 'created_at', start, end);

        const totalBalance = (allUsers || []).reduce((sum, u) => sum + (u.balance || 0), 0);
        const activePools = (allPools || []).filter(p => p.status === 'active').length;

        const statUsers = document.getElementById('stat-users');
        if (statUsers) statUsers.textContent = (allUsers || []).length;
        const setStat = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setStat('stat-balance', formatCurrency(totalBalance));
        setStat('stat-bets', filteredBets.length);
        setStat('stat-bets-won', filteredBets.filter(b => b.status === 'won').length);
        setStat('stat-bets-lost', filteredBets.filter(b => b.status === 'lost').length);
        setStat('stat-pools', activePools);

        // Saques pendentes
        const wdPendingEl = document.getElementById('stat-withdrawals-pending');
        if (wdPendingEl) {
            const pendingWd = (allWithdrawals || []).filter(w => w.status === 'pending');
            wdPendingEl.textContent = `${pendingWd.length} (${formatCurrency(pendingWd.reduce((s, w) => s + (w.amount || 0), 0))})`;
        }

        // Depósitos stats filtrados
        const depCompleted = document.getElementById('stat-deposits-completed');
        const depPending = document.getElementById('stat-deposits-pending');
        if (start || end) {
            const completedDeps = filteredDeposits.filter(d => d.status === 'COMPLETED');
            const pendingDeps = filteredDeposits.filter(d => d.status === 'PENDING');
            if (depCompleted) depCompleted.textContent = formatCurrency(completedDeps.reduce((s, d) => s + (d.amount || 0), 0));
            if (depPending) depPending.textContent = `${pendingDeps.length} (${formatCurrency(pendingDeps.reduce((s, d) => s + (d.amount || 0), 0))})`;
        } else {
            if (depCompleted) depCompleted.textContent = formatCurrency((depositTotals || {}).completed_amount || 0);
            if (depPending) depPending.textContent = `${(depositTotals || {}).pending_count || 0} (${formatCurrency((depositTotals || {}).pending_amount || 0)})`;
        }

        // Receita/Lucro
        const totalBetValue = filteredBets.reduce((s, b) => s + (b.value || 0), 0);
        const totalPrizes = filteredBets.filter(b => b.status === 'won').reduce((s, b) => s + (b.prize || 0), 0);
        const profit = totalBetValue - totalPrizes;

        const statTotalBet = document.getElementById('stat-total-bet-value');
        const statTotalPrizes = document.getElementById('stat-total-prizes');
        const statProfit = document.getElementById('stat-profit');

        if (statTotalBet) statTotalBet.textContent = formatCurrency(totalBetValue);
        if (statTotalPrizes) statTotalPrizes.textContent = formatCurrency(totalPrizes);
        if (statProfit) {
            statProfit.textContent = formatCurrency(profit);
            statProfit.style.color = profit >= 0 ? 'var(--admin-accent)' : 'var(--admin-red)';
        }

        const tbody = document.getElementById('stats-recent-users');
        if (tbody) {
            tbody.innerHTML = (allUsers || []).slice(0, 5).map(u => `
                <tr>
                    <td data-label="Nome">${esc(u.name || '-')}</td>
                    <td data-label="E-mail">${esc(u.email || '-')}</td>
                    <td data-label="Telefone">${phoneDisplayHtml(u.phone)}</td>
                    <td data-label="Saldo">${formatCurrency(u.balance || 0)}</td>
                    <td data-label="Data">${formatDate(u.created_at || u.createdAt)}</td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error('[Admin] renderStats erro:', err);
    }
}

// ==================== USERS ====================
function renderUsers(filter = '') {
    const filtered = filter
        ? allUsers.filter(u => (u.name || '').toLowerCase().includes(filter) || (u.email || '').toLowerCase().includes(filter))
        : allUsers;

    const tbody = document.getElementById('users-table-body');
    const empty = document.getElementById('users-empty');

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    tbody.innerHTML = filtered.map(u => `
        <tr>
            <td data-label="Nome"><strong>${esc(u.name || '-')}</strong></td>
            <td data-label="E-mail">${esc(u.email || '-')}</td>
            <td data-label="Telefone">${phoneDisplayHtml(u.phone)}</td>
            <td data-label="Saldo">${formatCurrency(u.balance || 0)}</td>
            <td data-label="Status">${u.blocked ? '<span class="badge badge-red">Bloqueado</span>' : '<span class="badge badge-green">Ativo</span>'}</td>
            <td data-label="Cadastro">${formatDate(u.created_at || u.createdAt)}</td>
            <td data-label="Ações">
                <button class="btn-sm btn-outline" onclick="openUserActionsModal('${String(u.id || '').replace(/'/g, "\\'")}')">Ações</button>
            </td>
        </tr>
    `).join('');
}

window.filterUsers = function() {
    const query = document.getElementById('users-search').value.trim().toLowerCase();
    renderUsers(query);
};

window.openBalanceModal = function(uid) {
    balanceAdjustUid = uid;
    const user = allUsers.find(u => u.id === uid);
    document.getElementById('modal-balance-user').textContent = `${user?.name || ''} — Saldo atual: ${formatCurrency(user?.balance || 0)}`;
    document.getElementById('modal-balance-amount').value = '';
    document.getElementById('modal-balance-reason').value = '';
    document.getElementById('modal-balance').classList.remove('hidden');
};

window.confirmBalanceAdjust = async function() {
    const amount = parseFloat(document.getElementById('modal-balance-amount').value);
    const reason = document.getElementById('modal-balance-reason').value.trim();
    if (isNaN(amount) || amount === 0) {
        showToast('Digite um valor válido', 'error');
        return;
    }

    const user = allUsers.find(u => u.id === balanceAdjustUid);
    const newBalance = (user?.balance || 0) + amount;
    if (newBalance < 0) {
        showToast('Saldo não pode ficar negativo', 'error');
        return;
    }

    try {
        if (!isDemoMode) {
            await adminFetch('users/balance.php', {
                method: 'PUT',
                body: JSON.stringify({
                    user_id: balanceAdjustUid,
                    amount: amount,
                    reason: reason || 'Ajuste pelo admin'
                })
            });
        }

        if (user) user.balance = newBalance;
        allTx.unshift({
            user_id: balanceAdjustUid,
            userName: user?.name || '',
            type: amount > 0 ? 'deposit' : 'withdraw',
            method: 'admin',
            value: Math.abs(amount),
            date: new Date().toLocaleDateString('pt-BR'),
            created_at: new Date().toISOString()
        });
        closeModal('modal-balance');
        renderUsers();
        renderStats();
        showToast(`Saldo ajustado: ${amount > 0 ? '+' : ''}${formatCurrency(amount)}`, 'success');
    } catch (err) {
        showToast('Erro ao ajustar saldo', 'error');
        console.error(err);
    }
};

// Painel de ações do usuário
let userActionsUid = null;

window.openUserActionsModal = function(uid) {
    const user = allUsers.find(u => u.id === uid);
    if (!user) return;
    userActionsUid = uid;
    document.getElementById('modal-user-actions-title').textContent = user.name || 'Usuário';
    document.getElementById('modal-user-actions-subtitle').textContent = `${esc(user.email || '')} — Saldo: ${formatCurrency(user.balance || 0)}`;
    const blockBtn = document.getElementById('modal-user-actions-block-btn');
    const unblockBtn = document.getElementById('modal-user-actions-unblock-btn');
    if (user.role === 'admin') {
        blockBtn.style.display = 'none';
        unblockBtn.style.display = 'none';
    } else {
        blockBtn.style.display = user.blocked ? 'none' : 'inline-block';
        unblockBtn.style.display = user.blocked ? 'inline-block' : 'none';
    }
    document.getElementById('modal-user-actions').classList.remove('hidden');
};

window.fromUserActions = function(action) {
    const uid = userActionsUid;
    if (!uid) return;
    closeModal('modal-user-actions');
    if (action === 'detail') openUserDetail(uid);
    else if (action === 'balance') openBalanceModal(uid);
    else if (action === 'edit') openEditUserModal(uid);
    else if (action === 'block') toggleBlockUser(uid);
    else if (action === 'unblock') toggleBlockUser(uid);
};

// Editar usuário
window.openEditUserModal = function(uid) {
    const user = allUsers.find(u => u.id === uid);
    if (!user) return;
    document.getElementById('modal-edit-user-id').value = uid;
    document.getElementById('modal-edit-user-name').value = user.name || '';
    document.getElementById('modal-edit-user-email').value = user.email || '';
    document.getElementById('modal-edit-user-phone').value = user.phone || '';
    document.getElementById('modal-edit-user-role').value = user.role || 'user';
    document.getElementById('modal-edit-user').classList.remove('hidden');
};

window.confirmEditUser = async function() {
    const uid = parseInt(document.getElementById('modal-edit-user-id').value);
    const name = document.getElementById('modal-edit-user-name').value.trim();
    const email = document.getElementById('modal-edit-user-email').value.trim();
    const phone = document.getElementById('modal-edit-user-phone').value.trim();
    const role = document.getElementById('modal-edit-user-role').value;

    if (!name || !email) {
        showToast('Nome e e-mail são obrigatórios', 'error');
        return;
    }

    try {
        if (!isDemoMode) {
            await adminFetch('users/update.php', {
                method: 'PUT',
                body: JSON.stringify({ user_id: uid, name, email, phone, role })
            });
        }

        const user = allUsers.find(u => u.id === uid);
        if (user) {
            user.name = name;
            user.email = email;
            user.phone = phone;
            user.role = role;
        }
        closeModal('modal-edit-user');
        renderUsers();
        showToast('Usuário atualizado', 'success');
    } catch (err) {
        showToast(err.message || 'Erro ao atualizar usuário', 'error');
    }
};

// Bloquear/Desbloquear
window.toggleBlockUser = async function(uid) {
    const user = allUsers.find(u => u.id === uid);
    if (!user) return;
    const newState = !user.blocked;
    const action = newState ? 'bloquear' : 'desbloquear';
    if (!confirm(`Deseja ${action} o usuário "${user.name}"?`)) return;

    try {
        if (!isDemoMode) {
            await adminFetch('users/block.php', {
                method: 'PUT',
                body: JSON.stringify({ user_id: uid, blocked: newState })
            });
        }
        user.blocked = newState;
        renderUsers();
        showToast(`Usuário ${newState ? 'bloqueado' : 'desbloqueado'}`, 'success');
    } catch (err) {
        showToast(err.message || 'Erro ao alterar bloqueio', 'error');
    }
};

// Detalhes do usuário
window.openUserDetail = async function(uid) {
    const user = allUsers.find(u => u.id === uid);
    if (!user) return;

    const content = document.getElementById('modal-user-detail-content');
    content.innerHTML = '<p style="color:#999;font-size:13px;">Carregando detalhes...</p>';
    document.getElementById('modal-user-detail').classList.remove('hidden');

    let userBets = [], userTx = [], userDeposits = [], stats = {};

    if (isDemoMode) {
        userBets = allBets.filter(b => b.userId === uid || b.user_id === uid);
        userTx = allTx.filter(t => t.userId === uid || t.user_id === uid);
        userDeposits = allDeposits.filter(d => d.user_id === uid);
        stats = {
            total_bets: userBets.length,
            won_bets: userBets.filter(b => b.status === 'won').length,
            lost_bets: userBets.filter(b => b.status === 'lost').length,
            active_bets: userBets.filter(b => b.status === 'active').length,
            total_bet_value: userBets.reduce((s, b) => s + (b.value || 0), 0),
            total_prizes: userBets.filter(b => b.status === 'won').reduce((s, b) => s + (b.prize || 0), 0),
            total_deposited: userDeposits.filter(d => d.status === 'COMPLETED').reduce((s, d) => s + (d.amount || 0), 0),
            completed_deposits: userDeposits.filter(d => d.status === 'COMPLETED').length
        };
    } else {
        try {
            const detail = await adminFetch(`users/detail.php?id=${uid}`);
            userBets = detail.bets || [];
            userTx = detail.transactions || [];
            userDeposits = detail.deposits || [];
            stats = detail.stats || {};
        } catch (err) {
            userBets = allBets.filter(b => b.user_id === uid);
            userTx = allTx.filter(t => t.user_id === uid);
            stats = {};
        }
    }

    content.innerHTML = `
        <div class="user-detail-header">
            <div class="user-detail-avatar">${(user.name || 'U')[0].toUpperCase()}</div>
            <div class="user-detail-info">
                <h3>${esc(user.name || '-')} ${user.blocked ? '<span class="badge badge-red" style="font-size:11px;">Bloqueado</span>' : ''}</h3>
                <p>${esc(user.email || '-')} — Cadastro: ${formatDate(user.created_at || user.createdAt)}</p>
                <p style="margin-top:4px;">${user.phone ? `📱 ${phoneDisplayHtml(user.phone)}` : ''}</p>
                <p style="margin-top:4px;"><strong>Saldo: ${formatCurrency(user.balance || 0)}</strong></p>
            </div>
        </div>

        <!-- Estatísticas do Usuário -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:16px 0;">
            <div style="background:var(--admin-surface-2);border:1px solid var(--admin-border);border-radius:8px;padding:10px;text-align:center;">
                <div style="font-size:11px;color:#999;">Total Apostas</div>
                <div style="font-size:18px;font-weight:700;color:var(--admin-blue);">${stats.total_bets || 0}</div>
            </div>
            <div style="background:var(--admin-surface-2);border:1px solid var(--admin-border);border-radius:8px;padding:10px;text-align:center;">
                <div style="font-size:11px;color:#999;">Ganhou</div>
                <div style="font-size:18px;font-weight:700;color:var(--admin-accent);">${stats.won_bets || 0}</div>
            </div>
            <div style="background:var(--admin-surface-2);border:1px solid var(--admin-border);border-radius:8px;padding:10px;text-align:center;">
                <div style="font-size:11px;color:#999;">Perdeu</div>
                <div style="font-size:18px;font-weight:700;color:var(--admin-red);">${stats.lost_bets || 0}</div>
            </div>
            <div style="background:var(--admin-surface-2);border:1px solid var(--admin-border);border-radius:8px;padding:10px;text-align:center;">
                <div style="font-size:11px;color:#999;">Depositado</div>
                <div style="font-size:18px;font-weight:700;color:var(--admin-accent);">${formatCurrency(stats.total_deposited || 0)}</div>
            </div>
            <div style="background:var(--admin-surface-2);border:1px solid var(--admin-border);border-radius:8px;padding:10px;text-align:center;">
                <div style="font-size:11px;color:#999;">Prêmios</div>
                <div style="font-size:18px;font-weight:700;color:var(--admin-yellow);">${formatCurrency(stats.total_prizes || 0)}</div>
            </div>
            <div style="background:var(--admin-surface-2);border:1px solid var(--admin-border);border-radius:8px;padding:10px;text-align:center;">
                <div style="font-size:11px;color:#999;">Valor Apostado</div>
                <div style="font-size:18px;font-weight:700;color:var(--admin-purple);">${formatCurrency(stats.total_bet_value || 0)}</div>
            </div>
        </div>

        <h4 style="font-size:14px;margin:16px 0 8px;">Apostas (${userBets.length})</h4>
        ${userBets.length ? `
            <table class="admin-table" style="margin-bottom:16px;">
                <thead><tr><th>Loteria</th><th>Números</th><th>Valor</th><th>Status</th></tr></thead>
                <tbody>
                    ${userBets.slice(0, 20).map(b => `
                        <tr>
                            <td>${esc(b.lottery_name || b.lotteryName || b.lottery_id || b.lotteryId || '-')}</td>
                            <td style="font-size:11px;">${(b.numbers || []).join(', ')}</td>
                            <td>${formatCurrency(b.value || 0)}</td>
                            <td>${statusBadge(b.status)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : '<p class="admin-empty">Nenhuma aposta</p>'}

        <h4 style="font-size:14px;margin:16px 0 8px;">Depósitos (${userDeposits.length})</h4>
        ${userDeposits.length ? `
            <table class="admin-table" style="margin-bottom:16px;">
                <thead><tr><th>Valor</th><th>Status</th><th>Creditado</th><th>Data</th></tr></thead>
                <tbody>
                    ${userDeposits.slice(0, 20).map(d => `
                        <tr>
                            <td>${formatCurrency(d.amount || 0)}</td>
                            <td>${depositStatusBadge(d.status)}</td>
                            <td>${d.credited ? '<span class="badge badge-green">Sim</span>' : '<span class="badge badge-gray">Não</span>'}</td>
                            <td>${formatDate(d.created_at)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : '<p class="admin-empty">Nenhum depósito</p>'}

        <h4 style="font-size:14px;margin:16px 0 8px;">Transações (${userTx.length})</h4>
        ${userTx.length ? `
            <table class="admin-table">
                <thead><tr><th>Tipo</th><th>Valor</th><th>Motivo</th><th>Data</th></tr></thead>
                <tbody>
                    ${userTx.slice(0, 20).map(t => `
                        <tr>
                            <td>${typeBadge(t.type)}</td>
                            <td>${formatCurrency(t.value || 0)}</td>
                            <td style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;">${esc(t.reason || '-')}</td>
                            <td>${t.date || formatDate(t.created_at || t.createdAt)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : '<p class="admin-empty">Nenhuma transação</p>'}
    `;
};

// ==================== DEPOSITS ====================
function renderDeposits() {
    let filtered = currentDepositFilter === 'all' 
        ? allDeposits 
        : allDeposits.filter(d => d.status === currentDepositFilter);

    const searchQuery = (document.getElementById('deposits-search')?.value || '').trim().toLowerCase();
    if (searchQuery) {
        filtered = filtered.filter(d =>
            (d.userName || '').toLowerCase().includes(searchQuery) ||
            (d.userEmail || '').toLowerCase().includes(searchQuery) ||
            (d.userPhone || '').replace(/\D/g, '').includes(searchQuery.replace(/\D/g, '')) ||
            (d.userPhone || '').toLowerCase().includes(searchQuery)
        );
    }

    const tbody = document.getElementById('deposits-table-body');
    const empty = document.getElementById('deposits-empty');

    // Atualiza totais
    const depTotalCompleted = document.getElementById('dep-total-completed');
    const depTotalPending = document.getElementById('dep-total-pending');
    const depCountCompleted = document.getElementById('dep-count-completed');
    const depCountExpired = document.getElementById('dep-count-expired');

    if (depTotalCompleted) depTotalCompleted.textContent = formatCurrency(depositTotals.completed_amount || 0);
    if (depTotalPending) depTotalPending.textContent = `${depositTotals.pending_count || 0} (${formatCurrency(depositTotals.pending_amount || 0)})`;
    if (depCountCompleted) depCountCompleted.textContent = depositTotals.completed_count || 0;
    if (depCountExpired) depCountExpired.textContent = `${depositTotals.expired_count || 0} / ${depositTotals.cancelled_count || 0}`;

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    tbody.innerHTML = filtered.slice(0, 200).map(d => `
        <tr>
            <td data-label="Usuário"><strong>${esc(d.userName || '-')}</strong><br><span style="font-size:11px;color:#999;">${esc(d.userEmail || '')}</span></td>
            <td data-label="Valor">${formatCurrency(d.amount || 0)}</td>
            <td data-label="Status">${depositStatusBadge(d.status)}</td>
            <td data-label="Creditado">${d.credited ? '<span class="badge badge-green">Sim</span>' : '<span class="badge badge-gray">Não</span>'}</td>
            <td data-label="Data">${formatDate(d.created_at)}</td>
            <td data-label="Ações">
                ${d.status === 'PENDING' && !d.credited ? `<button class="btn-sm btn-green" onclick="markDepositPaid(${d.id})">Marcar Pago</button>` : ''}
            </td>
        </tr>
    `).join('');
}

window.filterDepositsAdmin = function(filter) {
    currentDepositFilter = filter;
    document.querySelectorAll('#section-deposits .admin-filter-btn').forEach(btn => {
        const text = btn.textContent.trim().toLowerCase();
        const map = { 'all': 'todos', 'PENDING': 'pendentes', 'COMPLETED': 'confirmados', 'EXPIRED': 'expirados' };
        btn.classList.toggle('active', text.includes(map[filter] || filter.toLowerCase()));
    });
    renderDeposits();
};

window.filterDepositsSearch = function() {
    renderDeposits();
};

window.markDepositPaid = async function(depositId) {
    if (!confirm('Confirma marcar este depósito como PAGO e creditar o saldo ao usuário?')) return;

    try {
        if (!isDemoMode) {
            await adminFetch('deposits/mark-paid.php', {
                method: 'PUT',
                body: JSON.stringify({ deposit_id: depositId })
            });
        }

        // Atualiza local
        const dep = allDeposits.find(d => d.id === depositId);
        if (dep) {
            dep.status = 'COMPLETED';
            dep.credited = true;
            // Atualiza saldo do usuário local
            const user = allUsers.find(u => u.id === dep.user_id);
            if (user) user.balance = (user.balance || 0) + (dep.amount || 0);
        }

        // Recarrega totais
        if (!isDemoMode) {
            const depositsData = await adminFetch('deposits/list.php').catch(() => ({ deposits: [], totals: {} }));
            allDeposits = (depositsData.deposits || []).map(d => ({
                ...d,
                userName: d.user_name || '-',
                userEmail: d.user_email || '-'
            }));
            depositTotals = depositsData.totals || {};
        }

        renderDeposits();
        renderStats();
        renderUsers();
        showToast('Depósito marcado como pago e saldo creditado!', 'success');
    } catch (err) {
        showToast(err.message || 'Erro ao marcar como pago', 'error');
    }
};

window.updateDepositStatus = async function(depositId, currentStatus) {
    const newStatus = prompt('Novo status (PENDING, COMPLETED, EXPIRED, CANCELLED):', currentStatus);
    if (!newStatus || !['PENDING', 'COMPLETED', 'EXPIRED', 'CANCELLED'].includes(newStatus.toUpperCase())) {
        if (newStatus !== null) showToast('Status inválido', 'error');
        return;
    }

    try {
        if (!isDemoMode) {
            await adminFetch('deposits/update.php', {
                method: 'PUT',
                body: JSON.stringify({ deposit_id: depositId, status: newStatus.toUpperCase() })
            });
        }

        const dep = allDeposits.find(d => d.id === depositId);
        if (dep) dep.status = newStatus.toUpperCase();
        renderDeposits();
        showToast('Status do depósito atualizado', 'success');
    } catch (err) {
        showToast(err.message || 'Erro ao atualizar depósito', 'error');
    }
};

// ==================== POOLS ====================
function renderPools() {
    const tbody = document.getElementById('pools-table-body');
    const empty = document.getElementById('pools-empty');

    if (allPools.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    tbody.innerHTML = allPools.map(p => `
        <tr>
            <td data-label="Nome"><strong>${esc(p.name || '-')}</strong></td>
            <td data-label="Loteria">${esc(lotteryNames[p.lottery] || p.lottery_name || p.lotteryName || p.lottery)}</td>
            <td data-label="Cotas">${p.filled_spots || p.filledSpots || 0}/${p.total_spots || p.totalSpots || 0}</td>
            <td data-label="Preço/Cota">${formatCurrency(p.quota_price || p.quotaPrice || 0)}</td>
            <td data-label="Status">${p.status === 'active' ? '<span class="badge badge-green">Ativo</span>' : '<span class="badge badge-gray">Encerrado</span>'}</td>
            <td data-label="Ações">
                <button class="btn-sm btn-blue" onclick="editPool(${p.id})">Editar</button>
                <button class="btn-sm btn-outline" onclick="viewPoolParticipants(${p.id})">Participantes</button>
                <button class="btn-sm btn-red" onclick="deletePool(${p.id})">Excluir</button>
            </td>
        </tr>
    `).join('');
}

window.openPoolModal = function(poolId = null) {
    document.getElementById('modal-pool-id').value = poolId || '';
    document.getElementById('modal-pool-title').textContent = poolId ? 'Editar Bolão' : 'Criar Bolão';

    if (poolId) {
        const pool = allPools.find(p => p.id === poolId || p.id === parseInt(poolId));
        if (pool) {
            document.getElementById('modal-pool-name').value = pool.name || '';
            document.getElementById('modal-pool-lottery').value = pool.lottery || 'megasena';
            document.getElementById('modal-pool-spots').value = pool.total_spots || pool.totalSpots || '';
            document.getElementById('modal-pool-price').value = pool.quota_price || pool.quotaPrice || '';
            document.getElementById('modal-pool-numbers').value = (pool.numbers || []).join(', ');
            document.getElementById('modal-pool-date').value = pool.draw_date || pool.drawDate || '';
        }
    } else {
        document.getElementById('modal-pool-name').value = '';
        document.getElementById('modal-pool-lottery').value = 'megasena';
        document.getElementById('modal-pool-spots').value = '';
        document.getElementById('modal-pool-price').value = '';
        document.getElementById('modal-pool-numbers').value = '';
        document.getElementById('modal-pool-date').value = '';
    }

    document.getElementById('modal-pool').classList.remove('hidden');
};

window.editPool = function(poolId) {
    openPoolModal(poolId);
};

window.confirmPool = async function() {
    const poolId = document.getElementById('modal-pool-id').value;
    const name = document.getElementById('modal-pool-name').value.trim();
    const lottery = document.getElementById('modal-pool-lottery').value;
    const totalSpots = parseInt(document.getElementById('modal-pool-spots').value) || 0;
    const quotaPrice = parseFloat(document.getElementById('modal-pool-price').value) || 0;
    const numbersStr = document.getElementById('modal-pool-numbers').value;
    const drawDate = document.getElementById('modal-pool-date').value;

    if (!name || !totalSpots || !quotaPrice) {
        showToast('Preencha todos os campos obrigatórios', 'error');
        return;
    }

    const numbers = numbersStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));

    const poolData = {
        name,
        lottery,
        lotteryName: lotteryNames[lottery] || lottery,
        totalSpots,
        quotaPrice,
        numbers,
        drawDate: drawDate || new Date().toLocaleDateString('pt-BR')
    };

    try {
        if (poolId) {
            if (!isDemoMode) {
                await adminFetch(`pools/update.php?id=${poolId}`, {
                    method: 'PUT',
                    body: JSON.stringify(poolData)
                });
            }
            const idx = allPools.findIndex(p => p.id === parseInt(poolId) || p.id === poolId);
            if (idx !== -1) allPools[idx] = { ...allPools[idx], ...poolData };
            showToast('Bolão atualizado!', 'success');
        } else {
            poolData.filledSpots = 0;
            poolData.filled_spots = 0;
            poolData.status = 'active';

            if (!isDemoMode) {
                const result = await adminFetch('pools/create.php', {
                    method: 'POST',
                    body: JSON.stringify(poolData)
                });
                allPools.unshift({ id: result.id, ...poolData, created_at: new Date().toISOString() });
            } else {
                allPools.unshift({ id: 'demo_' + Date.now(), ...poolData, created_at: new Date().toISOString() });
            }
            showToast('Bolão criado!', 'success');
        }
        closeModal('modal-pool');
        renderPools();
        renderStats();
    } catch (err) {
        showToast('Erro ao salvar bolão', 'error');
        console.error(err);
    }
};

window.deletePool = async function(poolId) {
    if (!confirm('Tem certeza que deseja excluir este bolão?')) return;
    try {
        if (!isDemoMode) {
            await adminFetch(`pools/delete.php?id=${poolId}`, { method: 'DELETE' });
        }
        allPools = allPools.filter(p => p.id !== poolId && p.id !== parseInt(poolId));
        renderPools();
        renderStats();
        showToast('Bolão excluído', 'success');
    } catch (err) {
        showToast('Erro ao excluir bolão', 'error');
    }
};

window.viewPoolParticipants = async function(poolId) {
    const pool = allPools.find(p => p.id === poolId || p.id === parseInt(poolId));
    const content = document.getElementById('modal-pool-participants-content');
    content.innerHTML = '<p style="color:#999;font-size:13px;">Carregando...</p>';
    document.getElementById('modal-pool-participants').classList.remove('hidden');

    try {
        let parts = [];
        if (!isDemoMode) {
            parts = await adminFetch(`pools/participants.php?id=${poolId}`);
        } else {
            parts = [
                { user_name: 'João Silva', quotas: 2, created_at: '2026-02-03' },
                { user_name: 'Maria Santos', quotas: 3, created_at: '2026-02-04' },
                { user_name: 'Ana Costa', quotas: 1, created_at: '2026-02-05' },
            ];
        }

        if (parts.length === 0) {
            content.innerHTML = '<p class="admin-empty">Nenhum participante ainda.</p>';
            return;
        }

        content.innerHTML = `
            <p style="font-size:13px;color:#999;margin-bottom:12px;">${pool?.name || 'Bolão'} — ${parts.length} participante(s)</p>
            <table class="admin-table">
                <thead><tr><th>Usuário</th><th>Cotas</th><th>Data</th></tr></thead>
                <tbody>
                    ${parts.map(p => `
                        <tr>
                            <td>${esc(p.user_name || p.userName || p.user_id)}</td>
                            <td>${p.quotas || 1}</td>
                            <td>${formatDate(p.created_at || p.createdAt)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        content.innerHTML = '<p style="color:#f87171;font-size:13px;">Erro ao carregar participantes.</p>';
    }
};

// ==================== BETS ====================
function renderBets() {
    const searchQuery = (document.getElementById('bets-search')?.value || '').trim().toLowerCase();
    let filtered = currentBetFilter === 'all' ? allBets : allBets.filter(b => b.status === currentBetFilter);
    if (currentBetFilter === 'topPrizes') {
        filtered = allBets.filter(b => b.status === 'won' && (b.prize || 0) > 0);
        filtered = [...filtered].sort((a, b) => (b.prize || 0) - (a.prize || 0));
    }
    if (searchQuery) {
        filtered = filtered.filter(b =>
            (b.userName || b.user_name || '').toLowerCase().includes(searchQuery) ||
            (b.lotteryName || b.lottery_name || '').toLowerCase().includes(searchQuery)
        );
    }
    const tbody = document.getElementById('bets-table-body');
    const empty = document.getElementById('bets-empty');

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    tbody.innerHTML = filtered.slice(0, 100).map(b => `
        <tr>
            <td data-label="Usuário">${esc(b.userName || b.user_name || '-')}</td>
            <td data-label="Loteria">${esc(b.lotteryName || b.lottery_name || b.lotteryId || b.lottery_id || '-')}</td>
            <td data-label="Números" style="font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;">${(b.numbers || []).join(', ')}</td>
            <td data-label="Valor">${formatCurrency(b.value || 0)}</td>
            <td data-label="Prêmio">${(b.status === 'won' && b.prize) ? formatCurrency(b.prize) : '-'}</td>
            <td data-label="Status">${statusBadge(b.status)}</td>
            <td data-label="Data">${b.date || formatDateTime(b.created_at || b.createdAt)}</td>
            <td data-label="Ações">
                <button class="btn-sm btn-blue" onclick="openEditBetModal(${b.id})">Editar</button>
                <button class="btn-sm btn-red" onclick="deleteBetAdmin(${b.id})">Excluir</button>
            </td>
        </tr>
    `).join('');
}

window.filterBetsAdmin = function(filter) {
    currentBetFilter = filter;
    document.querySelectorAll('#section-bets .admin-filter-btn').forEach(btn => {
        const text = btn.textContent.trim().toLowerCase();
        const active = filter === 'all' ? text.includes('todas') :
            filter === 'active' ? text.includes('ativa') :
            filter === 'won' ? text.includes('ganhou') :
            filter === 'lost' ? text.includes('perdeu') :
            filter === 'topPrizes' ? text.includes('maiores') : false
        btn.classList.toggle('active', active);
    });
    renderBets();
};

// Editar aposta
window.openEditBetModal = function(betId) {
    const bet = allBets.find(b => b.id === betId);
    if (!bet) return;

    document.getElementById('modal-edit-bet-id').value = betId;
    document.getElementById('modal-edit-bet-info').textContent = `${bet.userName || bet.user_name || '-'} — ${bet.lotteryName || bet.lottery_name || '-'} — [${(bet.numbers || []).join(', ')}]`;
    document.getElementById('modal-edit-bet-status').value = bet.status || 'active';
    document.getElementById('modal-edit-bet-value').value = bet.value || 0;
    document.getElementById('modal-edit-bet-prize').value = bet.prize || '';
    document.getElementById('modal-edit-bet-hits').value = bet.hits || '';
    document.getElementById('modal-edit-bet').classList.remove('hidden');
};

window.confirmEditBet = async function() {
    const betId = parseInt(document.getElementById('modal-edit-bet-id').value);
    const status = document.getElementById('modal-edit-bet-status').value;
    const value = parseFloat(document.getElementById('modal-edit-bet-value').value) || 0;
    const prize = document.getElementById('modal-edit-bet-prize').value ? parseFloat(document.getElementById('modal-edit-bet-prize').value) : null;
    const hits = document.getElementById('modal-edit-bet-hits').value ? parseInt(document.getElementById('modal-edit-bet-hits').value) : null;

    try {
        if (!isDemoMode) {
            await adminFetch('bets/update.php', {
                method: 'PUT',
                body: JSON.stringify({ bet_id: betId, status, value, prize, hits })
            });
        }

        const bet = allBets.find(b => b.id === betId);
        if (bet) {
            bet.status = status;
            bet.value = value;
            bet.prize = prize;
            bet.hits = hits;
        }
        closeModal('modal-edit-bet');
        renderBets();
        showToast('Aposta atualizada', 'success');
    } catch (err) {
        showToast(err.message || 'Erro ao atualizar aposta', 'error');
    }
};

// Excluir aposta
window.deleteBetAdmin = async function(betId) {
    if (!confirm('Deseja excluir esta aposta?')) return;

    try {
        if (!isDemoMode) {
            await adminFetch(`bets/delete.php?id=${betId}`, { method: 'DELETE' });
        }
        allBets = allBets.filter(b => b.id !== betId);
        renderBets();
        renderStats();
        showToast('Aposta excluída', 'success');
    } catch (err) {
        showToast(err.message || 'Erro ao excluir aposta', 'error');
    }
};

// ==================== WITHDRAWALS ====================
let allWithdrawals = [];
let withdrawalTotals = {};
let currentWithdrawalFilter = 'all';

function renderWithdrawals() {
    const filtered = currentWithdrawalFilter === 'all'
        ? allWithdrawals
        : allWithdrawals.filter(w => w.status === currentWithdrawalFilter);

    const tbody = document.getElementById('withdrawals-table-body');
    const empty = document.getElementById('withdrawals-empty');

    // Atualiza stats
    const wdPending = document.getElementById('wd-pending');
    const wdPendingAmt = document.getElementById('wd-pending-amount');
    const wdApproved = document.getElementById('wd-approved');
    const wdRejected = document.getElementById('wd-rejected');

    if (wdPending) wdPending.textContent = withdrawalTotals.pending_count || 0;
    if (wdPendingAmt) wdPendingAmt.textContent = formatCurrency(withdrawalTotals.pending_amount || 0);
    if (wdApproved) wdApproved.textContent = withdrawalTotals.approved_count || 0;
    if (wdRejected) wdRejected.textContent = withdrawalTotals.rejected_count || 0;

    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');

    tbody.innerHTML = filtered.slice(0, 100).map(w => `
        <tr>
            <td data-label="Usuário"><strong>${esc(w.user_name || '-')}</strong><br><span style="font-size:11px;color:#999;">${esc(w.user_email || '')}</span></td>
            <td data-label="Valor"><strong>${formatCurrency(w.amount || 0)}</strong></td>
            <td data-label="Chave PIX"><span class="phone-display">${esc(w.pix_key || '-')}<button class="btn-copy" onclick="copyToClipboard('${String(w.pix_key || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')" title="Copiar">${COPY_ICON_SVG}</button></span></td>
            <td data-label="Telefone">${phoneDisplayHtml(w.user_phone)}</td>
            <td data-label="Status">${withdrawalStatusBadge(w.status)}</td>
            <td data-label="Data">${formatDate(w.created_at)}</td>
            <td data-label="Ações">
                ${w.status === 'pending' ? `
                    <button class="btn-sm btn-green" onclick="processWithdrawalAdmin(${w.id}, 'approve')">Aprovar</button>
                    <button class="btn-sm btn-red" onclick="processWithdrawalAdmin(${w.id}, 'reject')">Rejeitar</button>
                ` : `<span style="font-size:11px;color:#666;">${w.admin_note || (w.status === 'approved' ? 'Aprovado' : 'Rejeitado')}</span>`}
            </td>
        </tr>
    `).join('');
}

function withdrawalStatusBadge(status) {
    const map = {
        pending: '<span class="badge badge-yellow">Pendente</span>',
        approved: '<span class="badge badge-green">Aprovado</span>',
        rejected: '<span class="badge badge-red">Rejeitado</span>'
    };
    return map[status] || '<span class="badge badge-gray">' + esc(status || '-') + '</span>';
}

window.filterWithdrawals = function(filter) {
    currentWithdrawalFilter = filter;
    document.querySelectorAll('#section-withdrawals .admin-filter-btn').forEach(btn => {
        const text = btn.textContent.trim().toLowerCase();
        btn.classList.toggle('active',
            filter === 'all' ? text === 'todos' :
            filter === 'pending' ? text === 'pendentes' :
            filter === 'approved' ? text === 'aprovados' :
            text === 'rejeitados'
        );
    });
    renderWithdrawals();
};

window.processWithdrawalAdmin = async function(withdrawalId, action) {
    const actionLabel = action === 'approve' ? 'aprovar' : 'rejeitar';
    let note = '';
    if (action === 'reject') {
        note = prompt('Motivo da rejeição (opcional):') || '';
    }
    if (!confirm(`Deseja ${actionLabel} este saque?`)) return;

    try {
        if (!isDemoMode) {
            await adminFetch('withdrawals/process.php', {
                method: 'PUT',
                body: JSON.stringify({ withdrawal_id: withdrawalId, action, note })
            });
        }

        // Atualiza localmente
        const wd = allWithdrawals.find(w => w.id === withdrawalId);
        if (wd) {
            wd.status = action === 'approve' ? 'approved' : 'rejected';
            wd.admin_note = note;
            wd.processed_at = new Date().toISOString();

            // Se rejeitado, devolve o saldo localmente
            if (action === 'reject') {
                const user = allUsers.find(u => u.id === wd.user_id);
                if (user) user.balance = (user.balance || 0) + (wd.amount || 0);
            }
        }

        // Recarrega totais
        if (!isDemoMode) {
            try {
                const wdData = await adminFetch('withdrawals/list.php');
                allWithdrawals = wdData.withdrawals || [];
                withdrawalTotals = wdData.totals || {};
            } catch (e) {}
        } else {
            recalcWithdrawalTotals();
        }

        renderWithdrawals();
        renderStats();
        renderUsers();
        showToast(`Saque ${action === 'approve' ? 'aprovado' : 'rejeitado'}!`, 'success');
    } catch (err) {
        showToast(err.message || `Erro ao ${actionLabel} saque`, 'error');
    }
};

function recalcWithdrawalTotals() {
    withdrawalTotals = {
        pending_count: allWithdrawals.filter(w => w.status === 'pending').length,
        pending_amount: allWithdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + (w.amount || 0), 0),
        approved_count: allWithdrawals.filter(w => w.status === 'approved').length,
        approved_amount: allWithdrawals.filter(w => w.status === 'approved').reduce((s, w) => s + (w.amount || 0), 0),
        rejected_count: allWithdrawals.filter(w => w.status === 'rejected').length
    };
}

// ==================== TRANSACTIONS ====================
function renderTransactions() {
    const filtered = currentTxFilter === 'all' ? allTx : allTx.filter(t => t.type === currentTxFilter);
    const tbody = document.getElementById('tx-table-body');
    const empty = document.getElementById('tx-empty');

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    tbody.innerHTML = filtered.slice(0, 100).map(t => {
        const user = allUsers.find(u => u.id === t.user_id);
        let detailsHtml = '-';
        if (t.type === 'withdraw') {
            const pixKey = (t.reason || '').replace('PIX: ', '');
            detailsHtml = `
                <div class="tx-withdraw-details">
                    ${pixKey ? `<div>${textWithCopyHtml(pixKey, 'Chave PIX')}</div>` : ''}
                    ${t.userEmail || (user && user.email) ? `<div><strong>E-mail:</strong> ${esc(t.userEmail || (user && user.email) || '-')}</div>` : ''}
                    ${user && user.phone ? `<div><strong>Tel:</strong> ${phoneDisplayHtml(user.phone)}</div>` : ''}
                </div>`;
        } else if (t.reason) {
            detailsHtml = `<span style="font-size:11px;color:#999;">${esc(t.reason)}</span>`;
        }
        return `
        <tr>
            <td data-label="Usuário">${esc(t.userName || t.user_name || '-')}</td>
            <td data-label="Tipo">${typeBadge(t.type)}</td>
            <td data-label="Valor">${formatCurrency(t.value || 0)}</td>
            <td data-label="Detalhes">${detailsHtml}</td>
            <td data-label="Data">${t.date || formatDateTime(t.created_at || t.createdAt)}</td>
        </tr>`;
    }).join('');
}

window.filterTxAdmin = function(filter) {
    currentTxFilter = filter;
    document.querySelectorAll('#section-transactions .admin-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.trim().toLowerCase().includes(
            filter === 'all' ? 'todas' : filter === 'deposit' ? 'depósito' : filter === 'withdraw' ? 'saque' : 'aposta'
        ));
    });
    renderTransactions();
};

// ==================== HELPERS ====================
function formatCurrency(val) {
    return `R$ ${parseFloat(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(timestamp) {
    if (!timestamp) return '-';
    if (typeof timestamp === 'string') {
        if (timestamp.includes('/')) return timestamp;
        return new Date(timestamp).toLocaleDateString('pt-BR');
    }
    return new Date(timestamp).toLocaleDateString('pt-BR');
}

function esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

const COPY_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

function phoneDisplayHtml(phone, showWhatsApp = true) {
    if (!phone) return '-';
    const clean = String(phone).replace(/\D/g, '');
    const waUrl = clean.length >= 10 ? `https://wa.me/55${clean}` : '#';
    const waDisabled = clean.length < 10 ? ' style="opacity:0.5;pointer-events:none"' : '';
    const safeForJs = String(phone).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `<span class="phone-display">${esc(phone)}<button class="btn-copy" onclick="copyToClipboard('${safeForJs}')" title="Copiar">${COPY_ICON_SVG}</button>${showWhatsApp ? `<a class="btn-whatsapp" href="${waUrl}" target="_blank" rel="noopener" title="Abrir WhatsApp"${waDisabled}><img src="assets/logo-whatsapp.png" alt="WhatsApp"></a>` : ''}</span>`;
}

function textWithCopyHtml(text, label = '') {
    if (!text) return '-';
    const prefix = label ? `<strong>${esc(label)}:</strong> ` : '';
    const safe = String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `${prefix}${esc(text)} <button class="btn-copy" onclick="copyToClipboard('${safe}')" title="Copiar">${COPY_ICON_SVG}</button>`;
}

function formatDateTime(timestamp) {
    if (!timestamp) return '-';
    if (typeof timestamp === 'string' && timestamp.includes('/')) return timestamp;
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusBadge(status) {
    const map = {
        active: '<span class="badge badge-blue">Ativa</span>',
        won: '<span class="badge badge-green">Ganhou</span>',
        lost: '<span class="badge badge-red">Perdeu</span>'
    };
    return map[status] || '<span class="badge badge-gray">' + esc(status || '-') + '</span>';
}

function depositStatusBadge(status) {
    const map = {
        PENDING: '<span class="badge badge-yellow">Pendente</span>',
        COMPLETED: '<span class="badge badge-green">Confirmado</span>',
        EXPIRED: '<span class="badge badge-gray">Expirado</span>',
        CANCELLED: '<span class="badge badge-red">Cancelado</span>'
    };
    return map[status] || '<span class="badge badge-gray">' + esc(status || '-') + '</span>';
}

function typeBadge(type) {
    const map = {
        deposit: '<span class="badge badge-green">Depósito</span>',
        withdraw: '<span class="badge badge-yellow">Saque</span>',
        bet: '<span class="badge badge-blue">Aposta</span>',
        pool: '<span class="badge badge-purple">Bolão</span>',
        admin: '<span class="badge badge-yellow">Admin</span>'
    };
    return map[type] || '<span class="badge badge-gray">' + esc(type || '-') + '</span>';
}

window.closeModal = function(id) {
    document.getElementById(id)?.classList.add('hidden');
};

// Reset modal
const RESET_CONFIRM_WORD = 'resetar';

window.openResetModal = function() {
    const modal = document.getElementById('modal-reset');
    const input = document.getElementById('modal-reset-confirm');
    const btn = document.getElementById('modal-reset-btn');
    if (modal && input && btn) {
        input.value = '';
        btn.disabled = true;
        modal.classList.remove('hidden');
        input.focus();
    }
};

window.checkResetConfirm = function() {
    const input = document.getElementById('modal-reset-confirm');
    const btn = document.getElementById('modal-reset-btn');
    if (input && btn) {
        const match = input.value.trim().toLowerCase() === RESET_CONFIRM_WORD;
        btn.disabled = !match;
    }
};

window.confirmReset = function() {
    const input = document.getElementById('modal-reset-confirm');
    if (!input || input.value.trim().toLowerCase() !== RESET_CONFIRM_WORD) return;

    closeModal('modal-reset');
    if (isDemoMode) {
        enterDemoMode();
        showToast('Dados resetados (modo demo)', 'success');
    } else {
        refreshAdminData();
    }
};

window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copiado!', 'success');
    }).catch(() => {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Copiado!', 'success');
    });
};

// ==================== EXPORT CSV ====================
window.exportCSV = function(type) {
    let rows = [];
    let filename = 'export.csv';

    if (type === 'users') {
        filename = 'usuarios.csv';
        rows.push(['Nome', 'E-mail', 'Telefone', 'Saldo', 'Status', 'Cadastro']);
        allUsers.forEach(u => rows.push([
            u.name || '', u.email || '', u.phone || '', (u.balance || 0).toFixed(2),
            u.blocked ? 'Bloqueado' : 'Ativo', formatDate(u.created_at || u.createdAt)
        ]));
    } else if (type === 'bets') {
        filename = 'apostas.csv';
        rows.push(['Usuário', 'Loteria', 'Números', 'Valor', 'Status', 'Prêmio', 'Acertos', 'Data']);
        allBets.forEach(b => rows.push([
            b.userName || b.user_name || '', b.lotteryName || b.lottery_name || '',
            (b.numbers || []).join('; '), (b.value || 0).toFixed(2), b.status || '',
            b.prize ? b.prize.toFixed(2) : '', b.hits || '', b.date || formatDate(b.created_at)
        ]));
    } else if (type === 'transactions') {
        filename = 'transacoes.csv';
        rows.push(['Usuário', 'Tipo', 'Valor', 'Motivo', 'Data']);
        allTx.forEach(t => rows.push([
            t.userName || t.user_name || '', t.type || '', (t.value || 0).toFixed(2),
            t.reason || '', t.date || formatDate(t.created_at)
        ]));
    } else if (type === 'withdrawals') {
        filename = 'saques.csv';
        rows.push(['Usuário', 'E-mail', 'Telefone', 'Valor', 'Chave PIX', 'Status', 'Data']);
        allWithdrawals.forEach(w => rows.push([
            w.user_name || '', w.user_email || '', w.user_phone || '',
            (w.amount || 0).toFixed(2), w.pix_key || '', w.status || '',
            formatDate(w.created_at)
        ]));
    }

    if (rows.length <= 1) {
        showToast('Nenhum dado para exportar', 'error');
        return;
    }

    const csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${filename} exportado!`, 'success');
};

function showToast(msg, type = 'success') {
    const existing = document.querySelector('.admin-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `admin-toast ${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ==================== DEMO MODE ====================
let isDemoMode = false;

window._enterDemoModeImpl = function() {
    if (typeof window._demoRequested !== 'undefined') window._demoRequested = false;
    isDemoMode = true;

    allUsers = [
        { id: 'u1', name: 'João Silva', email: 'joao@email.com', phone: '(11) 99999-1111', balance: 350.00, role: 'user', blocked: false, created_at: '2026-02-01' },
        { id: 'u2', name: 'Maria Santos', email: 'maria@email.com', phone: '(21) 98888-2222', balance: 1200.50, role: 'user', blocked: false, created_at: '2026-02-02' },
        { id: 'u3', name: 'Pedro Oliveira', email: 'pedro@email.com', phone: '(31) 97777-3333', balance: 75.00, role: 'user', blocked: true, created_at: '2026-02-03' },
        { id: 'u4', name: 'Ana Costa', email: 'ana@email.com', phone: '(41) 96666-4444', balance: 500.00, role: 'user', blocked: false, created_at: '2026-02-04' },
        { id: 'u5', name: 'Carlos Ferreira', email: 'carlos@email.com', phone: '(51) 95555-5555', balance: 0, role: 'user', blocked: false, created_at: '2026-02-05' },
        { id: 'u6', name: 'Juliana Lima', email: 'juliana@email.com', phone: '(61) 94444-6666', balance: 890.25, role: 'user', blocked: false, created_at: '2026-02-05' },
        { id: 'u7', name: 'Rafael Souza', email: 'rafael@email.com', phone: '(71) 93333-7777', balance: 45.00, role: 'user', blocked: false, created_at: '2026-02-06' },
    ];

    allPools = [
        { id: 'p1', name: 'Bolão da Sorte', lottery: 'megasena', lottery_name: 'Mega Sena', total_spots: 50, filled_spots: 32, quota_price: 25.00, numbers: [4, 17, 23, 35, 42, 58], draw_date: '08/02/2026', status: 'active', created_at: '2026-02-01' },
        { id: 'p2', name: 'Bolão Premium', lottery: 'lotofacil', lottery_name: 'LotoFácil', total_spots: 20, filled_spots: 18, quota_price: 15.00, numbers: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 22, 23, 24, 25], draw_date: '07/02/2026', status: 'active', created_at: '2026-02-02' },
        { id: 'p3', name: 'Bolão Econômico', lottery: 'quina', lottery_name: 'Quina', total_spots: 30, filled_spots: 12, quota_price: 10.00, numbers: [12, 33, 45, 67, 78], draw_date: '09/02/2026', status: 'active', created_at: '2026-02-03' },
    ];

    allBets = [
        { id: 1, user_id: 'u1', userName: 'João Silva', lotteryName: 'Mega Sena', lottery_id: 'megasena', numbers: [4, 17, 23, 35, 42, 58], value: 5.00, status: 'active', date: '06/02/2026', created_at: new Date().toISOString() },
        { id: 2, user_id: 'u2', userName: 'Maria Santos', lotteryName: 'LotoFácil', lottery_id: 'lotofacil', numbers: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 22, 23, 24, 25], value: 3.00, status: 'won', date: '05/02/2026', prize: 1250, hits: 13, created_at: new Date().toISOString() },
        { id: 3, user_id: 'u1', userName: 'João Silva', lotteryName: 'Quina', lottery_id: 'quina', numbers: [12, 33, 45, 67, 78], value: 2.50, status: 'lost', date: '04/02/2026', created_at: new Date().toISOString() },
        { id: 4, user_id: 'u3', userName: 'Pedro Oliveira', lotteryName: 'Mega Sena', lottery_id: 'megasena', numbers: [7, 14, 28, 35, 49, 56], value: 5.00, status: 'active', date: '06/02/2026', created_at: new Date().toISOString() },
        { id: 5, user_id: 'u4', userName: 'Ana Costa', lotteryName: 'LotoFácil', lottery_id: 'lotofacil', numbers: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 21, 22, 23, 24, 25], value: 3.00, status: 'active', date: '06/02/2026', created_at: new Date().toISOString() },
        { id: 6, user_id: 'u6', userName: 'Juliana Lima', lotteryName: 'Quina', lottery_id: 'quina', numbers: [5, 22, 41, 56, 73], value: 2.50, status: 'won', date: '03/02/2026', prize: 85.50, hits: 3, created_at: new Date().toISOString() },
        { id: 7, user_id: 'u7', userName: 'Rafael Souza', lotteryName: 'Mega Sena', lottery_id: 'megasena', numbers: [10, 20, 30, 40, 50, 60], value: 5.00, status: 'lost', date: '02/02/2026', created_at: new Date().toISOString() },
    ];

    allTx = [
        { user_id: 'u1', userName: 'João Silva', type: 'deposit', method: 'pix', value: 100, date: '06/02/2026', created_at: new Date().toISOString() },
        { user_id: 'u2', userName: 'Maria Santos', type: 'deposit', method: 'pix', value: 500, date: '05/02/2026', created_at: new Date().toISOString() },
        { user_id: 'u1', userName: 'João Silva', type: 'bet', lottery: 'Mega Sena', value: 5, date: '06/02/2026', created_at: new Date().toISOString() },
        { user_id: 'u3', userName: 'Pedro Oliveira', type: 'deposit', method: 'pix', value: 200, date: '04/02/2026', created_at: new Date().toISOString() },
        { user_id: 'u4', userName: 'Ana Costa', type: 'withdraw', method: 'pix', value: 150, reason: 'PIX: ana@email.com', date: '05/02/2026', created_at: new Date().toISOString() },
        { user_id: 'u2', userName: 'Maria Santos', type: 'bet', lottery: 'LotoFácil', value: 3, date: '05/02/2026', created_at: new Date().toISOString() },
        { user_id: 'u6', userName: 'Juliana Lima', type: 'deposit', method: 'pix', value: 300, date: '03/02/2026', created_at: new Date().toISOString() },
        { user_id: 'u7', userName: 'Rafael Souza', type: 'bet', lottery: 'Mega Sena', value: 5, date: '02/02/2026', created_at: new Date().toISOString() },
    ];

    allDeposits = [
        { id: 1, user_id: 'u1', userName: 'João Silva', userEmail: 'joao@email.com', userPhone: '(11) 99999-1111', transaction_id: 'demo-tx-1', amount: 100, status: 'COMPLETED', credited: true, created_at: '2026-02-06', paid_at: '2026-02-06' },
        { id: 2, user_id: 'u2', userName: 'Maria Santos', userEmail: 'maria@email.com', userPhone: '(21) 98888-2222', transaction_id: 'demo-tx-2', amount: 500, status: 'COMPLETED', credited: true, created_at: '2026-02-05', paid_at: '2026-02-05' },
        { id: 3, user_id: 'u3', userName: 'Pedro Oliveira', userEmail: 'pedro@email.com', userPhone: '(31) 97777-3333', transaction_id: 'demo-tx-3', amount: 50, status: 'PENDING', credited: false, created_at: '2026-02-06' },
        { id: 4, user_id: 'u6', userName: 'Juliana Lima', userEmail: 'juliana@email.com', userPhone: '(61) 94444-6666', transaction_id: 'demo-tx-4', amount: 300, status: 'COMPLETED', credited: true, created_at: '2026-02-03', paid_at: '2026-02-03' },
        { id: 5, user_id: 'u5', userName: 'Carlos Ferreira', userEmail: 'carlos@email.com', userPhone: '(51) 95555-5555', transaction_id: 'demo-tx-5', amount: 20, status: 'EXPIRED', credited: false, created_at: '2026-02-02' },
    ];

    allWithdrawals = [
        { id: 1, user_id: 'u4', user_name: 'Ana Costa', user_email: 'ana@email.com', user_phone: '(41) 96666-4444', amount: 150, pix_key: 'ana@email.com', status: 'pending', created_at: '2026-02-07' },
        { id: 2, user_id: 'u2', user_name: 'Maria Santos', user_email: 'maria@email.com', user_phone: '(21) 98888-2222', amount: 300, pix_key: '123.456.789-00', status: 'approved', admin_note: '', created_at: '2026-02-05', processed_at: '2026-02-05' },
        { id: 3, user_id: 'u6', user_name: 'Juliana Lima', user_email: 'juliana@email.com', user_phone: '(61) 94444-6666', amount: 50, pix_key: '(61) 94444-6666', status: 'rejected', admin_note: 'Dados incorretos', created_at: '2026-02-04', processed_at: '2026-02-04' },
    ];
    withdrawalTotals = { pending_count: 1, pending_amount: 150, approved_count: 1, approved_amount: 300, rejected_count: 1 };

    depositTotals = {
        total_count: 5,
        total_amount: 970,
        completed_amount: 900,
        completed_count: 3,
        pending_amount: 50,
        pending_count: 1,
        expired_count: 1,
        cancelled_count: 0
    };

    document.getElementById('admin-login').style.display = 'none';
    document.getElementById('admin-app').style.display = 'flex';
    updateModeBadge();
    document.getElementById('stats-date').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    renderStats();
    showToast('Modo Demo ativo — dados fictícios', 'success');
};

// ==================== DEPOSIT NOTIFICATIONS (POLLING) ====================
let adminNotifications = [];
let lastKnownCompletedIds = new Set();
let depositPollInterval = null;

function startDepositPolling() {
    if (isDemoMode) return;
    // Inicializa com os IDs já conhecidos
    allDeposits.filter(d => d.status === 'COMPLETED').forEach(d => lastKnownCompletedIds.add(d.id));

    depositPollInterval = setInterval(pollForNewDeposits, 15000); // a cada 15s
}

async function pollForNewDeposits() {
    if (isDemoMode) return;
    try {
        const data = await adminFetch('deposits/list.php').catch(() => null);
        if (!data || !data.deposits) return;

        const freshDeposits = (data.deposits || []).map(d => ({
            ...d,
            userName: d.user_name || '-',
            userEmail: d.user_email || '-'
        }));

        // Detecta novos depósitos COMPLETED que não existiam antes
        const newCompleted = freshDeposits.filter(d =>
            d.status === 'COMPLETED' && !lastKnownCompletedIds.has(d.id)
        );

        if (newCompleted.length > 0) {
            newCompleted.forEach(dep => {
                lastKnownCompletedIds.add(dep.id);
                addAdminNotification(dep);
            });

            // Atualiza dados globais
            allDeposits = freshDeposits;
            depositTotals = data.totals || {};

            // Atualiza UI se estiver na aba de depósitos ou stats
            const activeSection = document.querySelector('.admin-section.active');
            if (activeSection) {
                const id = activeSection.id;
                if (id === 'section-deposits') renderDeposits();
                if (id === 'section-stats') renderStats();
            }

            // Toca som de notificação
            playNotifSound();
        }
    } catch (e) {
        // silencioso
    }
}

function addAdminNotification(deposit) {
    const amount = parseFloat(deposit.amount || 0);
    const formatted = `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const userName = deposit.userName || deposit.user_name || 'Usuário';

    const notif = {
        id: Date.now() + '_' + deposit.id,
        type: 'deposit',
        text: `<strong>${esc(userName)}</strong> concluiu um depósito de <strong>${formatted}</strong>`,
        time: new Date(),
        depositId: deposit.id
    };

    adminNotifications.unshift(notif);
    if (adminNotifications.length > 50) adminNotifications.pop();

    renderNotifications();
    showToast(`Depósito de ${formatted} por ${userName}`, 'success');
}

function renderNotifications() {
    const list = document.getElementById('admin-notif-list');
    const badge = document.getElementById('admin-notif-badge');
    const bell = document.getElementById('admin-notif-bell');

    if (!list) return;

    if (adminNotifications.length === 0) {
        list.innerHTML = '<div class="admin-notif-empty">Nenhuma notificação</div>';
        if (badge) { badge.classList.add('hidden'); badge.textContent = '0'; }
        if (bell) bell.classList.remove('has-new');
        return;
    }

    // Badge
    if (badge) {
        badge.textContent = adminNotifications.length;
        badge.classList.remove('hidden');
    }
    if (bell) bell.classList.add('has-new');

    list.innerHTML = adminNotifications.map(n => {
        const timeStr = formatNotifTime(n.time);
        return `
            <div class="admin-notif-item" onclick="goToDeposit(${n.depositId})">
                <div class="admin-notif-icon deposit">💰</div>
                <div class="admin-notif-body">
                    <div class="admin-notif-text">${n.text}</div>
                    <div class="admin-notif-time">${timeStr}</div>
                </div>
            </div>
        `;
    }).join('');
}

function formatNotifTime(date) {
    if (!(date instanceof Date)) date = new Date(date);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Agora mesmo';
    if (diffMin < 60) return `${diffMin}min atrás`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h atrás`;
    return date.toLocaleDateString('pt-BR');
}

window.toggleNotifPanel = function() {
    const panel = document.getElementById('admin-notif-panel');
    if (panel) panel.classList.toggle('hidden');
};

window.clearNotifications = function() {
    adminNotifications = [];
    renderNotifications();
    const panel = document.getElementById('admin-notif-panel');
    if (panel) panel.classList.add('hidden');
};

window.goToDeposit = function(depositId) {
    // Fecha painel e vai para depósitos
    const panel = document.getElementById('admin-notif-panel');
    if (panel) panel.classList.add('hidden');
    showSection('deposits');
};

// Som de notificação (beep curto gerado por AudioContext)
function playNotifSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.value = 0.15;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.stop(ctx.currentTime + 0.3);
    } catch (e) { /* sem audio */ }
}

// ==================== NOTIFICAÇÕES PUSH ====================
let notificationSchedules = [];
let pushSubscribersCount = 0;

async function loadNotificationSchedules() {
    if (isDemoMode) return;
    try {
        const data = await adminFetch('notifications/schedules.php');
        notificationSchedules = data.schedules || [];
        pushSubscribersCount = data.pushSubscribersCount || 0;
    } catch (e) {
        notificationSchedules = [];
        pushSubscribersCount = 0;
    }
}

function renderNotifications2() {
    if (isDemoMode) {
        document.getElementById('notif-push-count').textContent = '-';
        document.getElementById('notif-subscribers-count').textContent = 'Modo demo';
        document.getElementById('notif-schedules-body').innerHTML = '<tr><td colspan="5">Modo demo - use a API real para notificações</td></tr>';
        return;
    }
    loadNotificationSchedules().then(() => {
        document.getElementById('notif-push-count').textContent = String(pushSubscribersCount);
        document.getElementById('notif-subscribers-count').textContent = pushSubscribersCount + ' usuários com push ativo';
        const tbody = document.getElementById('notif-schedules-body');
        const empty = document.getElementById('notif-schedules-empty');
        if (!notificationSchedules.length) {
            tbody.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }
        empty.classList.add('hidden');
        const lotteryNames = { megasena: 'Mega-Sena', lotofacil: 'LotoFácil', quina: 'Quina' };
        tbody.innerHTML = notificationSchedules.map(s => {
            const type = s.recurrence === 'draw_days' ? 'Recorrente (' + (lotteryNames[s.lottery_id] || s.lottery_id) + ')' : s.recurrence === 'daily' ? 'Diária' : 'Única';
            const when = s.scheduled_at ? new Date(s.scheduled_at).toLocaleString('pt-BR') : (s.recurrence_hour + ':' + String(s.recurrence_minute).padStart(2, '0'));
            const status = s.status === 'pending' ? 'Pendente' : s.status === 'sent' ? 'Enviada' : 'Cancelada';
            const cancelBtn = s.status === 'pending' ? `<button class="btn-sm btn-outline" onclick="cancelNotificationSchedule(${s.id})">Cancelar</button>` : '';
            const esc = (x) => String(x || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            return `<tr><td>${esc(s.title)}</td><td>${type}</td><td>${when}</td><td>${status}</td><td>${cancelBtn}</td></tr>`;
        }).join('');
    });
}

window.sendNotificationNow = async function() {
    const title = document.getElementById('notif-title')?.value?.trim();
    const body = document.getElementById('notif-body')?.value?.trim();
    if (!title || !body) {
        showToast('Preencha título e corpo', 'error');
        return;
    }
    try {
        const data = await adminFetch('notifications/send.php', {
            method: 'POST',
            body: JSON.stringify({ title, body, sendNow: true })
        });
        showToast('Enviado para ' + (data.sent || 0) + ' usuários', 'success');
        document.getElementById('notif-title').value = '';
        document.getElementById('notif-body').value = '';
    } catch (e) {
        showToast(e.message || 'Erro ao enviar', 'error');
    }
};

window.scheduleNotification = async function() {
    const scheduledAt = document.getElementById('notif-scheduled-at')?.value;
    const title = document.getElementById('notif-sched-title')?.value?.trim();
    const body = document.getElementById('notif-sched-body')?.value?.trim();
    if (!title || !body || !scheduledAt) {
        showToast('Preencha todos os campos', 'error');
        return;
    }
    const dt = new Date(scheduledAt);
    const formatted = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0') + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0') + ':00';
    try {
        await adminFetch('notifications/send.php', {
            method: 'POST',
            body: JSON.stringify({ title, body, sendNow: false, scheduledAt: formatted, recurrence: 'none' })
        });
        showToast('Agendado com sucesso', 'success');
        document.getElementById('notif-sched-title').value = '';
        document.getElementById('notif-sched-body').value = '';
        document.getElementById('notif-scheduled-at').value = '';
        renderNotifications();
    } catch (e) {
        showToast(e.message || 'Erro ao agendar', 'error');
    }
};

window.createRecurringNotification = async function() {
    const lotteryId = document.getElementById('notif-recur-lottery')?.value;
    const hour = parseInt(document.getElementById('notif-recur-hour')?.value || '21', 10);
    const minute = parseInt(document.getElementById('notif-recur-minute')?.value || '5', 10);
    const title = document.getElementById('notif-recur-title')?.value?.trim();
    const body = document.getElementById('notif-recur-body')?.value?.trim();
    if (!title || !body) {
        showToast('Preencha título e corpo', 'error');
        return;
    }
    try {
        await adminFetch('notifications/send.php', {
            method: 'POST',
            body: JSON.stringify({
                title, body, sendNow: false,
                recurrence: 'draw_days', lotteryId,
                recurrenceHour: hour, recurrenceMinute: minute
            })
        });
        showToast('Recorrente criada com sucesso', 'success');
        document.getElementById('notif-recur-title').value = '';
        document.getElementById('notif-recur-body').value = '';
        renderNotifications();
    } catch (e) {
        showToast(e.message || 'Erro ao criar', 'error');
    }
};

window.cancelNotificationSchedule = async function(id) {
    try {
        await adminFetch('notifications/schedules.php?id=' + id, { method: 'DELETE' });
        showToast('Agendamento cancelado', 'success');
        renderNotifications();
    } catch (e) {
        showToast(e.message || 'Erro ao cancelar', 'error');
    }
};

// Fechar painel ao clicar fora
document.addEventListener('click', (e) => {
    const panel = document.getElementById('admin-notif-panel');
    const bell = document.getElementById('admin-notif-bell');
    if (panel && !panel.classList.contains('hidden')) {
        if (!panel.contains(e.target) && !bell.contains(e.target)) {
            panel.classList.add('hidden');
        }
    }
});

// Close modals on overlay click
document.querySelectorAll('.admin-modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.add('hidden');
    });
});
