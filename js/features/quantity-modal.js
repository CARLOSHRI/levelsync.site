/**
 * Quantity Modal Module - Modal de seleção de quantidade de jogos
 * @module features/quantity-modal
 */

import { state } from '../core/state.js';
import { lotteries } from '../core/config.js';
import { Utils } from '../utils/utils.js';
import { Validators } from '../utils/validators.js';
import { ErrorHandler } from '../utils/errors.js';
import { openBetting } from './betting.js';
import { startIAAutoGeneration } from './ia-expert.js';

/**
 * Abre o modal de quantidade
 */
export function openQuantityModal() {
    const modal = document.getElementById('quantity-modal');
    const input = document.getElementById('quantity-input');
    const logoImg = document.getElementById('quantity-lottery-logo');
    const preview = document.getElementById('quantity-preview');
    const warning = document.getElementById('quantity-select-warning');
    const confirmBtn = document.getElementById('quantity-confirm-btn');
    
    // Reset para estado inicial sem seleção
    if (input) input.value = 0;
    
    // Atualiza a logo da loteria
    if (logoImg && state.currentLottery) {
        const lottery = lotteries[state.currentLottery];
        if (lottery && lottery.logo) {
            logoImg.src = lottery.logo;
            logoImg.alt = lottery.name;
        }
    }
    
    // Remove seleção de todos os botões
    document.querySelectorAll('.quantity-quick-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Esconde preview, warning e desabilita botão
    if (preview) preview.classList.add('hidden');
    if (warning) warning.classList.add('hidden');
    if (confirmBtn) confirmBtn.classList.add('disabled');
    
    if (modal) {
        modal.classList.remove('qty-lotofacil', 'qty-megasena', 'qty-quina');
        if (state.currentLottery) {
            modal.classList.add(`qty-${state.currentLottery}`);
        }
        modal.classList.remove('hidden');
    }
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Fecha o modal de quantidade
 */
export function closeQuantityModal() {
    const modal = document.getElementById('quantity-modal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Volta para a seleção de modo (IA/Manual)
 */
export function backToModeSelection() {
    // Fecha o modal de quantidade
    const quantityModal = document.getElementById('quantity-modal');
    if (quantityModal) quantityModal.classList.add('hidden');
    
    // Reabre o modal de seleção de modo
    const modeModal = document.getElementById('mode-modal');
    if (modeModal) {
        modeModal.classList.remove('hidden');
        // Re-initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
}

/**
 * Define quantidade rápida
 * @param {number} qty - Quantidade
 */
export function setQuickQuantity(qty) {
    const input = document.getElementById('quantity-input');
    const preview = document.getElementById('quantity-preview');
    const warning = document.getElementById('quantity-select-warning');
    const confirmBtn = document.getElementById('quantity-confirm-btn');
    
    if (input) input.value = qty;
    
    document.querySelectorAll('.quantity-quick-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.qty) === qty) {
            btn.classList.add('active');
        }
    });
    
    // Mostra preview, esconde warning e ativa o botão
    if (preview) preview.classList.remove('hidden');
    if (warning) warning.classList.add('hidden');
    if (confirmBtn) confirmBtn.classList.remove('disabled');
    
    updateQuantityPreview(qty);
}

/**
 * Atualiza quantidade pelo slider
 * @param {string|number} value - Valor do slider
 */
export function updateQuantityFromSlider(value) {
    const qty = parseInt(value);
    const input = document.getElementById('quantity-input');
    
    if (input) input.value = qty;
    
    document.querySelectorAll('.quantity-quick-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.qty) === qty) {
            btn.classList.add('active');
        }
    });
    
    updateQuantityPreview(qty);
}

/**
 * Ajusta quantidade
 * @param {number} delta - Diferença a aplicar
 */
export function adjustQuantity(delta) {
    const input = document.getElementById('quantity-input');
    const slider = document.getElementById('quantity-slider');
    
    let current = parseInt(input?.value) || 1;
    let newValue = Math.max(1, Math.min(40, current + delta));
    
    if (input) input.value = newValue;
    if (slider) slider.value = newValue;
    
    document.querySelectorAll('.quantity-quick-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.qty) === newValue) {
            btn.classList.add('active');
        }
    });
    
    updateQuantityPreview(newValue);
}

/**
 * Atualiza display de quantidade
 */
export function updateQuantityDisplay() {
    const input = document.getElementById('quantity-input');
    const slider = document.getElementById('quantity-slider');
    
    let qty = parseInt(input?.value) || 1;
    qty = Math.max(1, Math.min(40, qty));
    
    if (input) input.value = qty;
    if (slider) slider.value = qty;
    
    document.querySelectorAll('.quantity-quick-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.qty) === qty) {
            btn.classList.add('active');
        }
    });
    
    updateQuantityPreview(qty);
}

/**
 * Atualiza o preenchimento visual do slider
 * @param {HTMLElement} slider - Elemento do slider
 */
function updateSliderFill(slider) {
    if (!slider) return;
    const min = parseInt(slider.min) || 1;
    const max = parseInt(slider.max) || 40;
    const value = parseInt(slider.value) || 1;
    const percentage = ((value - min) / (max - min)) * 100;
    // Ajusta para o centro do thumb (12px = metade do thumb de 24px)
    const thumbWidth = 24;
    const sliderWidth = slider.offsetWidth || 300;
    const thumbOffset = (thumbWidth / 2 / sliderWidth) * 100;
    const adjustedPercentage = percentage * (1 - thumbWidth / sliderWidth) + thumbOffset;
    slider.style.background = `linear-gradient(to right, #005CA9 0%, #005CA9 ${adjustedPercentage}%, #E5E7EB ${adjustedPercentage}%, #E5E7EB 100%)`;
}

/**
 * Atualiza preview da quantidade
 * @param {number} qty - Quantidade
 */
export function updateQuantityPreview(qty) {
    const gamesEl = document.getElementById('preview-games');
    const priceEl = document.getElementById('preview-price');
    const slider = document.getElementById('quantity-slider');
    
    if (gamesEl) gamesEl.textContent = qty;
    
    if (priceEl && state.currentLottery) {
        const lottery = lotteries[state.currentLottery];
        const pricePerGame = lottery?.basePrice || 5;
        const total = qty * pricePerGame;
        priceEl.textContent = Utils.formatCurrency(total);
    }
    
    // Atualiza o preenchimento do slider
    updateSliderFill(slider);
}

/**
 * Confirma a quantidade selecionada
 */
export function confirmQuantity() {
    return ErrorHandler.wrapSync(() => {
        const input = document.getElementById('quantity-input');
        const warning = document.getElementById('quantity-select-warning');
        let count = parseInt(input?.value, 10);
        
        // Verifica se uma quantidade foi selecionada
        if (!count || count === 0) {
            // Destaca o aviso
            if (warning) {
                warning.classList.remove('hidden');
                warning.style.animation = 'shake 0.5s ease';
                setTimeout(() => {
                    warning.style.animation = '';
                }, 500);
            }
            return;
        }
        
        const validation = Validators.validateGamesQuantity(count);
        if (!validation.valid) {
            if (typeof window.showToast === 'function') {
                window.showToast(validation.error, 'error');
            }
            return;
        }
        
        count = Utils.clamp(count, 1, Validators.LIMITS.GAMES_MAX);
        state.gamesToGenerate = count;

        closeQuantityModal();

        const mode = state.pendingMode || 'manual';
        state.pendingMode = null;

        if (mode === 'manual') {
            state.pendingBets = [];
            openBetting(state.currentLottery, mode);
            return;
        }

        if (mode === 'ai') {
            startIAAutoGeneration(state.currentLottery, count);
        }
    }, 'confirmQuantity');
}

export default {
    openQuantityModal,
    closeQuantityModal,
    backToModeSelection,
    setQuickQuantity,
    updateQuantityFromSlider,
    adjustQuantity,
    updateQuantityDisplay,
    updateQuantityPreview,
    confirmQuantity
};
