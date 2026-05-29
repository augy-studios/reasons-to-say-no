const {
    createClient
} = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const VALID_PLATFORMS = new Set(['webapp', 'telegram', 'discord']);

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    try {
        const {
            platform
        } = req.body || {};

        if (!platform || !VALID_PLATFORMS.has(platform)) {
            return res.status(400).json({
                success: false,
                error: `Invalid platform. Must be one of: ${[...VALID_PLATFORMS].join(', ')}`,
            });
        }

        const {
            error
        } = await supabase
            .from('no_stats')
            .insert({
                platform
            });

        if (error) throw error;

        return res.status(200).json({
            success: true
        });

    } catch (err) {
        console.error('[track-stat]', err.message || err);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};