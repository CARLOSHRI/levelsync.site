/**
 * Navigation Module - Navegação entre telas
 * @module core/navigation
 */

import { state } from './state.js';
import { tabMap } from './config.js';

/**
 * Exibe uma tela específica
 * @param {string} screenId - ID da tela a ser exibida
 */
export function showScreen(screenId) {
    // Esconde todas as telas
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Exibe a tela alvo
    const targetScreen = document.getElementById(`screen-${screenId}`);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }

    // Scroll para o topo ao trocar de tela (Bolão, Jogos do Dia, Carteira, etc.)
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.scrollTop = 0;

    
    // Atualiza sidebar
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });
    
    if (tabMap[screenId] !== undefined) {
        document.querySelectorAll('.sidebar-item')[tabMap[screenId]]?.classList.add('active');
    }

    // Atualiza bottom navigation bar (mobile)
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeBottomItem = document.querySelector(`.bottom-nav-item[data-screen="${screenId}"]`);
    if (activeBottomItem) {
        activeBottomItem.classList.add('active');
    }
    
    // Atualiza display de saldo
    if (typeof window.updateBalanceDisplays === 'function') {
        window.updateBalanceDisplays();
    }

    // Dispara evento customizado para listeners
    window.dispatchEvent(new CustomEvent('screenChanged', { detail: screenId }));
    
    // Renderiza apostas se na tela de meus jogos
    if (screenId === 'my-bets') {
        if (typeof window.checkBetsAgainstResults === 'function') {
            window.checkBetsAgainstResults().finally(() => {
                if (typeof window.filterBets === 'function') {
                    window.filterBets('active');
                }
            });
        }
        // Mostra tutorial na primeira visita
        if (typeof window.showMyBetsTutorial === 'function') {
            window.showMyBetsTutorial();
        }
    }

    // Renderiza transações se na tela de carteira
    if (screenId === 'wallet') {
        if (typeof window.renderTransactions === 'function') {
            window.renderTransactions();
        }
    }

    // Reseta UI de apostas ao sair da tela de apostas
    if (screenId !== 'betting') {
        const modesEl = document.querySelector('.betting-modes');
        const selectedEl = document.getElementById('mode-selected');
        if (modesEl) modesEl.classList.remove('hidden');
        if (selectedEl) selectedEl.classList.remove('visible');
        state.pendingBets = [];
        state.pendingMode = null;
        if (typeof window.renderGeneratedBets === 'function') {
            window.renderGeneratedBets();
        }
    }
    
    // Reseta tela de depósito
    if (screenId === 'deposit') {
        if (typeof window.resetDepositScreen === 'function') {
            window.resetDepositScreen();
        }
    }
    
    // Renderiza bolões se na tela de pools (dados do config) e depois atualiza com API (data/prêmio)
    if (screenId === 'pools') {
        if (typeof state !== 'undefined') state.currentPoolFilter = 'megasena';
        if (typeof window.renderPoolsPage === 'function') {
            window.renderPoolsPage();
        }
        if (typeof window.renderMyPoolsPage === 'function') {
            window.renderMyPoolsPage();
        }
        if (typeof window.loadNextDrawForPools === 'function') {
            window.loadNextDrawForPools().then(() => {
                if (typeof window.renderPoolsPage === 'function') window.renderPoolsPage();
                if (typeof window.renderMyPoolsPage === 'function') window.renderMyPoolsPage();
            }).catch(() => {});
        }
    }
    
    // Inicializa Jogos Prontos
    if (screenId === 'quick-games') {
        if (typeof window.initQuickGames === 'function') {
            window.initQuickGames();
        }
    }

    // Renderiza Últimos Concursos
    if (screenId === 'results') {
        if (typeof window.showResults === 'function') {
            window.showResults('lotofacil');
        }
    }
    
    // Re-inicializa ícones Lucide para conteúdo dinâmico
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    toggleSidebar(false);
}

const DESKTOP_BREAKPOINT = 1024;

/**
 * Verifica se está em viewport desktop
 */
function isDesktop() {
    return window.innerWidth >= DESKTOP_BREAKPOINT;
}

/**
 * Abre/fecha a sidebar
 * No desktop, a sidebar fica sempre aberta (não fecha ao trocar de tela)
 * @param {boolean} open - Se deve abrir (true) ou fechar (false)
 */
export function toggleSidebar(open) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (isDesktop()) {
        if (sidebar) sidebar.classList.add('open');
        if (overlay) overlay.classList.add('hidden');
        return;
    }
    
    const shouldOpen = open === true;
    if (sidebar) sidebar.classList.toggle('open', shouldOpen);
    if (overlay) overlay.classList.toggle('hidden', !shouldOpen);
}

/**
 * Carrega os fragmentos HTML das telas
 */
export async function loadScreens() {
    const main = document.getElementById('main-content');
    if (!main) return;

    const screenFiles = [
        'home',
        'betting',
        'wallet',
        'profile',
        'deposit',
        'withdraw',
        'my-bets',
        'pools',
        'results',
        'settings',
        'quick-games'
    ];

    try {
        const cacheBust = `?v=${Date.now()}`;
        const fragments = await Promise.all(
            screenFiles.map((name) =>
                fetch(`screens/${name}.html${cacheBust}`).then((response) => {
                    if (!response.ok) throw new Error(`Erro ao carregar ${name}`);
                    return response.text();
                })
            )
        );
        main.innerHTML = fragments.join('\n');
    } catch (error) {
        console.error(error);
        main.innerHTML = '<div class="screen active"><section class="section"><p>Erro ao carregar telas.</p></section></div>';
    }
}

export default { showScreen, toggleSidebar, loadScreens };
