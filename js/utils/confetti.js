/**
 * Confetti Animation Module
 * Animação de confetti para celebrar vitórias
 * @module utils/confetti
 */

export const ConfettiAnimation = {
    isRunning: false,
    particles: [],
    canvas: null,
    ctx: null,
    animationId: null,

    colors: [
        '#FFD700', // Gold
        '#00D4FF', // Cyan
        '#7C3AED', // Purple
        '#00FF88', // Green
        '#FF6B6B', // Red
        '#FFE66D', // Yellow
        '#4ECDC4', // Teal
        '#FF8C00', // Orange
        '#FF1493', // Pink
        '#00BFFF'  // Deep Sky Blue
    ],

    /**
     * Inicia a animação de confetti
     */
    start(duration = 4000) {
        if (this.isRunning) return;
        this.isRunning = true;

        // Criar canvas
        this.createCanvas();

        // Criar partículas
        this.createParticles(150);

        // Vibração de celebração
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 200]);
        }

        // Iniciar animação
        this.animate();

        // Parar após duração
        setTimeout(() => {
            this.stop();
        }, duration);
    },

    /**
     * Cria o canvas para a animação
     */
    createCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'confetti-canvas';
        this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 99999;
        `;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
    },

    /**
     * Cria as partículas de confetti
     */
    createParticles(count) {
        this.particles = [];
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height - this.canvas.height,
                vx: (Math.random() - 0.5) * 8,
                vy: Math.random() * 3 + 2,
                color: this.colors[Math.floor(Math.random() * this.colors.length)],
                size: Math.random() * 10 + 5,
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 10,
                shape: Math.random() > 0.5 ? 'rect' : 'circle',
                opacity: 1,
                wobble: Math.random() * 10,
                wobbleSpeed: Math.random() * 0.1 + 0.05
            });
        }
    },

    /**
     * Loop de animação
     */
    animate() {
        if (!this.isRunning) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        let activeParticles = 0;

        this.particles.forEach((p) => {
            // Atualizar posição
            p.x += p.vx + Math.sin(p.wobble) * 2;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;
            p.wobble += p.wobbleSpeed;

            // Gravidade
            p.vy += 0.05;

            // Resistência do ar
            p.vx *= 0.99;

            // Fade out quando sair da tela
            if (p.y > this.canvas.height - 100) {
                p.opacity -= 0.02;
            }

            // Desenhar se ainda visível
            if (p.opacity > 0 && p.y < this.canvas.height + 50) {
                activeParticles++;
                this.ctx.save();
                this.ctx.translate(p.x, p.y);
                this.ctx.rotate(p.rotation * Math.PI / 180);
                this.ctx.globalAlpha = p.opacity;
                this.ctx.fillStyle = p.color;

                if (p.shape === 'rect') {
                    this.ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
                } else {
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                    this.ctx.fill();
                }

                this.ctx.restore();
            }
        });

        // Continuar animação se houver partículas ativas
        if (activeParticles > 0 && this.isRunning) {
            this.animationId = requestAnimationFrame(() => this.animate());
        } else {
            this.stop();
        }
    },

    /**
     * Para a animação
     */
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
    },

    /**
     * Efeito de explosão de confetti (burst)
     */
    burst(x, y, count = 50) {
        if (!this.canvas) {
            this.createCanvas();
            this.isRunning = true;
        }

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 10 + 5;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 5,
                color: this.colors[Math.floor(Math.random() * this.colors.length)],
                size: Math.random() * 8 + 4,
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 15,
                shape: Math.random() > 0.5 ? 'rect' : 'circle',
                opacity: 1,
                wobble: Math.random() * 10,
                wobbleSpeed: Math.random() * 0.1 + 0.05
            });
        }

        if (!this.animationId) {
            this.animate();
        }

        // Vibração
        if (navigator.vibrate) {
            navigator.vibrate([50, 30, 50]);
        }

        // Auto-stop
        setTimeout(() => {
            if (this.particles.length === 0) {
                this.stop();
            }
        }, 3000);
    },

    /**
     * Rain de confetti do topo da tela
     */
    rain(duration = 3000) {
        if (!this.canvas) {
            this.createCanvas();
            this.isRunning = true;
        }

        const interval = setInterval(() => {
            for (let i = 0; i < 5; i++) {
                this.particles.push({
                    x: Math.random() * this.canvas.width,
                    y: -20,
                    vx: (Math.random() - 0.5) * 3,
                    vy: Math.random() * 2 + 3,
                    color: this.colors[Math.floor(Math.random() * this.colors.length)],
                    size: Math.random() * 8 + 4,
                    rotation: Math.random() * 360,
                    rotationSpeed: (Math.random() - 0.5) * 8,
                    shape: Math.random() > 0.5 ? 'rect' : 'circle',
                    opacity: 1,
                    wobble: Math.random() * 10,
                    wobbleSpeed: Math.random() * 0.1 + 0.05
                });
            }
        }, 50);

        if (!this.animationId) {
            this.animate();
        }

        setTimeout(() => {
            clearInterval(interval);
            setTimeout(() => this.stop(), 2000);
        }, duration);
    }
};

export default ConfettiAnimation;
