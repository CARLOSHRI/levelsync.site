/**
 * Hot-Cold Numbers Module - Números quentes e frios
 * @module ui/hot-cold
 */

import { state } from '../core/state.js';
import { lotteries } from '../core/config.js';

/**
 * Gera e renderiza os números quentes e frios para a loteria
 * @param {string} lotteryId - ID da loteria
 */
export function renderHotColdNumbers(lotteryId) {
    const lottery = lotteries[lotteryId];
    if (!lottery) return;
    
    const hotContainer = document.getElementById('hot-numbers-balls');
    const coldContainer = document.getElementById('cold-numbers-balls');
    
    if (!hotContainer || !coldContainer) return;
    
    // Gera números "quentes" (mais sorteados - simulação)
    const hotNumbers = generateHotNumbers(lottery.maxNumber, 5);
    
    // Gera números "frios" (menos sorteados - simulação)
    const coldNumbers = generateColdNumbers(lottery.maxNumber, 5, hotNumbers);
    
    // Renderiza números quentes
    hotContainer.innerHTML = hotNumbers.map(num => `
        <div class="indicator-ball hot" onclick="selectHotColdNumber(${num})" title="Clique para selecionar">
            ${String(num).padStart(2, '0')}
        </div>
    `).join('');
    
    // Renderiza números frios
    coldContainer.innerHTML = coldNumbers.map(num => `
        <div class="indicator-ball cold" onclick="selectHotColdNumber(${num})" title="Clique para selecionar">
            ${String(num).padStart(2, '0')}
        </div>
    `).join('');
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Gera números "quentes" baseado em simulação estatística
 * @param {number} maxNumber - Número máximo
 * @param {number} count - Quantidade de números
 * @returns {Array} Array de números quentes
 */
export function generateHotNumbers(maxNumber, count) {
    const numbers = [];
    const used = new Set();
    
    const hotZones = [
        Math.floor(maxNumber * 0.2),
        Math.floor(maxNumber * 0.4),
        Math.floor(maxNumber * 0.6),
        Math.floor(maxNumber * 0.8),
        Math.floor(maxNumber * 0.5)
    ];
    
    while (numbers.length < count) {
        let num;
        if (numbers.length < hotZones.length && Math.random() > 0.3) {
            num = hotZones[numbers.length] + Math.floor(Math.random() * 5) - 2;
        } else {
            num = Math.floor(Math.random() * maxNumber) + 1;
        }
        
        num = Math.max(1, Math.min(maxNumber, num));
        
        if (!used.has(num)) {
            used.add(num);
            numbers.push(num);
        }
    }
    
    return numbers.sort((a, b) => a - b);
}

/**
 * Gera números "frios" baseado em simulação estatística
 * @param {number} maxNumber - Número máximo
 * @param {number} count - Quantidade de números
 * @param {Array} excludeNumbers - Números a excluir
 * @returns {Array} Array de números frios
 */
export function generateColdNumbers(maxNumber, count, excludeNumbers) {
    const numbers = [];
    const used = new Set(excludeNumbers);
    
    const coldZones = [
        Math.floor(maxNumber * 0.1),
        Math.floor(maxNumber * 0.9),
        Math.floor(maxNumber * 0.3),
        Math.floor(maxNumber * 0.7),
        Math.floor(maxNumber * 0.15)
    ];
    
    while (numbers.length < count) {
        let num;
        if (numbers.length < coldZones.length && Math.random() > 0.3) {
            num = coldZones[numbers.length] + Math.floor(Math.random() * 3) - 1;
        } else {
            num = Math.floor(Math.random() * maxNumber) + 1;
        }
        
        num = Math.max(1, Math.min(maxNumber, num));
        
        if (!used.has(num)) {
            used.add(num);
            numbers.push(num);
        }
    }
    
    return numbers.sort((a, b) => a - b);
}

/**
 * Seleciona um número quente/frio clicado
 * @param {number} number - Número selecionado
 */
export function selectHotColdNumber(number) {
    if (state.currentMode !== 'manual') return;
    
    const lottery = lotteries[state.currentLottery];
    if (!lottery) return;
    
    const idx = state.selectedNumbers.indexOf(number);
    
    if (idx === -1) {
        if (state.selectedNumbers.length < lottery.maxNumbers) {
            state.selectedNumbers.push(number);
            
            if (navigator.vibrate) {
                navigator.vibrate(30);
            }
        }
    } else {
        state.selectedNumbers.splice(idx, 1);
        
        if (navigator.vibrate) {
            navigator.vibrate(20);
        }
    }
    
    // Atualiza UI
    if (typeof window.updateSelectedNumbers === 'function') {
        window.updateSelectedNumbers();
    }
}

export default {
    renderHotColdNumbers,
    generateHotNumbers,
    generateColdNumbers,
    selectHotColdNumber
};
