/**
 * Loto Grana - Animação de Sorteio IA
 * Visual amigável estilo sorteio de loteria
 * @module utils/hacking-animation
 */

export const HackingAnimation = {
    isRunning: false,
    currentStep: 0,
    totalGames: 0,
    generatedGames: 0,
    
    // Mensagens amigáveis durante o processo
    mensagens: [
        { texto: 'Preparando o sorteio...', detalhe: 'Iniciando a análise dos números' },
        { texto: 'Analisando estatísticas...', detalhe: 'Verificando os últimos resultados' },
        { texto: 'Calculando probabilidades...', detalhe: 'Nossa IA está trabalhando' },
        { texto: 'Selecionando os melhores números...', detalhe: 'Quase lá!' },
        { texto: 'Finalizando seus jogos...', detalhe: 'Preparando as combinações' }
    ],
    
    // Inicializa a animação
    start: function(lotteryId, onComplete, totalGames) {
        if (this.isRunning) return;
        this.isRunning = true;
        this.currentStep = 0;
        this.onComplete = onComplete;
        this.lotteryId = lotteryId;
        this.totalGames = totalGames || 5;
        this.generatedGames = 0;
        
        this.createModal();
        this.runAnimation();
    },
    
    // Cria o modal do sorteio
    createModal: function() {
        const existing = document.getElementById('hacking-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'hacking-modal';
        modal.className = `hacking-modal hk-${this.lotteryId}`;
        modal.innerHTML = `
            <div class="hacking-container">
                <!-- Header com Logo da IA -->
                <div class="sorteio-header">
                    <img src="assets/logo-ia.png" alt="Super IA" class="sorteio-ia-logo">
                    <h2 class="sorteio-title">Super IA Expert</h2>
                </div>
                
                
                <!-- Mensagem atual -->
                <div class="sorteio-mensagem">
                    <p class="mensagem-texto" id="mensagem-texto">Preparando o sorteio...</p>
                    <p class="mensagem-detalhe" id="mensagem-detalhe">Iniciando a análise dos números</p>
                </div>
                
                <!-- Barra de Progresso -->
                <div class="sorteio-progress-container">
                    <div class="sorteio-progress-label">
                        <span>Progresso</span>
                        <span id="progress-percent">0%</span>
                    </div>
                    <div class="sorteio-progress-bar">
                        <div class="sorteio-progress-fill" id="progress-fill" style="width: 0%"></div>
                    </div>
                </div>
                
                <!-- Contador de Jogos -->
                <div class="jogos-contador">
                    <div class="contador-item">
                        <div class="contador-numero" id="jogos-gerados">0</div>
                        <div class="contador-label">Jogos Gerados</div>
                    </div>
                    <div class="contador-divider"></div>
                    <div class="contador-item">
                        <div class="contador-numero" id="jogos-total">${this.totalGames}</div>
                        <div class="contador-label">Total</div>
                    </div>
                </div>
                
                <!-- Logo da loteria -->
                <img src="assets/${this.lotteryId}.png" alt="Loteria" class="sorteio-lottery-logo">
            </div>
        `;
        
        document.body.appendChild(modal);
    },
    
    // Executa a animação
    runAnimation: function() {
        const self = this;
        const totalDuration = 5000; // 5 segundos
        const stepDuration = totalDuration / this.mensagens.length;
        
        // Atualiza mensagens e progresso
        const updateStep = function(step) {
            if (!self.isRunning || step >= self.mensagens.length) {
                self.complete();
                return;
            }
            
            const msg = self.mensagens[step];
            const mensagemTexto = document.getElementById('mensagem-texto');
            const mensagemDetalhe = document.getElementById('mensagem-detalhe');
            
            if (mensagemTexto) mensagemTexto.textContent = msg.texto;
            if (mensagemDetalhe) mensagemDetalhe.textContent = msg.detalhe;
            
            self.currentStep = step;
            
            setTimeout(function() {
                updateStep(step + 1);
            }, stepDuration);
        };
        
        // Atualiza progresso continuamente
        const startTime = Date.now();
        const updateProgress = function() {
            if (!self.isRunning) return;
            
            const elapsed = Date.now() - startTime;
            const progress = Math.min(100, (elapsed / totalDuration) * 100);
            
            const progressFill = document.getElementById('progress-fill');
            const progressPercent = document.getElementById('progress-percent');
            
            if (progressFill) progressFill.style.width = progress + '%';
            if (progressPercent) progressPercent.textContent = Math.round(progress) + '%';
            
            // Atualiza contador de jogos gerados proporcionalmente
            const jogosGerados = Math.floor((progress / 100) * self.totalGames);
            const jogosEl = document.getElementById('jogos-gerados');
            if (jogosEl && jogosGerados !== self.generatedGames) {
                self.generatedGames = jogosGerados;
                jogosEl.textContent = jogosGerados;
            }
            
            if (progress < 100) {
                requestAnimationFrame(updateProgress);
            }
        };
        
        updateStep(0);
        updateProgress();
    },
    
    // Completa a animação
    complete: function() {
        const self = this;
        
        // Atualiza para 100%
        const progressFill = document.getElementById('progress-fill');
        const progressPercent = document.getElementById('progress-percent');
        const jogosEl = document.getElementById('jogos-gerados');
        
        if (progressFill) progressFill.style.width = '100%';
        if (progressPercent) progressPercent.textContent = '100%';
        if (jogosEl) jogosEl.textContent = this.totalGames;
        
        // Mostra mensagem de sucesso
        const mensagemTexto = document.getElementById('mensagem-texto');
        const mensagemDetalhe = document.getElementById('mensagem-detalhe');
        
        if (mensagemTexto) {
            mensagemTexto.textContent = 'Jogos gerados com sucesso!';
            mensagemTexto.style.color = '#28a745';
        }
        if (mensagemDetalhe) {
            mensagemDetalhe.textContent = 'Seus números da sorte estão prontos';
        }
        
        
        // Cria confetes
        this.createConfetti();
        
        // Aguarda e fecha
        setTimeout(function() {
            self.cleanup();
            if (typeof self.onComplete === 'function') {
                self.onComplete();
            }
        }, 1500);
    },
    
    // Cria efeito de confete
    createConfetti: function() {
        const container = document.createElement('div');
        container.className = 'confetti-container';
        
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF6B00'];
        
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 0.5 + 's';
            confetti.style.width = (Math.random() * 8 + 6) + 'px';
            confetti.style.height = (Math.random() * 8 + 6) + 'px';
            confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
            container.appendChild(confetti);
            
            setTimeout(function() {
                confetti.classList.add('active');
            }, 10);
        }
        
        document.body.appendChild(container);
        
        setTimeout(function() {
            container.remove();
        }, 3500);
    },
    
    // Limpa recursos
    cleanup: function() {
        this.isRunning = false;
        
        const modal = document.getElementById('hacking-modal');
        if (modal) {
            modal.classList.add('fade-out');
            setTimeout(function() {
                modal.remove();
            }, 500);
        }
    },
    
    // Força o fechamento
    forceClose: function() {
        this.cleanup();
    }
};

// Também exporta para uso global (compatibilidade)
if (typeof window !== 'undefined') {
    window.HackingAnimation = HackingAnimation;
}

export default HackingAnimation;
