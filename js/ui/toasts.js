/**
 * Toasts Module - Notificações toast redesenhadas
 * @module ui/toasts
 */

/**
 * Exibe uma notificação toast moderna
 * @param {string} message - Mensagem a exibir
 * @param {string} type - Tipo (info, success, error, warning)
 * @param {number} duration - Duração em ms (padrão 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
    // Remove toast existente
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Define ícone baseado no tipo
    const icons = {
        success: 'check-circle',
        error: 'x-circle',
        warning: 'alert-triangle',
        info: 'info'
    };
    
    // Define títulos baseado no tipo
    const titles = {
        success: 'Sucesso!',
        error: 'Erro!',
        warning: 'Atenção!',
        info: 'Informação'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon-wrapper">
            <i data-lucide="${icons[type] || 'info'}"></i>
        </div>
        <div class="toast-content">
            <span class="toast-title">${titles[type] || 'Informação'}</span>
            <span class="toast-message">${message}</span>
        </div>
        <div class="toast-progress">
            <div class="toast-progress-bar"></div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i data-lucide="x"></i>
        </button>
    `;
    
    document.body.appendChild(toast);
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // Anima entrada
    setTimeout(() => toast.classList.add('visible'), 10);
    
    // Anima barra de progresso
    const progressBar = toast.querySelector('.toast-progress-bar');
    if (progressBar) {
        progressBar.style.transition = `width ${duration}ms linear`;
        setTimeout(() => {
            progressBar.style.width = '0%';
        }, 50);
    }
    
    // Remove após duração
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

export default showToast;
