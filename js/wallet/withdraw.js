/**
 * Withdraw Module - Funcionalidades de saque
 * @module wallet/withdraw
 */

import { state } from '../core/state.js';
import { Utils } from '../utils/utils.js';
import { Validators } from '../utils/validators.js';
import { ErrorHandler } from '../utils/errors.js';
import { updateBalanceDisplays, saveData } from './balance.js';
import { apiCreateWithdrawal } from '../api-client.js';

/**
 * Define o valor máximo para saque
 */
export function setMaxWithdraw() {
    const withdrawInput = document.getElementById('withdraw-amount');
    if (withdrawInput) {
        withdrawInput.value = state.balance.toFixed(2);
    }
}

/**
 * Processa o saque
 */
export function processWithdraw() {
    return ErrorHandler.wrapSync(() => {
        const withdrawInput = document.getElementById('withdraw-amount');
        const pixKeyInput = document.getElementById('pix-key');
        
        if (!withdrawInput || !pixKeyInput) {
            if (typeof window.showToast === 'function') {
                window.showToast('Erro ao processar saque', 'error');
            }
            return;
        }
        
        const amount = parseFloat(withdrawInput.value) || 0;
        const pixKey = Utils.sanitizeString(pixKeyInput.value);
        
        // Valida valor
        const amountValidation = Validators.validateWithdraw(amount, state.balance);
        if (!amountValidation.valid) {
            if (typeof window.showToast === 'function') {
                window.showToast(amountValidation.error, 'error');
            }
            return;
        }
        
        // Valida chave PIX
        const pixValidation = Validators.validatePixKey(pixKey);
        if (!pixValidation.valid) {
            if (typeof window.showToast === 'function') {
                window.showToast(pixValidation.error, 'error');
            }
            return;
        }
        
        state.balance -= amount;
        const txDate = Utils.formatDate(new Date());
        state.transactions.unshift({
            id: Utils.generateId(),
            type: 'withdraw',
            method: 'pix',
            value: amount,
            date: txDate
        });
        
        updateBalanceDisplays();
        saveData();

        // Persiste no banco via API de saques (com chave PIX e fluxo de aprovação)
        apiCreateWithdrawal(amount, pixKey)
            .catch(err => console.warn('[API] Erro ao criar saque:', err));
        
        if (typeof window.showToast === 'function') {
            window.showToast('Saque solicitado com sucesso!', 'success');
        }
        if (typeof window.showScreen === 'function') {
            window.showScreen('wallet');
        }
    }, 'processWithdraw');
}

export default {
    setMaxWithdraw,
    processWithdraw
};
