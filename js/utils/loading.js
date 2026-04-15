/**
 * Loading Module - Gerenciamento de estados de carregamento
 * @module utils/loading
 */

export const Loading = {
    /**
     * Mostra indicador de carregamento
     * @param {string} message - Mensagem opcional
     */
    show(message = 'Carregando...') {
        const existing = document.getElementById('loading-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p class="loading-message">${message}</p>
            </div>
        `;
        document.body.appendChild(overlay);
    },

    /**
     * Esconde indicador de carregamento
     */
    hide() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.remove();
    },

    /**
     * Wrapper para funções assíncronas com loading
     * @param {Function} fn - Função assíncrona
     * @param {string} message - Mensagem de loading
     * @returns {Promise} Promise da função
     */
    async wrap(fn, message = 'Processando...') {
        this.show(message);
        try {
            const result = await fn();
            return result;
        } finally {
            this.hide();
        }
    }
};

export default Loading;
