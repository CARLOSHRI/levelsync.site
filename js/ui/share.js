/**
 * Share Module - Funcionalidades de compartilhamento
 * @module ui/share
 */

import { showToast } from './toasts.js';

/**
 * Compartilha um jogo via Web Share API ou clipboard
 * @param {string} lotteryName - Nome da loteria
 * @param {Array} numbers - Números do jogo
 * @param {boolean} isAI - Se foi gerado por IA
 */
export function shareGame(lotteryName, numbers, isAI = false) {
    const numbersFormatted = numbers.map(n => String(n).padStart(2, '0')).join(' - ');
    const aiText = isAI ? '\n🤖 Gerado por Super IA LotoGrana' : '';
    
    const shareText = `🍀 Meu jogo da ${lotteryName}!\n\n🔢 Números: ${numbersFormatted}${aiText}\n\n✨ Boa sorte! 🎰`;
    
    // Vibração de feedback
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }
    
    // Tenta usar Web Share API
    if (navigator.share) {
        navigator.share({
            title: `Jogo ${lotteryName} - LotoGrana`,
            text: shareText
        }).catch(err => {
            // Se falhar, copia para clipboard
            copyToClipboard(shareText);
        });
    } else {
        // Fallback: copia para clipboard
        copyToClipboard(shareText);
    }
}

/**
 * Copia texto para clipboard
 * @param {string} text - Texto a copiar
 */
export function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Jogo copiado para a área de transferência!', 'success');
        }).catch(() => {
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

/**
 * Fallback para copiar para clipboard em navegadores antigos
 * @param {string} text - Texto a copiar
 */
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
        document.execCommand('copy');
        showToast('Jogo copiado para a área de transferência!', 'success');
    } catch (err) {
        showToast('Não foi possível copiar o jogo', 'error');
    }
    
    document.body.removeChild(textArea);
}

/**
 * Copia código de afiliado
 */
export function copyCode() {
    const code = document.getElementById('affiliate-code')?.textContent;
    if (code) {
        navigator.clipboard.writeText(code).then(() => {
            showToast('Código copiado!', 'success');
        }).catch(() => {
            showToast('Erro ao copiar', 'error');
        });
    }
}

/**
 * Compartilha código de afiliado
 */
export function shareCode() {
    const code = document.getElementById('affiliate-code')?.textContent;
    if (navigator.share) {
        navigator.share({
            title: 'Loto Grana',
            text: `Use meu código ${code} e ganhe R$ 10,00 de bônus!`,
            url: window.location.href
        });
    } else {
        copyCode();
    }
}

export default {
    shareGame,
    copyToClipboard,
    copyCode,
    shareCode
};
