const {
    createClient
} = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
    // CORS headers — tighten origin in production if you wish
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    try {
        // 1. Get total count of reasons
        const {
            count,
            error: countErr
        } = await supabase
            .from('no_reasons')
            .select('*', {
                count: 'exact',
                head: true
            });

        if (countErr) throw countErr;
        if (!count || count === 0) {
            return res.status(404).json({
                success: false,
                error: 'No reasons found in database'
            });
        }

        // 2. Pick a random offset and fetch that single row
        const offset = Math.floor(Math.random() * count);

        const {
            data,
            error
        } = await supabase
            .from('no_reasons')
            .select('id, reason')
            .range(offset, offset)
            .single();

        if (error) throw error;

        return res.status(200).json({
            success: true,
            data
        });

    } catch (err) {
        console.error('[get-reason]', err.message || err);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};