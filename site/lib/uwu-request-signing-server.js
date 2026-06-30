/* Shared server-side request-signing verification for UwU PWAs. */

const crypto = require('node:crypto');

const TS_TOLERANCE_MS = 30 * 1000;

function hmacHex(keyStr, message) {
    return crypto.createHmac('sha256', keyStr).update(message).digest('hex');
}

function constantTimeEqual(a, b) {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

function getRequestPath(req) {
    return new URL(req.url, 'http://localhost').pathname;
}

// Vercel sets req.body = {} for GET/DELETE even with no body sent - treat that the same as no body.
function getBodyString(req) {
    if (!req.body) return null;
    const str = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!str || str === '{}') return null;
    return str;
}

async function verifySignedRequest(req, supabase) {
    const token = req.headers['x-request-token'];
    const ts = req.headers['x-request-ts'];
    let keyId = req.headers['x-key-id'];

    if (!keyId) {
        const auth = req.headers['authorization'];
        if (auth && auth.startsWith('Bearer ')) keyId = auth.slice(7).trim();
    }

    if (!token || !ts || !keyId) {
        return { valid: false, reason: 'Missing signing headers' };
    }

    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > TS_TOLERANCE_MS) {
        return { valid: false, reason: 'Timestamp out of range' };
    }

    const { data: keyRow, error: keyErr } = await supabase
        .from('uwu_signing_keys')
        .select('signing_key, expires_at')
        .eq('session_token', keyId)
        .single();

    if (keyErr || !keyRow) {
        return { valid: false, reason: 'Unknown signing key' };
    }

    if (new Date(keyRow.expires_at).getTime() < Date.now()) {
        return { valid: false, reason: 'Signing key expired' };
    }

    const method = req.method.toUpperCase();
    const path = getRequestPath(req);
    const bodyStr = getBodyString(req);
    const bodyHash = bodyStr ? hmacHex(keyRow.signing_key, bodyStr) : 'empty';
    const message = `${ts}:${method}:${path}:${bodyHash}`;
    const expectedToken = hmacHex(keyRow.signing_key, message);

    if (!constantTimeEqual(token, expectedToken)) {
        return { valid: false, reason: 'Invalid signature' };
    }

    const { data: usedRow } = await supabase
        .from('uwu_used_request_tokens')
        .select('token')
        .eq('token', token)
        .maybeSingle();

    if (usedRow) {
        return { valid: false, reason: 'Replayed token' };
    }

    const { error: insertErr } = await supabase
        .from('uwu_used_request_tokens')
        .insert({ token, session_token: keyId, used_at: new Date().toISOString() });

    if (insertErr) {
        // unique violation on a concurrent duplicate insert is itself a replay
        if (insertErr.code === '23505') return { valid: false, reason: 'Replayed token' };
        return { valid: false, reason: 'Could not record token' };
    }

    return { valid: true, reason: 'ok' };
}

module.exports = { verifySignedRequest };
