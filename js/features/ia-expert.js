/**
 * IA Expert Module - Funcionalidades da IA Expert
 * @module features/ia-expert
 */

import { state } from '../core/state.js';
import { lotteries } from '../core/config.js';
import { ErrorHandler } from '../utils/errors.js';
import { HackingAnimation } from '../utils/hacking-animation.js';
import { Loading } from '../utils/loading.js';
import { openBetting, generateAINumbers, prepareAutoBets } from './betting.js';

/**
 * Abre o modal de IA Expert
 */
export function openIAExpertModal() {
    window.iaExpertSource = 'quick-access';
    const modal = document.getElementById('ia-modal');
    const selectScreen = document.getElementById('ia-lottery-select');
    const processingScreen = document.getElementById('ia-processing');
    
    if (modal) modal.classList.remove('hidden');
    if (selectScreen) selectScreen.classList.remove('hidden');
    if (processingScreen) processingScreen.classList.add('hidden');
}

/**
 * Fecha o modal de IA
 */
export function closeIAModal() {
    const modal = document.getElementById('ia-modal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Inicia a geração de números com IA Expert
 * @param {string} lotteryId - ID da loteria
 */
export function startIAExpert(lotteryId) {
    closeIAModal();
    
    if (HackingAnimation) {
        HackingAnimation.start(lotteryId, () => {
            openBetting(lotteryId, 'ai');
            generateAINumbers();
        }, state.gamesToGenerate || 5);
    } else {
        runIAProcessingAnimation(lotteryId);
    }
}

/**
 * Inicia a geração automática com IA
 * @param {string} lotteryId - ID da loteria
 * @param {number} count - Quantidade de jogos
 */
export function startIAAutoGeneration(lotteryId, count) {
    return ErrorHandler.wrapSync(() => {
        if (HackingAnimation) {
            HackingAnimation.start(lotteryId, () => {
                prepareAutoBets(lotteryId, 'ai', count);
            }, count);
        } else {
            const modal = document.getElementById('ia-modal');
            const selectScreen = document.getElementById('ia-lottery-select');
            const processingScreen = document.getElementById('ia-processing');
            const logoImg = document.getElementById('ia-selected-logo');

            if (modal) modal.classList.remove('hidden');
            if (selectScreen) selectScreen.classList.add('hidden');
            if (processingScreen) processingScreen.classList.remove('hidden');

            const logoPath = `assets/${lotteryId}.png`;
            if (logoImg) logoImg.src = logoPath;

            Loading.show('Gerando números com IA...');
            
            runIAProcessingAnimationForBetting(lotteryId, () => {
                Loading.hide();
                prepareAutoBets(lotteryId, 'ai', count);
            });
        }
    }, 'startIAAutoGeneration');
}

/**
 * Mostra confirmação de geração com IA
 * @param {string} lotteryId - ID da loteria
 */
export function showIAConfirmation(lotteryId) {
    const modal = document.createElement('div');
    modal.className = 'ia-confirmation-modal';
    modal.innerHTML = `
        <div class="ia-confirmation-content">
            <div class="ia-confirmation-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 3l1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5L12 3z"></path>
                    <path d="M5 16l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"></path>
                    <path d="M19 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"></path>
                </svg>
            </div>
            <h3>Super Inteligência Artificial</h3>
            <p>Deseja gerar os números usando nossa Super IA?</p>
            <p class="ia-confirmation-sub">Nossa IA analisará milhares de concursos anteriores para selecionar os números com maior probabilidade de ganho.</p>
            <div class="ia-confirmation-buttons">
                <button class="btn-cancel" onclick="cancelIAConfirmation()">Cancelar</button>
                <button class="btn-confirm" onclick="confirmIAGeneration('${lotteryId}')">Gerar com IA</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

/**
 * Cancela confirmação de IA
 */
export function cancelIAConfirmation() {
    document.querySelector('.ia-confirmation-modal')?.remove();
    if (typeof window.setMode === 'function') {
        window.setMode('manual');
    }
}

/**
 * Confirma geração com IA
 * @param {string} lotteryId - ID da loteria
 */
export function confirmIAGeneration(lotteryId) {
    document.querySelector('.ia-confirmation-modal')?.remove();
    
    if (HackingAnimation) {
        HackingAnimation.start(lotteryId, () => {
            generateAINumbers();
        }, state.gamesToGenerate || 5);
    } else {
        const modal = document.getElementById('ia-modal');
        const selectScreen = document.getElementById('ia-lottery-select');
        const processingScreen = document.getElementById('ia-processing');
        const logoImg = document.getElementById('ia-selected-logo');
        
        if (modal) modal.classList.remove('hidden');
        if (selectScreen) selectScreen.classList.add('hidden');
        if (processingScreen) processingScreen.classList.remove('hidden');
        
        const logoPath = `assets/${lotteryId}.png`;
        if (logoImg) logoImg.src = logoPath;
        
        runIAProcessingAnimationForBetting(lotteryId);
    }
}

/**
 * Executa animação de processamento da IA
 * @param {string} lotteryId - ID da loteria
 */
export function runIAProcessingAnimation(lotteryId) {
    const tasksContainer = document.getElementById('ia-tasks-container');
    
    const tasks = [
        { name: 'Conectando ao banco de dados', duration: 800 },
        { name: 'Carregando histórico de concursos', duration: 1000 },
        { name: 'Analisando padrões estatísticos', duration: 1200 },
        { name: 'Processando machine learning', duration: 1000 },
        { name: 'Identificando números quentes', duration: 800 },
        { name: 'Calculando probabilidades', duration: 1000 },
        { name: 'Otimizando combinações', duration: 800 },
        { name: 'Gerando números finais', duration: 600 }
    ];
    
    if (tasksContainer) tasksContainer.innerHTML = '';
    
    tasks.forEach((task, index) => {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'ia-task';
        taskDiv.id = `ia-task-${index}`;
        taskDiv.innerHTML = `
            <div class="ia-task-header">
                <span class="ia-task-name">${task.name}</span>
                <span class="ia-task-status" id="ia-task-status-${index}">Aguardando...</span>
            </div>
            <div class="ia-task-progress">
                <div class="ia-task-progress-bar" id="ia-task-bar-${index}"></div>
            </div>
        `;
        if (tasksContainer) tasksContainer.appendChild(taskDiv);
    });
    
    let currentTaskIndex = 0;
    
    const executeNextTask = () => {
        if (currentTaskIndex < tasks.length) {
            const task = tasks[currentTaskIndex];
            const taskEl = document.getElementById(`ia-task-${currentTaskIndex}`);
            const statusEl = document.getElementById(`ia-task-status-${currentTaskIndex}`);
            const progressBar = document.getElementById(`ia-task-bar-${currentTaskIndex}`);
            
            if (taskEl) taskEl.classList.add('active');
            
            let progress = 0;
            const interval = task.duration / 20;
            
            const progressInterval = setInterval(() => {
                progress += 5;
                if (progress > 100) progress = 100;
                
                if (progressBar) progressBar.style.width = progress + '%';
                
                if (progress >= 100) {
                    clearInterval(progressInterval);
                    if (taskEl) {
                        taskEl.classList.remove('active');
                        taskEl.classList.add('completed');
                    }
                    if (statusEl) {
                        statusEl.textContent = 'Concluído';
                        statusEl.classList.add('completed');
                    }
                    
                    currentTaskIndex++;
                    setTimeout(executeNextTask, 200);
                }
            }, interval);
        } else {
            setTimeout(() => {
                const completionMsg = document.createElement('div');
                completionMsg.className = 'ia-completion-message';
                completionMsg.textContent = '✓ Análise Concluída! Números Gerados com Sucesso';
                if (tasksContainer) tasksContainer.appendChild(completionMsg);
                
                setTimeout(() => {
                    closeIAModal();
                    openBetting(lotteryId, 'ai');
                    generateAINumbers();
                }, 1200);
            }, 300);
        }
    };
    
    executeNextTask();
}

/**
 * Executa animação de processamento da IA para apostas
 * @param {string} lotteryId - ID da loteria
 * @param {Function} onComplete - Callback de conclusão
 */
export function runIAProcessingAnimationForBetting(lotteryId, onComplete) {
    const tasksContainer = document.getElementById('ia-tasks-container');
    
    const tasks = [
        { name: 'Conectando ao banco de dados', duration: 800 },
        { name: 'Carregando histórico de concursos', duration: 1000 },
        { name: 'Analisando padrões estatísticos', duration: 1200 },
        { name: 'Processando machine learning', duration: 1000 },
        { name: 'Identificando números quentes', duration: 800 },
        { name: 'Calculando probabilidades', duration: 1000 },
        { name: 'Otimizando combinações', duration: 800 },
        { name: 'Gerando números finais', duration: 600 }
    ];
    
    if (tasksContainer) tasksContainer.innerHTML = '';
    
    tasks.forEach((task, index) => {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'ia-task';
        taskDiv.id = `ia-task-${index}`;
        taskDiv.innerHTML = `
            <div class="ia-task-header">
                <span class="ia-task-name">${task.name}</span>
                <span class="ia-task-status" id="ia-task-status-${index}">Aguardando...</span>
            </div>
            <div class="ia-task-progress">
                <div class="ia-task-progress-bar" id="ia-task-bar-${index}"></div>
            </div>
        `;
        if (tasksContainer) tasksContainer.appendChild(taskDiv);
    });
    
    let currentTaskIndex = 0;
    
    const executeNextTask = () => {
        if (currentTaskIndex < tasks.length) {
            const task = tasks[currentTaskIndex];
            const taskEl = document.getElementById(`ia-task-${currentTaskIndex}`);
            const statusEl = document.getElementById(`ia-task-status-${currentTaskIndex}`);
            const progressBar = document.getElementById(`ia-task-bar-${currentTaskIndex}`);
            
            if (taskEl) taskEl.classList.add('active');
            
            let progress = 0;
            const interval = task.duration / 20;
            
            const progressInterval = setInterval(() => {
                progress += 5;
                if (progress > 100) progress = 100;
                
                if (progressBar) progressBar.style.width = progress + '%';
                
                if (progress >= 100) {
                    clearInterval(progressInterval);
                    if (taskEl) {
                        taskEl.classList.remove('active');
                        taskEl.classList.add('completed');
                    }
                    if (statusEl) {
                        statusEl.textContent = 'Concluído';
                        statusEl.classList.add('completed');
                    }
                    
                    currentTaskIndex++;
                    setTimeout(executeNextTask, 200);
                }
            }, interval);
        } else {
            setTimeout(() => {
                const completionMsg = document.createElement('div');
                completionMsg.className = 'ia-completion-message';
                completionMsg.textContent = '✓ Análise Concluída! Números Gerados com Sucesso';
                if (tasksContainer) tasksContainer.appendChild(completionMsg);
                
                setTimeout(() => {
                    closeIAModal();
                    if (typeof onComplete === 'function') {
                        onComplete();
                    } else {
                        generateAINumbers();
                    }
                }, 1200);
            }, 300);
        }
    };
    
    executeNextTask();
}

export default {
    openIAExpertModal,
    closeIAModal,
    startIAExpert,
    startIAAutoGeneration,
    showIAConfirmation,
    cancelIAConfirmation,
    confirmIAGeneration,
    runIAProcessingAnimation,
    runIAProcessingAnimationForBetting
};
