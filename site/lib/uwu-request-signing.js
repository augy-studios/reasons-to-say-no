/* Shared client-side request-signing helpers for UwU PWAs. */

const LS_KEY = 'uwu_signing_key';
const SS_KEY = 'uwu_signing_key';

function bufToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

async function hmacHex(keyStr, message) {
    const enc = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
        'raw', enc.encode(keyStr), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
    return bufToHex(sig);
}

function storeSigningKey(signingKey, keyId, persistent = false) {
    const data = JSON.stringify({ signingKey, keyId });
    if (persistent) {
        localStorage.setItem(LS_KEY, data);
        sessionStorage.removeItem(SS_KEY);
    } else {
        sessionStorage.setItem(SS_KEY, data);
        localStorage.removeItem(LS_KEY);
    }
}

function getSigningKey() {
    const fromLocal = localStorage.getItem(LS_KEY);
    if (fromLocal) {
        try {
            return JSON.parse(fromLocal);
        } catch {
            localStorage.removeItem(LS_KEY);
        }
    }
    const fromSession = sessionStorage.getItem(SS_KEY);
    if (fromSession) {
        try {
            return JSON.parse(fromSession);
        } catch {
            sessionStorage.removeItem(SS_KEY);
        }
    }
    return null;
}

function clearSigningKey() {
    localStorage.removeItem(LS_KEY);
    sessionStorage.removeItem(SS_KEY);
}

async function initGuestKey(appId) {
    if (getSigningKey()) return; // already have a key (guest or remembered login)
    try {
        const res = await fetch(`/api/auth/guest-key?app=${encodeURIComponent(appId)}`);
        const json = await res.json();
        if (res.ok && json.key_id && json.signing_key) {
            storeSigningKey(json.signing_key, json.key_id, false);
        }
    } catch (err) {
        console.warn('[uwu-request-signing] initGuestKey failed:', err);
    }
}

async function signedFetch(url, options = {}) {
    const keyData = getSigningKey();
    if (!keyData) {
        throw new Error('[uwu-request-signing] No signing key present - call initGuestKey() or log in first');
    }
    const { signingKey, keyId } = keyData;

    const method = (options.method || 'GET').toUpperCase();
    const path = new URL(url, window.location.origin).pathname;
    const ts = Date.now().toString();

    const bodyStr = options.body || '';
    const isEmptyBody = !bodyStr || bodyStr === '{}';
    const bodyHash = isEmptyBody ? 'empty' : await hmacHex(signingKey, bodyStr);

    const message = `${ts}:${method}:${path}:${bodyHash}`;
    const token = await hmacHex(signingKey, message);

    const headers = new Headers(options.headers || {});
    headers.set('X-Request-Token', token);
    headers.set('X-Request-TS', ts);
    headers.set('X-Key-ID', keyId);

    return fetch(url, { ...options, headers });
}

window.storeSigningKey = storeSigningKey;
window.getSigningKey = getSigningKey;
window.clearSigningKey = clearSigningKey;
window.initGuestKey = initGuestKey;
window.signedFetch = signedFetch;
