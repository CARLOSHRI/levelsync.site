/**
 * Loto Grana - Main Application Entry Point
 * @module main
 */

// Core imports
import { state, officialResults, resultsLoadingState, clearFinishedBets } from './core/state.js';
import { lotteries, modeDescriptions, prizeRules, pools, calculateBetValue, generateRandomNumbers, AUTH_REQUIRED } from './core/config.js';
import { showScreen, toggleSidebar, loadScreens } from './core/navigation.js';

// Utils imports
import { Utils } from './utils/utils.js';
import { Storage } from './utils/storage.js';
import { ErrorHandler } from './utils/errors.js';
import { Validators } from './utils/validators.js';
import { Loading } from './utils/loading.js';
import { ConfettiAnimation } from './utils/confetti.js';
import { LoteriasAPI } from './utils/api.js';
import { HackingAnimation } from './utils/hacking-animation.js';
import { BetConfirmationAnimation } from './utils/bet-confirmation-animation.js';

// Features imports
import { 
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
    addManualGame,
    getNextContestNumber,
    getNextContestDate
} from './features/betting.js';

import {
    openIAExpertModal,
    closeIAModal,
    startIAExpert,
    startIAAutoGeneration,
    showIAConfirmation,
    cancelIAConfirmation,
    confirmIAGeneration,
    runIAProcessingAnimation,
    runIAProcessingAnimationForBetting
} from './features/ia-expert.js';

import {
    openBettingSelection,
    closeModeModal,
    confirmModeSelection
} from './features/mode-modal.js';

import {
    openQuantityModal,
    closeQuantityModal,
    backToModeSelection,
    setQuickQuantity,
    updateQuantityFromSlider,
    adjustQuantity,
    updateQuantityDisplay,
    updateQuantityPreview,
    confirmQuantity
} from './features/quantity-modal.js';

import {
    initializeResults,
    fetchLotteryResults,
    updateHomePrizes,
    calculateHits,
    determinePrize,
    getContestResult,
    checkBetsAgainstResults,
    showResults
} from './features/results-checker.js';

import {
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
} from './features/pools.js';

// Wallet imports
import {
    updateBalanceDisplays,
    showBalanceModal,
    closeBalanceModal,
    goToDeposit,
    handleAddBalanceFromBalanceModal,
    showSuccessModal,
    closeSuccessModal,
    goToMyBets,
    loadSavedData,
    loadFromAPI,
    saveData
} from './wallet/balance.js';

import { isAuthenticated, apiCheckPendingDeposits, apiUpdateSelf, apiGetMe, logout } from './api-client.js';

import {
    resetDepositScreen,
    setDepositAmount,
    updateDepositDisplay,
    processDeposit,
    onDepositInputChange,
    openDepositModal,
    closeDepositModal
} from './wallet/deposit.js';

import {
    setMaxWithdraw,
    processWithdraw
} from './wallet/withdraw.js';

// Quick Games imports
import {
    initQuickGames,
    showQuickGames,
    selectDailyGame,
    selectQgLottery,
    switchQgTab,
    filterQgResults,
    betOnDailyGame,
    closeQuickBetModal,
    confirmQuickBet
} from './features/quick-games.js';

// PWA Install
import { initPwaInstall, canShowInstallPrompt, showInstallPrompt, dismissInstallPrompt, wasInstallDismissed, isIOS, isStandalone } from './utils/pwa-install.js';
import { requestPushPermission, isPushSupported } from './utils/push-notifications.js';

// UI imports
import { showToast } from './ui/toasts.js';
import { shareGame, copyToClipboard, copyCode, shareCode } from './ui/share.js';
import { filterBets, renderBets, renderBetsForLottery, renderTransactions, loadMoreTransactions, updateSelectedNumbers, toggleContestAccordion } from './ui/renders.js';
import { renderHotColdNumbers, selectHotColdNumber } from './ui/hot-cold.js';

// ==================== EXPOSE GLOBALS ====================
// Expose necessary functions to window for onclick handlers in HTML

// Navigation
window.showScreen = showScreen;
window.toggleSidebar = toggleSidebar;

// Jogos Prontos - navega para a tela com a loteria selecionada
window.goToQuickGames = function(lotteryId) {
    window._pendingQuickGamesLottery = lotteryId;
    showScreen('quick-games');
};

// Termos e Privacidade
window.showTerms = function() {
    const modal = document.getElementById('terms-modal');
    if (modal) modal.classList.remove('hidden');
};
window.showPrivacy = function() {
    const modal = document.getElementById('privacy-modal');
    if (modal) modal.classList.remove('hidden');
};

// Settings - carrega dados do usuario ao abrir a tela
window.addEventListener('screenChanged', (e) => {
    if (e.detail === 'settings') loadSettingsData();
});

async function loadSettingsData() {
    try {
        const user = await apiGetMe();
        if (user) {
            const nameEl = document.getElementById('settings-name');
            const emailEl = document.getElementById('settings-email');
            const phoneEl = document.getElementById('settings-phone');
            if (nameEl) nameEl.value = user.name || '';
            if (emailEl) emailEl.value = user.email || '';
            if (phoneEl) phoneEl.value = user.phone || '';
        }
    } catch (e) {
        console.warn('[Settings] Erro ao carregar dados:', e);
    }
}

window.saveSettingsProfile = async function() {
    const name = document.getElementById('settings-name')?.value?.trim();
    const email = document.getElementById('settings-email')?.value?.trim();
    const phone = document.getElementById('settings-phone')?.value?.trim();

    if (!name || !email) {
        if (typeof window.showToast === 'function') window.showToast('Nome e e-mail são obrigatórios', 'error');
        return;
    }

    try {
        await apiUpdateSelf({ name, email, phone });
        localStorage.setItem('lotograna_user_name', name);
        localStorage.setItem('lotograna_user_email', email);
        if (typeof window.updateUserNameDisplay === 'function') window.updateUserNameDisplay();
        if (typeof window.showToast === 'function') window.showToast('Dados atualizados com sucesso!', 'success');
    } catch (err) {
        if (typeof window.showToast === 'function') window.showToast(err.message || 'Erro ao salvar', 'error');
    }
};

window.saveSettingsPassword = async function() {
    const current = document.getElementById('settings-current-password')?.value;
    const newPwd = document.getElementById('settings-new-password')?.value;
    const confirm = document.getElementById('settings-confirm-password')?.value;

    if (!current || !newPwd || !confirm) {
        if (typeof window.showToast === 'function') window.showToast('Preencha todos os campos', 'error');
        return;
    }
    if (newPwd.length < 6) {
        if (typeof window.showToast === 'function') window.showToast('Nova senha deve ter no mínimo 6 caracteres', 'error');
        return;
    }
    if (newPwd !== confirm) {
        if (typeof window.showToast === 'function') window.showToast('As senhas não conferem', 'error');
        return;
    }

    try {
        await apiUpdateSelf({ current_password: current, new_password: newPwd });
        document.getElementById('settings-current-password').value = '';
        document.getElementById('settings-new-password').value = '';
        document.getElementById('settings-confirm-password').value = '';
        if (typeof window.showToast === 'function') window.showToast('Senha alterada com sucesso!', 'success');
    } catch (err) {
        if (typeof window.showToast === 'function') window.showToast(err.message || 'Erro ao alterar senha', 'error');
    }
};

// Logout
window.handleLogout = function() {
    if (confirm('Deseja realmente sair da sua conta?')) {
        logout();
    }
};

// Betting
window.openBettingSelection = openBettingSelection;
window.openBetting = openBetting;
window.toggleNumber = toggleNumber;
window.setMode = setMode;
window.generateAINumbers = generateAINumbers;
window.confirmBet = confirmBet;
window.addManualGame = addManualGame;
window.renderGeneratedBets = renderGeneratedBets;
window.updateNumberDisplay = updateNumberDisplay;
window.updateBetValue = updateBetValue;
window.getNextContestNumber = getNextContestNumber;
window.getNextContestDate = getNextContestDate;

// Mode Modal
window.closeModeModal = closeModeModal;
window.confirmModeSelection = confirmModeSelection;

// Quantity Modal
window.openQuantityModal = openQuantityModal;
window.closeQuantityModal = closeQuantityModal;
window.backToModeSelection = backToModeSelection;
window.setQuickQuantity = setQuickQuantity;
window.updateQuantityFromSlider = updateQuantityFromSlider;
window.adjustQuantity = adjustQuantity;
window.updateQuantityDisplay = updateQuantityDisplay;
window.confirmQuantity = confirmQuantity;

// IA Expert
window.openIAExpertModal = openIAExpertModal;
window.closeIAModal = closeIAModal;
window.startIAExpert = startIAExpert;
window.showIAConfirmation = showIAConfirmation;
window.cancelIAConfirmation = cancelIAConfirmation;
window.confirmIAGeneration = confirmIAGeneration;

// Results
window.showResults = showResults;
window.checkBetsAgainstResults = checkBetsAgainstResults;

// Pools
window.loadNextDrawForPools = loadNextDrawForPools;
window.filterPools = filterPools;
window.filterPoolsByLottery = filterPoolsByLottery;
window.renderPools = renderPools;
window.renderPoolsPage = renderPoolsPage;
window.renderMyPools = renderMyPools;
window.renderMyPoolsPage = renderMyPoolsPage;
window.checkPoolsAgainstResults = checkPoolsAgainstResults;
window.participatePool = participatePool;
window.openPoolModal = openPoolModal;
window.closePoolModal = closePoolModal;
window.increasePoolQuotas = increasePoolQuotas;
window.decreasePoolQuotas = decreasePoolQuotas;
window.setPoolModalQuotas = setPoolModalQuotas;
window.selectQuotaAndConfirm = selectQuotaAndConfirm;
window.confirmPoolParticipation = confirmPoolParticipation;

// Bets
window.filterBets = filterBets;
window.renderBets = renderBets;

// Tutorial Functions
function showMyBetsTutorial() {
    // Verifica se já viu o tutorial
    if (localStorage.getItem('myBetsTutorialSeen')) {
        const overlay = document.getElementById('tutorial-overlay');
        if (overlay) overlay.classList.add('hidden');
        return;
    }
    
    // Mostra o tutorial
    const overlay = document.getElementById('tutorial-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
    }
}

function closeTutorial() {
    // Marca como visto
    localStorage.setItem('myBetsTutorialSeen', 'true');
    
    // Esconde o tutorial
    const overlay = document.getElementById('tutorial-overlay');
    if (overlay) {
        overlay.style.animation = 'tutorialFadeIn 0.3s ease reverse';
        setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.style.animation = '';
        }, 300);
    }
}

// Tutorial
window.showMyBetsTutorial = showMyBetsTutorial;
window.closeTutorial = closeTutorial;

// Balance/Wallet
window.updateBalanceDisplays = updateBalanceDisplays;
window.showBalanceModal = showBalanceModal;
window.closeBalanceModal = closeBalanceModal;
window.goToDeposit = goToDeposit;
window.handleAddBalanceFromBalanceModal = handleAddBalanceFromBalanceModal;
window.showSuccessModal = showSuccessModal;
window.closeSuccessModal = closeSuccessModal;
window.goToMyBets = goToMyBets;
window.saveData = saveData;

// Funções de teste/debug
window.clearFinishedBets = () => {
    const count = clearFinishedBets();
    saveData();
    if (typeof renderBets === 'function') {
        renderBets('active');
    }
    return count;
};

window.clearAllBets = () => {
    const count = state.bets.length;
    state.bets = [];
    saveData();
    if (typeof renderBets === 'function') {
        renderBets('active');
    }
    console.log(`[App] Removidos todos os ${count} jogos.`);
    return count;
};

// Saldo de teste (console)
window.setTestBalance = (valor) => {
    state.balance = Number(valor) || 0;
    updateBalanceDisplays();
    saveData();
    console.log(`[App] Saldo definido: R$ ${state.balance.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    return state.balance;
};
window.addTestBalance = (valor) => {
    state.balance = (state.balance || 0) + (Number(valor) || 0);
    updateBalanceDisplays();
    saveData();
    console.log(`[App] Saldo atual: R$ ${state.balance.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    return state.balance;
};

// Deposit
window.resetDepositScreen = resetDepositScreen;
window.setDepositAmount = setDepositAmount;
window.openDepositModal = openDepositModal;
window.closeDepositModal = closeDepositModal;
window.updateDepositDisplay = updateDepositDisplay;
window.processDeposit = processDeposit;
window.onDepositInputChange = onDepositInputChange;

// Withdraw
window.setMaxWithdraw = setMaxWithdraw;
window.processWithdraw = processWithdraw;

// Transactions
window.renderTransactions = renderTransactions;
window.loadMoreTransactions = loadMoreTransactions;

// UI
window.showToast = showToast;
window.shareGame = shareGame;
window.copyCode = copyCode;
window.shareCode = shareCode;
window.updateSelectedNumbers = updateSelectedNumbers;

// Hot/Cold
window.renderHotColdNumbers = renderHotColdNumbers;
window.selectHotColdNumber = selectHotColdNumber;

// Quick Games
window.initQuickGames = initQuickGames;
window.showQuickGames = showQuickGames;
window.selectDailyGame = selectDailyGame;
window.selectQgLottery = selectQgLottery;
window.switchQgTab = switchQgTab;
window.filterQgResults = filterQgResults;
window.betOnDailyGame = betOnDailyGame;
window.closeQuickBetModal = closeQuickBetModal;
window.confirmQuickBet = confirmQuickBet;
window.renderBetsForLottery = renderBetsForLottery;
window.toggleContestAccordion = toggleContestAccordion;

// Utils
window.Utils = Utils;
window.Storage = Storage;
window.ErrorHandler = ErrorHandler;
window.Validators = Validators;
window.Loading = Loading;
window.ConfettiAnimation = ConfettiAnimation;
window.LoteriasAPI = LoteriasAPI;
window.HackingAnimation = HackingAnimation;
window.BetConfirmationAnimation = BetConfirmationAnimation;

// State (for debugging)
window.state = state;
window.lotteries = lotteries;

/** Atualiza exibição do nome e e-mail do usuário (cadastro) na sidebar e no perfil */
function updateUserNameDisplay() {
    const name = localStorage.getItem('lotograna_user_name') || 'Apostador';
    const email = localStorage.getItem('lotograna_user_email') || '';
    const sidebarName = document.getElementById('sidebar-user-name');
    if (sidebarName) sidebarName.textContent = name;
    const profileName = document.getElementById('profile-user-name');
    if (profileName) profileName.textContent = name;
    const profileEmail = document.getElementById('profile-user-email');
    if (profileEmail) profileEmail.textContent = email;
}
window.updateUserNameDisplay = updateUserNameDisplay;

function updateViewportMetrics() {
    const viewportHeight = Math.max(
        window.innerHeight || 0,
        window.visualViewport?.height || 0,
        document.documentElement?.clientHeight || 0,
        window.screen?.height || 0
    );
    document.documentElement.style.setProperty('--app-height', `${viewportHeight}px`);
}

function setupIOSPwaViewportFix() {
    const isIosStandalone = isIOS() && isStandalone();
    document.documentElement.classList.toggle('ios-standalone', isIosStandalone);
    document.body.classList.toggle('ios-standalone', isIosStandalone);

    updateViewportMetrics();

    window.addEventListener('resize', updateViewportMetrics);
    window.visualViewport?.addEventListener('resize', updateViewportMetrics);
    window.visualViewport?.addEventListener('scroll', updateViewportMetrics);
}

/** Inicializa o app (chamada após confirmar autenticação) */
async function initializeApp() {
    console.log('[LotoGrana] Inicializando aplicação...');
    
    // Carrega dados do cache local (rápido)
    loadSavedData();
    
    // Inicializa módulo de bolões
    initPools();

    // Carrega telas
    await loadScreens();
    
    // Inicializa ícones Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // Atualiza displays (saldo e nome do usuário)
    updateBalanceDisplays();
    updateUserNameDisplay();
    renderPools();
    showScreen('home');
    
    // Carrega dados mais recentes da API em background
    loadFromAPI().then(() => {
        updateBalanceDisplays();
        updateUserNameDisplay();
        renderPools();
    }).catch(() => {});

    // Verifica depósitos PIX pendentes e credita se pagos
    apiCheckPendingDeposits().then(result => {
        if (result.totalCredited > 0) {
            const total = result.credited.reduce((sum, d) => sum + d.amount, 0);
            if (typeof window.showToast === 'function') {
                window.showToast(`Depósito de R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} creditado!`, 'success');
            }
            // Recarrega saldo atualizado
            loadFromAPI().then(() => {
                updateBalanceDisplays();
            });
        }
    }).catch(() => {});
    
    // Solicita permissao para notificacoes (nao bloqueia)
    if ('Notification' in window && Notification.permission === 'default') {
        setTimeout(() => {
            Notification.requestPermission().then(p => console.log('[Notifications] Permissão:', p));
        }, 5000);
    }

    // Inicializa resultados da API (não bloqueia a UI)
    initializeResults()
        .then(() => {
            return checkBetsAgainstResults();
        })
        .then(() => {
            checkPoolsAgainstResults();
        })
        .catch(err => {
            console.warn('[App] Erro ao inicializar resultados:', err);
        });
    
    // Add input listener for deposit amount com debounce
    const depositInput = document.getElementById('deposit-amount');
    if (depositInput) {
        const debouncedUpdate = Utils.debounce(() => {
            updateDepositDisplay();
        }, 300);

        depositInput.addEventListener('input', (e) => {
            let value = parseInt(e.target.value) || 0;
            if (value < 0) value = 0;
            state.depositAmount = value;
            
            document.querySelectorAll('.amount-btn').forEach(btn => {
                btn.classList.remove('active');
                if (parseInt(btn.dataset.amount) === value) {
                    btn.classList.add('active');
                }
            });
            
            debouncedUpdate();
        });
    }

    // Salva dados antes de fechar a página
    window.addEventListener('beforeunload', saveData);

    // PWA Install Banner (após login)
    initPwaInstall();
    // Push Notifications (após login, com delay)
    if (isPushSupported()) {
        setTimeout(() => requestPushPermission().catch(() => {}), 3000);
    }
    function showPwaBanner() {
        if (isStandalone() || wasInstallDismissed()) return;
        const banner = document.getElementById('pwa-install-banner');
        const btn = document.getElementById('pwa-install-btn');
        const desc = document.getElementById('pwa-install-desc');
        const iosModal = document.getElementById('pwa-ios-modal');
        if (!banner) return;
        if (isIOS()) {
            desc.textContent = 'Adicione à tela inicial';
            if (btn) {
                btn.textContent = 'Como instalar';
                btn.onclick = () => { if (iosModal) iosModal.classList.remove('hidden'); };
            }
        } else if (canShowInstallPrompt()) {
            desc.textContent = 'Use como app';
            if (btn) { btn.textContent = 'Instalar'; btn.onclick = () => showInstallPrompt(); }
        } else return;
        banner.classList.remove('hidden');
    }
    document.getElementById('pwa-install-dismiss')?.addEventListener('click', () => {
        document.getElementById('pwa-install-banner')?.classList.add('hidden');
        dismissInstallPrompt();
    });
    window.addEventListener('pwa-install-available', showPwaBanner);
    if (canShowInstallPrompt()) setTimeout(showPwaBanner, 1500);
    else if (isIOS() && !isStandalone()) setTimeout(showPwaBanner, 2500);

    window.openPwaInstallFromSidebar = function() {
        toggleSidebar(false);
        if (isStandalone()) {
            if (typeof window.showToast === 'function') window.showToast('App já instalado', 'info');
            return;
        }
        const banner = document.getElementById('pwa-install-banner');
        const btn = document.getElementById('pwa-install-btn');
        const desc = document.getElementById('pwa-install-desc');
        const iosModal = document.getElementById('pwa-ios-modal');
        if (!banner) return;
        if (isIOS()) {
            desc.textContent = 'Adicione à tela inicial';
            if (btn) {
                btn.textContent = 'Como instalar';
                btn.onclick = () => { if (iosModal) iosModal.classList.remove('hidden'); };
            }
        } else if (canShowInstallPrompt()) {
            desc.textContent = 'Use como app';
            if (btn) { btn.textContent = 'Instalar'; btn.onclick = () => showInstallPrompt(); }
        } else {
            if (isIOS() && iosModal) {
                iosModal.classList.remove('hidden');
            } else if (typeof window.showToast === 'function') {
                window.showToast('Use o menu do navegador para instalar', 'info');
            }
            return;
        }
        banner.classList.remove('hidden');
    };

    // Salva dados periodicamente (a cada 30 segundos)
    setInterval(saveData, 30000);

    console.log('[LotoGrana] Aplicação inicializada com sucesso!');
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    if (window.__LOTO_GRANA_INITIALIZED__) {
        console.log('[LotoGrana] Já inicializado, ignorando...');
        return;
    }
    window.__LOTO_GRANA_INITIALIZED__ = true;

    setupIOSPwaViewportFix();

    // Se AUTH_REQUIRED = false, pula verificação de login
    if (!AUTH_REQUIRED) {
        console.log('[LotoGrana] Autenticação desativada (AUTH_REQUIRED = false), inicializando...');
        initializeApp();
        return;
    }

    // Verifica JWT no localStorage
    if (!isAuthenticated()) {
        console.log('[LotoGrana] Sem token JWT, redirecionando para login...');
        window.location.href = 'login.html';
        return;
    }

    console.log('[LotoGrana] Token JWT encontrado, inicializando...');
    initializeApp();
});

// Export for ES Module usage
export {
    state,
    lotteries,
    showScreen,
    toggleSidebar,
    showToast,
    Utils,
    Storage,
    LoteriasAPI
};
