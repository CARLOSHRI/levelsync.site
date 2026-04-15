/**
 * Validators Module - Validações de dados e regras de negócio
 * @module utils/validators
 */

import { Utils } from './utils.js';

export const Validators = {
    /**
     * Limites de valores
     */
    LIMITS: {
        DEPOSIT_MIN: 10,
        DEPOSIT_MAX: 5000,
        WITHDRAW_MIN: 20,
        WITHDRAW_MAX: 50000,
        GAMES_MAX: 300
    },

    /**
     * Valida depósito
     * @param {number} amount - Valor do depósito
     * @returns {Object} { valid: boolean, error: string }
     */
    validateDeposit(amount) {
        return Utils.validateMoney(amount, this.LIMITS.DEPOSIT_MIN, this.LIMITS.DEPOSIT_MAX);
    },

    /**
     * Valida saque
     * @param {number} amount - Valor do saque
     * @param {number} balance - Saldo disponível
     * @returns {Object} { valid: boolean, error: string }
     */
    validateWithdraw(amount, balance) {
        const moneyValidation = Utils.validateMoney(amount, this.LIMITS.WITHDRAW_MIN, this.LIMITS.WITHDRAW_MAX);
        if (!moneyValidation.valid) {
            return moneyValidation;
        }

        if (amount > balance) {
            return { valid: false, error: 'Saldo insuficiente' };
        }

        return { valid: true, error: null };
    },

    /**
     * Valida quantidade de jogos
     * @param {number} quantity - Quantidade de jogos
     * @returns {Object} { valid: boolean, error: string }
     */
    validateGamesQuantity(quantity) {
        if (!Number.isInteger(quantity) || quantity < 1) {
            return { valid: false, error: 'Quantidade deve ser pelo menos 1' };
        }

        if (quantity > this.LIMITS.GAMES_MAX) {
            return { valid: false, error: `Máximo de ${this.LIMITS.GAMES_MAX} jogos por vez` };
        }

        return { valid: true, error: null };
    },

    /**
     * Valida números de loteria
     * @param {Array<number>} numbers - Array de números
     * @param {Object} lottery - Configuração da loteria
     * @returns {Object} { valid: boolean, error: string }
     */
    validateLotteryNumbers(numbers, lottery) {
        if (!Array.isArray(numbers)) {
            return { valid: false, error: 'Números inválidos' };
        }

        if (numbers.length < lottery.minNumbers) {
            return { valid: false, error: `Selecione pelo menos ${lottery.minNumbers} números` };
        }

        if (numbers.length > lottery.maxNumbers) {
            return { valid: false, error: `Máximo de ${lottery.maxNumbers} números` };
        }

        // Verifica duplicatas
        if (!Utils.hasNoDuplicates(numbers)) {
            return { valid: false, error: 'Números duplicados não são permitidos' };
        }

        // Valida range de cada número
        for (const num of numbers) {
            if (!Utils.isValidNumber(num, 1, lottery.maxNumber)) {
                return { valid: false, error: `Número ${num} fora do range permitido (1-${lottery.maxNumber})` };
            }
        }

        return { valid: true, error: null };
    },

    /**
     * Valida saldo para aposta
     * @param {number} betValue - Valor da aposta
     * @param {number} balance - Saldo disponível
     * @returns {Object} { valid: boolean, error: string }
     */
    validateBetBalance(betValue, balance) {
        if (betValue <= 0) {
            return { valid: false, error: 'Valor da aposta inválido' };
        }

        if (betValue > balance) {
            return { valid: false, error: 'Saldo insuficiente' };
        }

        return { valid: true, error: null };
    },

    /**
     * Valida múltiplas apostas
     * @param {Array<Array<number>>} bets - Array de arrays de números
     * @param {Object} lottery - Configuração da loteria
     * @param {number} totalValue - Valor total das apostas
     * @param {number} balance - Saldo disponível
     * @returns {Object} { valid: boolean, error: string }
     */
    validateMultipleBets(bets, lottery, totalValue, balance) {
        if (!Array.isArray(bets) || bets.length === 0) {
            return { valid: false, error: 'Nenhuma aposta gerada' };
        }

        // Valida quantidade
        const quantityValidation = this.validateGamesQuantity(bets.length);
        if (!quantityValidation.valid) {
            return quantityValidation;
        }

        // Valida cada aposta
        for (let i = 0; i < bets.length; i++) {
            const numbersValidation = this.validateLotteryNumbers(bets[i], lottery);
            if (!numbersValidation.valid) {
                return { valid: false, error: `Aposta ${i + 1}: ${numbersValidation.error}` };
            }
        }

        // Valida saldo
        return this.validateBetBalance(totalValue, balance);
    },

    /**
     * Valida chave PIX
     * @param {string} pixKey - Chave PIX
     * @returns {Object} { valid: boolean, error: string }
     */
    validatePixKey(pixKey) {
        if (!pixKey || pixKey.trim().length === 0) {
            return { valid: false, error: 'Informe sua chave PIX' };
        }

        if (!Utils.isValidPixKey(pixKey)) {
            return { valid: false, error: 'Chave PIX inválida. Use CPF, email, telefone ou chave aleatória' };
        }

        return { valid: true, error: null };
    }
};

export default Validators;
