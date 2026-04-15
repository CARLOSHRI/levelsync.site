/**
 * Deposit Module - Depósito via PIX (Duttyfy)
 * @module wallet/deposit
 */

import { state } from '../core/state.js';
import { Utils } from '../utils/utils.js';
import { Validators } from '../utils/validators.js';
import { ErrorHandler } from '../utils/errors.js';
import { updateBalanceDisplays, saveData, loadFromAPI } from './balance.js';
import { apiCreateDeposit, apiCheckDepositStatus } from '../api-client.js';

// Estado do depósito atual
let currentPixCode = '';
let currentTransactionId = '';
let pollingInterval = null;
let isChecking = false;        // impede chamadas concorrentes ao status
let paymentConfirmed = false;  // impede onPaymentConfirmed duplicado
let depositInModal = false;    // true quando depósito foi aberto via modal (Jogos do Dia)

/**
 * Reseta a tela de depósito
 */
export function resetDepositScreen() {
    state.depositAmount = 100;
    state.qrCodeGenerated = false;
    currentPixCode = '';
    currentTransactionId = '';
    isChecking = false;
    paymentConfirmed = false;
    stopPolling();
    
    const amountInput = document.getElementById('deposit-amount');
    if (amountInput) amountInput.value = '100';
    
    updateDepositDisplay();
    
    // Reset amount buttons
    document.querySelectorAll('.amount-btn, .amount-btn-pro, .deposit-preset-btn, .deposit-quick-btn, .deposit-value-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.amount === '100') {
            btn.classList.add('active');
        }
    });
    
    // Mostra etapa 1, esconde etapa 2
    const step1 = document.getElementById('deposit-step-amount');
    const step2 = document.getElementById('deposit-step-pix');
    if (step1) step1.classList.remove('hidden');
    if (step2) step2.classList.add('hidden');

    // Reset botão
    const depositBtn = document.getElementById('btn-deposit');
    if (depositBtn) {
        depositBtn.disabled = false;
        depositBtn.innerHTML = '<img src="assets/logo-pix.png" alt="PIX" class="btn-pix-icon"> Gerar código PIX';
    }

    // Dados do cliente (nome/email) agora são enviados do localStorage automaticamente
}

/**
 * Define o valor do depósito
 * @param {number} amount - Valor do depósito
 */
export function setDepositAmount(amount) {
    state.depositAmount = amount;
    
    const amountInput = document.getElementById('deposit-amount');
    if (amountInput) amountInput.value = amount.toLocaleString('pt-BR');
    
    document.querySelectorAll('.amount-btn, .amount-btn-pro, .deposit-preset-btn, .deposit-quick-btn, .deposit-value-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.amount) === amount) {
            btn.classList.add('active');
        }
    });
    
    updateDepositDisplay();
}

/**
 * Atualiza o display do valor de depósito
 */
export function updateDepositDisplay() {
    const displayEl = document.getElementById('deposit-value');
    if (displayEl) {
        const amount = Math.floor(state.depositAmount);
        displayEl.textContent = amount.toLocaleString('pt-BR');
    }
    
    const inputEl = document.getElementById('deposit-amount');
    if (inputEl && document.activeElement !== inputEl) {
        const amount = Math.floor(state.depositAmount);
        inputEl.value = amount > 0 ? amount : '';
    }
}

/**
 * Callback quando o usuário digita um valor manualmente
 * Remove a seleção dos botões de preset, formata com pontos e garante valores inteiros
 * @param {string} value - Valor digitado
 */
export function onDepositInputChange(value) {
    const cleanValue = value.replace(/\D/g, '');
    let amount = parseInt(cleanValue, 10) || 0;
    
    if (amount > 5000) amount = 5000;
    
    state.depositAmount = amount;
    
    const input = document.getElementById('deposit-amount');
    if (input) {
        const cursorPos = input.selectionStart;
        const oldLength = input.value.length;
        const formatted = amount > 0 ? amount.toLocaleString('pt-BR') : '';
        input.value = formatted;
        const newLength = formatted.length;
        const newCursorPos = Math.max(0, cursorPos + (newLength - oldLength));
        input.setSelectionRange(newCursorPos, newCursorPos);
    }
    
    document.querySelectorAll('.amount-btn, .amount-btn-pro, .deposit-preset-btn, .deposit-quick-btn, .deposit-value-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.amount) === amount) {
            btn.classList.add('active');
        }
    });
    
    const displayEl = document.getElementById('deposit-value');
    if (displayEl) {
        displayEl.textContent = amount.toLocaleString('pt-BR');
    }
}

/**
 * Processa o depósito - gera PIX via Duttyfy
 * Nome e email vêm do localStorage; CPF e telefone são gerados no backend.
 */
export function processDeposit() {
    return ErrorHandler.wrapSync(() => {
        const amountInput = document.getElementById('deposit-amount');
        if (amountInput) {
            const cleanValue = amountInput.value.replace(/\D/g, '');
            let value = parseInt(cleanValue, 10) || 0;
            const validation = Validators.validateDeposit(value);
            if (!validation.valid) {
                if (typeof window.showToast === 'function') {
                    window.showToast(validation.error, 'error');
                }
                return;
            }
            state.depositAmount = value;
        }

        // Usa nome e email do cadastro do usuário
        const name = localStorage.getItem('lotograna_user_name') || 'Cliente';
        const email = localStorage.getItem('lotograna_user_email') || 'cliente@email.com';

        // Desabilita botão
        const btn = document.getElementById('btn-deposit');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<div class="pix-loading-spinner" style="width:20px;height:20px;border-width:2px;"></div> Gerando PIX...';
        }

        // Chama a API (CPF e telefone são gerados pelo backend)
        generatePix(state.depositAmount, { name, email });
    }, 'processDeposit');
}

/**
 * Gera o PIX via API
 */
async function generatePix(amount, customer) {
    const btn = document.getElementById('btn-deposit');
    try {
        const result = await apiCreateDeposit(amount, customer);

        currentPixCode = result.pixCode;
        currentTransactionId = result.transactionId;

        // Mostra etapa 2
        const step1 = document.getElementById('deposit-step-amount');
        const step2 = document.getElementById('deposit-step-pix');
        if (step1) step1.classList.add('hidden');
        if (step2) step2.classList.remove('hidden');

        // Mostra valor e código PIX
        const pixValueEl = document.getElementById('deposit-pix-value');
        if (pixValueEl) {
            pixValueEl.textContent = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        }

        const pixCodeDisplay = document.getElementById('pix-code-display');
        if (pixCodeDisplay) {
            pixCodeDisplay.textContent = currentPixCode;
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Inicia polling de status
        startPolling();

    } catch (err) {
        if (typeof window.showToast === 'function') {
            window.showToast(err.message || 'Erro ao gerar PIX', 'error');
        }
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<img src="assets/logo-pix.png" alt="PIX" class="btn-pix-icon"> Gerar código PIX';
        }
    }
}

/**
 * Copia o código PIX para a área de transferência
 */
window.copyPixCode = function() {
    if (!currentPixCode) return;

    navigator.clipboard.writeText(currentPixCode).then(() => {
        if (typeof window.showToast === 'function') {
            window.showToast('Código PIX copiado!', 'success');
        }
        const btn = document.getElementById('btn-copy-pix');
        if (btn) {
            btn.innerHTML = '<i data-lucide="check"></i> Copiado!';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            setTimeout(() => {
                btn.innerHTML = '<i data-lucide="copy"></i> Copiar código PIX';
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }, 2000);
        }
    }).catch(() => {
        // Fallback para navegadores sem clipboard API
        const textarea = document.createElement('textarea');
        textarea.value = currentPixCode;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        if (typeof window.showToast === 'function') {
            window.showToast('Código PIX copiado!', 'success');
        }
    });
};

/**
 * Cancela o depósito e volta para a etapa 1
 */
window.cancelDeposit = function() {
    stopPolling();
    resetDepositScreen();
};

/**
 * Inicia polling para verificar status do pagamento
 */
function startPolling() {
    stopPolling();
    // Verifica a cada 5 segundos
    pollingInterval = setInterval(checkPaymentStatus, 5000);
    // Primeira verificação imediata após 3s
    setTimeout(checkPaymentStatus, 3000);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

/**
 * Verifica o status do pagamento na API.
 * Usa flags para impedir chamadas concorrentes e crédito duplicado.
 */
async function checkPaymentStatus() {
    // Guard: se já confirmou ou já está verificando, não faz nada
    if (!currentTransactionId || paymentConfirmed || isChecking) return;

    isChecking = true;
    try {
        const result = await apiCheckDepositStatus(currentTransactionId);

        if (result.status === 'COMPLETED' && result.credited && !paymentConfirmed) {
            paymentConfirmed = true;   // trava ANTES de qualquer outra coisa
            stopPolling();
            currentTransactionId = ''; // limpa para impedir qualquer chamada futura
            onPaymentConfirmed(result.amount);
        }
    } catch (err) {
        console.warn('[Deposit] Erro ao verificar status:', err);
    } finally {
        isChecking = false;
    }
}

/**
 * Chamado UMA ÚNICA VEZ quando o pagamento é confirmado
 */
function onPaymentConfirmed(amount) {
    const statusIcon = depositInModal
        ? document.getElementById('deposit-modal-status-icon')
        : document.getElementById('pix-status-icon');
    const statusText = depositInModal
        ? document.getElementById('deposit-modal-status-text')
        : document.getElementById('pix-status-text');

    if (statusIcon) {
        statusIcon.innerHTML = '<span style="color:#22c55e;">&#10003;</span>';
    }
    if (statusText) {
        statusText.textContent = 'Pagamento confirmado!';
        statusText.style.color = '#22c55e';
    }

    // Recarrega dados da API para atualizar saldo e transações (saldo já foi creditado no backend)
    loadFromAPI().then(() => {
        updateBalanceDisplays();
        saveData();
    });

    if (typeof window.showToast === 'function') {
        window.showToast(`Depósito de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} confirmado!`, 'success');
    }

    if (depositInModal) {
        // Fica na mesma página (Jogos do Dia), fecha o modal após 2s
        setTimeout(() => {
            closeDepositModal();
        }, 2000);
    } else {
        // Tela de depósito: volta para carteira após 3s
        setTimeout(() => {
            if (typeof window.showScreen === 'function') {
                window.showScreen('wallet');
            }
            resetDepositScreen();
        }, 3000);
    }
}

// ==================== MODAL (Jogos do Dia - depósito sem sair da página) ====================

/**
 * Abre o modal de depósito (usado em Jogos do Dia quando saldo insuficiente)
 */
export function openDepositModal() {
    depositInModal = true;
    state.depositAmount = 100;
    currentPixCode = '';
    currentTransactionId = '';
    isChecking = false;
    paymentConfirmed = false;
    stopPolling();

    const modal = document.getElementById('deposit-modal');
    const step1 = document.getElementById('deposit-modal-step-amount');
    const step2 = document.getElementById('deposit-modal-step-pix');
    const amountInput = document.getElementById('deposit-modal-amount');
    const valueEl = document.getElementById('deposit-modal-value');
    const btn = document.getElementById('btn-deposit-modal');

    if (amountInput) amountInput.value = '100';
    if (valueEl) valueEl.textContent = '100';
    if (step1) step1.classList.remove('hidden');
    if (step2) step2.classList.add('hidden');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<img src="assets/logo-pix.png" alt="PIX" class="btn-pix-icon"> Gerar código PIX';
    }

    document.querySelectorAll('#deposit-modal .deposit-value-btn').forEach(b => {
        b.classList.remove('active');
        if (b.dataset.amount === '100') b.classList.add('active');
    });

    if (modal) modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Fecha o modal de depósito
 */
export function closeDepositModal() {
    depositInModal = false;
    stopPolling();
    currentPixCode = '';
    currentTransactionId = '';
    const modal = document.getElementById('deposit-modal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Define valor no modal
 */
window.setDepositAmountModal = function(amount) {
    state.depositAmount = amount;
    const amountInput = document.getElementById('deposit-modal-amount');
    const valueEl = document.getElementById('deposit-modal-value');
    if (amountInput) amountInput.value = amount.toLocaleString('pt-BR');
    if (valueEl) valueEl.textContent = amount.toLocaleString('pt-BR');
    document.querySelectorAll('#deposit-modal .deposit-value-btn').forEach(b => {
        b.classList.remove('active');
        if (parseInt(b.dataset.amount) === amount) b.classList.add('active');
    });
};

/**
 * Input manual no modal
 */
window.onDepositModalInputChange = function(value) {
    const cleanValue = value.replace(/\D/g, '');
    let amount = parseInt(cleanValue, 10) || 0;
    if (amount > 5000) amount = 5000;
    state.depositAmount = amount;
    const input = document.getElementById('deposit-modal-amount');
    if (input) {
        const cursorPos = input.selectionStart;
        const oldLength = input.value.length;
        const formatted = amount > 0 ? amount.toLocaleString('pt-BR') : '';
        input.value = formatted;
        const newLength = formatted.length;
        const newCursorPos = Math.max(0, cursorPos + (newLength - oldLength));
        input.setSelectionRange(newCursorPos, newCursorPos);
    }
    const valueEl = document.getElementById('deposit-modal-value');
    if (valueEl) valueEl.textContent = amount.toLocaleString('pt-BR');
    document.querySelectorAll('#deposit-modal .deposit-value-btn').forEach(b => {
        b.classList.remove('active');
        if (parseInt(b.dataset.amount) === amount) b.classList.add('active');
    });
};

/**
 * Processa depósito no modal
 */
window.processDepositModal = function() {
    return ErrorHandler.wrapSync(() => {
        const amountInput = document.getElementById('deposit-modal-amount');
        if (amountInput) {
            const cleanValue = amountInput.value.replace(/\D/g, '');
            let value = parseInt(cleanValue, 10) || 0;
            const validation = Validators.validateDeposit(value);
            if (!validation.valid) {
                if (typeof window.showToast === 'function') {
                    window.showToast(validation.error, 'error');
                }
                return;
            }
            state.depositAmount = value;
        }

        const name = localStorage.getItem('lotograna_user_name') || 'Cliente';
        const email = localStorage.getItem('lotograna_user_email') || 'cliente@email.com';

        const btn = document.getElementById('btn-deposit-modal');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<div class="pix-loading-spinner" style="width:20px;height:20px;border-width:2px;"></div> Gerando PIX...';
        }

        generatePixForModal(state.depositAmount, { name, email });
    }, 'processDepositModal');
};

async function generatePixForModal(amount, customer) {
    const btn = document.getElementById('btn-deposit-modal');
    try {
        const result = await apiCreateDeposit(amount, customer);
        currentPixCode = result.pixCode;
        currentTransactionId = result.transactionId;

        const step1 = document.getElementById('deposit-modal-step-amount');
        const step2 = document.getElementById('deposit-modal-step-pix');
        if (step1) step1.classList.add('hidden');
        if (step2) step2.classList.remove('hidden');

        const pixValueEl = document.getElementById('deposit-modal-pix-value');
        if (pixValueEl) pixValueEl.textContent = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

        const pixCodeDisplay = document.getElementById('deposit-modal-pix-code');
        if (pixCodeDisplay) pixCodeDisplay.textContent = currentPixCode;

        if (typeof lucide !== 'undefined') lucide.createIcons();
        startPolling();
    } catch (err) {
        if (typeof window.showToast === 'function') {
            window.showToast(err.message || 'Erro ao gerar PIX', 'error');
        }
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<img src="assets/logo-pix.png" alt="PIX" class="btn-pix-icon"> Gerar código PIX';
        }
    }
}

window.copyPixCodeModal = function() {
    if (!currentPixCode) return;
    navigator.clipboard.writeText(currentPixCode).then(() => {
        if (typeof window.showToast === 'function') {
            window.showToast('Código PIX copiado!', 'success');
        }
        const btn = document.getElementById('btn-copy-pix-modal');
        if (btn) {
            btn.innerHTML = '<i data-lucide="check"></i> Copiado!';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            setTimeout(() => {
                btn.innerHTML = '<i data-lucide="copy"></i> Copiar código PIX';
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }, 2000);
        }
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = currentPixCode;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        if (typeof window.showToast === 'function') {
            window.showToast('Código PIX copiado!', 'success');
        }
    });
};

window.cancelDepositModal = function() {
    stopPolling();
    closeDepositModal();
};

export default {
    resetDepositScreen,
    setDepositAmount,
    updateDepositDisplay,
    processDeposit,
    onDepositInputChange,
    openDepositModal,
    closeDepositModal
};
