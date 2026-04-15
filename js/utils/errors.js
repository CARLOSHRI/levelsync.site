/**
 * Errors Module - Tratamento centralizado de erros
 * @module utils/errors
 */

import { showToast } from '../ui/toasts.js';

export const ErrorHandler = {
    /**
     * Tipos de erro
     */
    ERROR_TYPES: {
        VALIDATION: 'VALIDATION',
        STORAGE: 'STORAGE',
        NETWORK: 'NETWORK',
        UNKNOWN: 'UNKNOWN'
    },

    /**
     * Trata erros e retorna mensagem amigável
     * @param {Error|string} error - Erro a tratar
     * @param {string} context - Contexto onde ocorreu o erro
     * @returns {string} Mensagem de erro amigável
     */
    handle(error, context = '') {
        console.error(`Erro em ${context}:`, error);

        if (typeof error === 'string') {
            return error;
        }

        if (error instanceof Error) {
            // Erros de validação
            if (error.message.includes('Valor') || error.message.includes('inválido')) {
                return error.message;
            }

            // Erros de storage
            if (error.message.includes('salvar') || error.message.includes('carregar')) {
                return 'Erro ao salvar dados. Tente novamente.';
            }

            // Erros de rede
            if (error.message.includes('fetch') || error.message.includes('network')) {
                return 'Erro de conexão. Verifique sua internet.';
            }

            return error.message || 'Ocorreu um erro inesperado. Tente novamente.';
        }

        return 'Ocorreu um erro inesperado. Tente novamente.';
    },

    /**
     * Wrapper para funções assíncronas com tratamento de erro
     * @param {Function} fn - Função a executar
     * @param {string} context - Contexto da função
     * @returns {Promise} Promise com resultado ou erro tratado
     */
    async wrapAsync(fn, context) {
        try {
            return await fn();
        } catch (error) {
            const message = this.handle(error, context);
            showToast(message, 'error');
            throw new Error(message);
        }
    },

    /**
     * Wrapper para funções síncronas com tratamento de erro
     * @param {Function} fn - Função a executar
     * @param {string} context - Contexto da função
     * @param {*} defaultValue - Valor padrão em caso de erro
     * @returns {*} Resultado da função ou valor padrão
     */
    wrapSync(fn, context, defaultValue = null) {
        try {
            return fn();
        } catch (error) {
            const message = this.handle(error, context);
            showToast(message, 'error');
            return defaultValue;
        }
    }
};

export default ErrorHandler;
