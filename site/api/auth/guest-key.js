const crypto = require('node:crypto');
const {
    createClient
} = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const GUEST_TTL_MS = 10 * 60 * 1000;

function isAllowedOrigin(origin) {
    if (!origin) return true; // same-origin fetches often omit Origin entirely
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
    return allowed.includes(origin);
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    if (!isAllowedOrigin(req.headers.origin)) {
        return res.status(403).json({
            success: false,
            error: 'Origin not allowed'
        });
    }

    try {
        const appId = (req.query && req.query.app) || 'unknown';
        const sessionToken = crypto.randomUUID();
        const signingKey = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + GUEST_TTL_MS).toISOString();

        const {
            error
        } = await supabase
            .from('uwu_signing_keys')
            .insert({
                session_token: sessionToken,
                signing_key: signingKey,
                is_guest: true,
                app_id: appId,
                expires_at: expiresAt
            });

        if (error) throw error;

        return res.status(200).json({
            key_id: sessionToken,
            signing_key: signingKey
        });

    } catch (err) {
        console.error('[guest-key]', err.message || err);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};
