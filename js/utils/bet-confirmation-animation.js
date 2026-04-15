/**
 * Loto Grana - Animação de Confirmação de Aposta
 * Simula o registro da aposta no sistema da Caixa Econômica Federal
 * @module utils/bet-confirmation-animation
 */

export const BetConfirmationAnimation = {
    isRunning: false,
    gamesCount: 1,
    
    // Retorna as etapas do processo de registro
    getSteps() {
        const plural = this.gamesCount > 1 ? 's' : '';
        return [
            {
                icon: 'wifi',
                title: 'Conectando ao servidor',
                description: 'Estabelecendo conexão segura com loterias.caixa.gov.br...',
                duration: 1500
            },
            {
                icon: 'shield-check',
                title: 'Verificando segurança',
                description: 'Validando certificado SSL/TLS...',
                duration: 1200
            },
            {
                icon: 'lock',
                title: 'Criptografando dados',
                description: `Aplicando criptografia AES-256 em ${this.gamesCount} jogo${plural}...`,
                duration: 1800
            },
            {
                icon: 'database',
                title: 'Registrando no sistema da CAIXA',
                description: `Gravando ${this.gamesCount} jogo${plural} no Sistema da Caixa Econômica Federal...`,
                duration: 2000
            },
            {
                icon: 'file-check',
                title: 'Emitindo comprovante',
                description: 'Gerando protocolo de confirmação...',
                duration: 1200
            }
        ];
    },
    
    // Inicia a animação
    start(betData, onComplete) {
        if (this.isRunning) return;
        this.isRunning = true;
        this.onComplete = onComplete;
        this.betData = betData;
        this.gamesCount = betData.gamesCount || 1;
        this.lotteryType = betData.lotteryType || 'lotofacil';
        this.contestNumber = betData.contestNumber || '---';
        
        this.createModal();
        this.runSteps();
    },
    
    // Retorna a URL da logo da Caixa
    getLotteryLogoUrl() {
        return 'assets/logo-caixa.png';
    },
    
    // Cria o modal
    createModal() {
        const existing = document.getElementById('bet-confirm-modal');
        if (existing) existing.remove();
        
        const protocolNumber = this.generateProtocol();
        const steps = this.getSteps();
        const plural = this.gamesCount > 1 ? 's' : '';
        
        const modal = document.createElement('div');
        modal.id = 'bet-confirm-modal';
        modal.className = 'bet-confirm-modal';
        modal.innerHTML = `
            <div class="bet-confirm-container">
                <div class="bet-confirm-logo-bar">
                    <img src="${this.getLotteryLogoUrl()}" alt="Loteria" />
                </div>
                <div class="bet-confirm-header">
                    <h3>Registrando seus jogos no sistema oficial da Caixa Econômica Federal</h3>
                    <p class="bet-confirm-subtitle">Concurso: <span class="highlight-number">${this.contestNumber}</span></p>
                    <p class="bet-confirm-subtitle">Quantidade de jogos: <span class="highlight-number">${this.gamesCount}</span></p>
                </div>
                
                <div class="bet-confirm-steps" id="bet-confirm-steps">
                    ${steps.map((step, index) => `
                        <div class="bet-confirm-step" id="bet-step-${index}">
                            <div class="step-icon-container">
                                <div class="step-icon">
                                    <i data-lucide="${step.icon}"></i>
                                </div>
                                <div class="step-check hidden">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </div>
                            </div>
                            <div class="step-content">
                                <span class="step-title">${step.title}</span>
                                <span class="step-description">${step.description}</span>
                            </div>
                            <div class="step-status">
                                <span class="status-waiting">Aguardando</span>
                                <span class="status-processing hidden">
                                    <span class="processing-dot"></span>
                                    <span class="processing-dot"></span>
                                    <span class="processing-dot"></span>
                                </span>
                                <span class="status-done hidden">Concluído</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="bet-confirm-progress">
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" id="bet-progress-bar"></div>
                    </div>
                    <span class="progress-text" id="bet-progress-text">0%</span>
                </div>
                
                <div class="bet-confirm-protocol hidden" id="bet-protocol">
                    <h4>Seus jogos foram registrados com sucesso</h4>
                    <p class="protocol-message">Concurso: <span class="highlight-number">${this.contestNumber}</span></p>
                    <p class="protocol-message">Quantidade de jogos: <span class="highlight-number">${this.gamesCount}</span></p>
                    <div class="protocol-number">
                        <span class="protocol-label">Protocolo:</span>
                        <span class="protocol-value">${protocolNumber}</span>
                    </div>
                    <div class="protocol-info">
                        <div class="protocol-item">
                            <i data-lucide="calendar"></i>
                            <span>${new Date().toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div class="protocol-item">
                            <i data-lucide="clock"></i>
                            <span>${new Date().toLocaleTimeString('pt-BR')}</span>
                        </div>
                    </div>
                    <button class="protocol-btn-view-bets" onclick="BetConfirmationAnimation.viewMyBets()">
                        <i data-lucide="ticket"></i>
                        VER RESULTADOS
                    </button>
                    <div class="protocol-security-badge">
                        <i data-lucide="shield-check"></i>
                        <span>Registro oficial garantido pela Caixa Econômica Federal</span>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },
    
    // Executa os passos sequencialmente
    runSteps() {
        let currentStep = 0;
        const steps = this.getSteps();
        const totalSteps = steps.length;
        
        const executeStep = () => {
            if (currentStep >= totalSteps) {
                this.complete();
                return;
            }
            
            const step = steps[currentStep];
            const stepEl = document.getElementById(`bet-step-${currentStep}`);
            
            if (stepEl) {
                stepEl.classList.add('active');
                stepEl.querySelector('.status-waiting').classList.add('hidden');
                stepEl.querySelector('.status-processing').classList.remove('hidden');
                
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }
            
            const progress = Math.round(((currentStep + 0.5) / totalSteps) * 100);
            this.updateProgress(progress);
            
            setTimeout(() => {
                if (stepEl) {
                    stepEl.classList.remove('active');
                    stepEl.classList.add('completed');
                    stepEl.querySelector('.status-processing').classList.add('hidden');
                    stepEl.querySelector('.status-done').classList.remove('hidden');
                    stepEl.querySelector('.step-icon').classList.add('hidden');
                    stepEl.querySelector('.step-check').classList.remove('hidden');
                }
                
                const finalProgress = Math.round(((currentStep + 1) / totalSteps) * 100);
                this.updateProgress(finalProgress);
                
                currentStep++;
                setTimeout(executeStep, 300);
            }, step.duration);
        };
        
        setTimeout(executeStep, 500);
    },
    
    // Atualiza barra de progresso
    updateProgress(percent) {
        const bar = document.getElementById('bet-progress-bar');
        const text = document.getElementById('bet-progress-text');
        
        if (bar) bar.style.width = percent + '%';
        if (text) text.textContent = percent + '%';
    },
    
    // Completa o processo
    complete() {
        const self = this; // Preserva referência ao objeto
        const stepsContainer = document.getElementById('bet-confirm-steps');
        const progressContainer = document.querySelector('.bet-confirm-progress');
        const protocolContainer = document.getElementById('bet-protocol');
        const header = document.querySelector('.bet-confirm-header');
        
        setTimeout(() => {
            if (stepsContainer) stepsContainer.classList.add('fade-out');
            if (progressContainer) progressContainer.classList.add('fade-out');
            if (header) header.classList.add('fade-out');
            
            setTimeout(() => {
                if (stepsContainer) stepsContainer.classList.add('hidden');
                if (progressContainer) progressContainer.classList.add('hidden');
                if (header) header.classList.add('hidden');
                
                if (protocolContainer) {
                    protocolContainer.classList.remove('hidden');
                    protocolContainer.classList.add('show');
                }
                
                if (navigator.vibrate) {
                    navigator.vibrate([100, 50, 100]);
                }
                
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
                
                if (typeof self.onComplete === 'function') {
                    self.onComplete();
                    self.onComplete = null;
                }
            }, 400);
        }, 500);
    },
    
    // Navega para "Meus Jogos"
    viewMyBets() {
        this.close();
        if (typeof window.showScreen === 'function') {
            window.showScreen('my-bets');
        }
    },
    
    // Fecha o modal
    close() {
        this.isRunning = false;
        const modal = document.getElementById('bet-confirm-modal');
        
        if (modal) {
            modal.classList.add('fade-out');
            setTimeout(() => {
                modal.remove();
            }, 400);
        }
    },
    
    // Gera número de protocolo falso
    generateProtocol() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 9000000) + 1000000;
        return `CEF${year}${month}${day}${random}`;
    }
};

export default BetConfirmationAnimation;
