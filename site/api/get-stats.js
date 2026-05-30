const {
    createClient
} = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

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

    try {
        const {
            data,
            error
        } = await supabase
            .from('no_stats')
            .select('platform, created_at');

        if (error) throw error;

        // Total stats
        const counts = {};
        for (const row of data) {
            counts[row.platform] = (counts[row.platform] || 0) + 1;
        }
        const totalStats = {
            total: data.length,
            webapp: counts.webapp || 0,
            telegram: counts.telegram || 0,
            discord: counts.discord || 0,
            api: counts.api || 0,
        };

        // All-time by platform, sorted descending
        const byPlatform = Object.entries(counts)
            .map(([platform, count]) => ({
                platform,
                count
            }))
            .sort((a, b) => b.count - a.count);

        // Last 7 days breakdown
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const dayMap = {};
        for (const row of data) {
            if (new Date(row.created_at) < since) continue;
            const day = row.created_at.slice(0, 10);
            if (!dayMap[day]) dayMap[day] = {};
            dayMap[day][row.platform] = (dayMap[day][row.platform] || 0) + 1;
        }
        const byDay = [];
        for (const day of Object.keys(dayMap).sort()) {
            for (const [platform, count] of Object.entries(dayMap[day])) {
                byDay.push({
                    day,
                    platform,
                    count
                });
            }
        }

        return res.status(200).json({
            success: true,
            data: {
                totalStats,
                byPlatform,
                byDay
            }
        });

    } catch (err) {
        console.error('[get-stats]', err.message || err);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};
