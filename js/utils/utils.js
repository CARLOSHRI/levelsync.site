/**
 * Utils Module - Funções auxiliares e utilitárias
 * @module utils/utils
 */

export const Utils = {
    /**
     * Formata valor monetário em Real brasileiro
     * @param {number} value - Valor a ser formatado
     * @returns {string} Valor formatado (ex: "R$ 1.234,56")
     */
    formatCurrency(value) {
        return `R$ ${parseFloat(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },

    /**
     * Formata data para formato brasileiro
     * @param {Date|string} date - Data a ser formatada
     * @returns {string} Data formatada (ex: "01/02/2026")
     */
    formatDate(date) {
        const d = date instanceof Date ? date : new Date(date);
        return d.toLocaleDateString('pt-BR');
    },

    /**
     * Valida se um número está dentro do range permitido
     * @param {number} number - Número a validar
     * @param {number} min - Valor mínimo
     * @param {number} max - Valor máximo
     * @returns {boolean} true se válido
     */
    isValidNumber(number, min, max) {
        return Number.isInteger(number) && number >= min && number <= max;
    },

    /**
     * Valida se um array de números não tem duplicatas
     * @param {Array<number>} numbers - Array de números
     * @returns {boolean} true se não há duplicatas
     */
    hasNoDuplicates(numbers) {
        return new Set(numbers).size === numbers.length;
    },

    /**
     * Valida chave PIX
     * @param {string} pixKey - Chave PIX a validar
     * @returns {boolean} true se válida
     */
    isValidPixKey(pixKey) {
        if (!pixKey || pixKey.trim().length === 0) return false;
        
        // Email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(pixKey)) return true;
        
        // CPF (11 dígitos)
        const cpfRegex = /^\d{11}$/;
        if (cpfRegex.test(pixKey.replace(/\D/g, ''))) return true;
        
        // Telefone (10 ou 11 dígitos)
        const phoneRegex = /^\d{10,11}$/;
        if (phoneRegex.test(pixKey.replace(/\D/g, ''))) return true;
        
        // Chave aleatória (UUID)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(pixKey)) return true;
        
        return false;
    },

    /**
     * Sanitiza string removendo caracteres perigosos
     * @param {string} str - String a sanitizar
     * @returns {string} String sanitizada
     */
    sanitizeString(str) {
        if (typeof str !== 'string') return '';
        return str.trim().replace(/[<>]/g, '');
    },

    /**
     * Debounce function - atrasa execução de função
     * @param {Function} func - Função a executar
     * @param {number} wait - Tempo de espera em ms
     * @returns {Function} Função com debounce
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Gera ID único baseado em timestamp
     * @returns {number} ID único
     */
    generateId() {
        return Date.now() + Math.floor(Math.random() * 1000);
    },

    /**
     * Valida valor monetário
     * @param {number} value - Valor a validar
     * @param {number} min - Valor mínimo
     * @param {number} max - Valor máximo (opcional)
     * @returns {Object} { valid: boolean, error: string }
     */
    validateMoney(value, min, max = null) {
        if (typeof value !== 'number' || isNaN(value)) {
            return { valid: false, error: 'Valor inválido' };
        }
        
        if (value < min) {
            return { valid: false, error: `Valor mínimo: ${Utils.formatCurrency(min)}` };
        }
        
        if (max !== null && value > max) {
            return { valid: false, error: `Valor máximo: ${Utils.formatCurrency(max)}` };
        }
        
        return { valid: true, error: null };
    },

    /**
     * Clamp - limita valor entre min e max
     * @param {number} value - Valor a limitar
     * @param {number} min - Valor mínimo
     * @param {number} max - Valor máximo
     * @returns {number} Valor limitado
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
};

export default Utils;
