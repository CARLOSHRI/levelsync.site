/**
 * Mode Modal Module - Modal de seleção de modo de geração
 * @module features/mode-modal
 */

import { state } from '../core/state.js';
import { lotteries } from '../core/config.js';
import { openBetting } from './betting.js';
import { openQuantityModal } from './quantity-modal.js';

/**
 * Abre o modal de seleção de modo
 * @param {string} lotteryId - ID da loteria
 */
export function openBettingSelection(lotteryId) {
    state.currentLottery = lotteryId;
    const modal = document.getElementById('mode-modal');
    const logo = document.getElementById('mode-selected-logo');
    const lottery = lotteries[lotteryId];

    if (logo && lottery) {
        logo.src = lottery.logo;
        logo.alt = lottery.name;
    }

    if (modal) {
        // Remove classes de loteria anteriores e adiciona a atual
        modal.classList.remove('mode-lotofacil', 'mode-megasena', 'mode-quina');
        modal.classList.add(`mode-${lotteryId}`);
        modal.classList.remove('hidden');
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Fecha o modal de seleção de modo
 */
export function closeModeModal() {
    const modal = document.getElementById('mode-modal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Confirma a seleção do modo
 * @param {string} mode - Modo selecionado (manual ou ai)
 */
export function confirmModeSelection(mode) {
    closeModeModal();
    if (mode === 'manual') {
        state.pendingMode = null;
        state.pendingBets = [];
        openBetting(state.currentLottery, mode);
        return;
    }

    state.pendingMode = mode;
    openQuantityModal();
}

export default {
    openBettingSelection,
    closeModeModal,
    confirmModeSelection
};
