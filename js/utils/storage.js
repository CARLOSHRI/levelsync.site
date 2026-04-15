/**
 * Storage Module - Persistência de dados usando localStorage
 * @module utils/storage
 */

export const Storage = {
    /**
     * Chaves usadas no localStorage
     */
    KEYS: {
        BALANCE: 'lotoexpert_balance',
        BETS: 'lotoexpert_bets',
        TRANSACTIONS: 'lotoexpert_transactions',
        PREFERENCES: 'lotoexpert_preferences',
        POOL_PARTICIPATIONS: 'lotoexpert_pool_participations',
        POOL_FILLED_SPOTS: 'lotoexpert_pool_filled_spots'
    },

    /**
     * Salva o saldo do usuário
     * @param {number} balance - Saldo a ser salvo
     */
    saveBalance(balance) {
        try {
            localStorage.setItem(this.KEYS.BALANCE, JSON.stringify(balance));
        } catch (error) {
            console.error('Erro ao salvar saldo:', error);
            throw new Error('Não foi possível salvar o saldo');
        }
    },

    /**
     * Carrega o saldo do usuário
     * @returns {number} Saldo salvo ou null se não existir
     */
    loadBalance() {
        try {
            const saved = localStorage.getItem(this.KEYS.BALANCE);
            return saved ? parseFloat(JSON.parse(saved)) : null;
        } catch (error) {
            console.error('Erro ao carregar saldo:', error);
            return null;
        }
    },

    /**
     * Salva as apostas do usuário
     * @param {Array} bets - Array de apostas
     */
    saveBets(bets) {
        try {
            localStorage.setItem(this.KEYS.BETS, JSON.stringify(bets));
        } catch (error) {
            console.error('Erro ao salvar apostas:', error);
            throw new Error('Não foi possível salvar as apostas');
        }
    },

    /**
     * Carrega as apostas do usuário
     * @returns {Array} Array de apostas ou null
     */
    loadBets() {
        try {
            const saved = localStorage.getItem(this.KEYS.BETS);
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Erro ao carregar apostas:', error);
            return null;
        }
    },

    /**
     * Salva as transações do usuário
     * @param {Array} transactions - Array de transações
     */
    saveTransactions(transactions) {
        try {
            localStorage.setItem(this.KEYS.TRANSACTIONS, JSON.stringify(transactions));
        } catch (error) {
            console.error('Erro ao salvar transações:', error);
            throw new Error('Não foi possível salvar as transações');
        }
    },

    /**
     * Carrega as transações do usuário
     * @returns {Array} Array de transações ou null
     */
    loadTransactions() {
        try {
            const saved = localStorage.getItem(this.KEYS.TRANSACTIONS);
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Erro ao carregar transações:', error);
            return null;
        }
    },

    /**
     * Salva preferências do usuário
     * @param {Object} preferences - Objeto com preferências
     */
    savePreferences(preferences) {
        try {
            localStorage.setItem(this.KEYS.PREFERENCES, JSON.stringify(preferences));
        } catch (error) {
            console.error('Erro ao salvar preferências:', error);
        }
    },

    /**
     * Carrega preferências do usuário
     * @returns {Object} Objeto com preferências ou objeto vazio
     */
    loadPreferences() {
        try {
            const saved = localStorage.getItem(this.KEYS.PREFERENCES);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error('Erro ao carregar preferências:', error);
            return {};
        }
    },

    /**
     * Salva participações em bolões
     * @param {Array} participations - Array de participações
     */
    savePoolParticipations(participations) {
        try {
            localStorage.setItem(this.KEYS.POOL_PARTICIPATIONS, JSON.stringify(participations));
        } catch (error) {
            console.error('Erro ao salvar participações em bolões:', error);
        }
    },

    /**
     * Carrega participações em bolões
     * @returns {Array} Array de participações ou array vazio
     */
    loadPoolParticipations() {
        try {
            const saved = localStorage.getItem(this.KEYS.POOL_PARTICIPATIONS);
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Erro ao carregar participações em bolões:', error);
            return [];
        }
    },

    /**
     * Salva cotas preenchidas dos bolões
     * @param {Object} filledSpots - Objeto com poolId: filledSpots
     */
    savePoolFilledSpots(filledSpots) {
        try {
            localStorage.setItem(this.KEYS.POOL_FILLED_SPOTS, JSON.stringify(filledSpots));
        } catch (error) {
            console.error('Erro ao salvar cotas preenchidas:', error);
        }
    },

    /**
     * Carrega cotas preenchidas dos bolões
     * @returns {Object} Objeto com poolId: filledSpots ou objeto vazio
     */
    loadPoolFilledSpots() {
        try {
            const saved = localStorage.getItem(this.KEYS.POOL_FILLED_SPOTS);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error('Erro ao carregar cotas preenchidas:', error);
            return {};
        }
    },

    /**
     * Limpa todos os dados salvos
     */
    clearAll() {
        try {
            Object.values(this.KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
        } catch (error) {
            console.error('Erro ao limpar dados:', error);
        }
    },

    /**
     * Verifica se o localStorage está disponível
     * @returns {boolean} true se disponível, false caso contrário
     */
    isAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch {
            return false;
        }
    }
};

export default Storage;
