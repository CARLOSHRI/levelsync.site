/**
 * LotoGrana - Push Notifications
 * Solicita permissão, subscreve e envia subscription para a API
 */

const API_BASE = 'api';

export async function getVapidPublicKey() {
    const res = await fetch(`${API_BASE}/notifications/vapid-public.php`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'VAPID não configurado');
    return data.publicKey;
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export async function subscribePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return false;
    }
    if (Notification.permission === 'denied') return false;
    if (Notification.permission === 'granted') {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) return true;
    }
    const key = await getVapidPublicKey();
    if (!key) return false;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key)
    });
    const json = sub.toJSON();
    const token = localStorage.getItem('lotograna_token');
    if (!token) return false;
    await fetch(`${API_BASE}/notifications/subscribe.php`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            endpoint: json.endpoint,
            keys: json.keys
        })
    });
    return true;
}

export async function requestPushPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') {
        return subscribePush();
    }
    if (Notification.permission === 'denied') return false;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return false;
    return subscribePush();
}

export function isPushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
