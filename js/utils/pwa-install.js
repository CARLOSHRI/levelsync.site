/**
 * PWA Install Prompt - LotoGrana
 * Gerencia o prompt de instalação do app (Android/Chrome, desktop)
 * iOS: mostra instruções manuais (Add to Home Screen)
 */

const STORAGE_KEY = 'lotograna_pwa_install_dismissed';

let deferredPrompt = null;

export function initPwaInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        window.dispatchEvent(new CustomEvent('pwa-install-available'));
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
        window.dispatchEvent(new CustomEvent('pwa-installed'));
    });
}

export function canShowInstallPrompt() {
    return !!deferredPrompt;
}

export function wasInstallDismissed() {
    try {
        return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

export function dismissInstallPrompt() {
    try {
        localStorage.setItem(STORAGE_KEY, '1');
    } catch (_) {}
}

export async function showInstallPrompt() {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
        deferredPrompt = null;
    }
    return outcome === 'accepted';
}

export function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
}
