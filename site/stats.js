/* -- PLATFORM CONFIG -- */

const PLATFORMS = {
    webapp: {
        label: 'Web App',
        color: '#2e7d32'
    },
    telegram: {
        label: 'Telegram',
        color: '#1565c0'
    },
    discord: {
        label: 'Discord',
        color: '#6a1b9a'
    },
    api: {
        label: 'API',
        color: '#00838f'
    },
};

/* -- STORAGE KEYS -- */

const KEY_FAVS = 'rtsn_favourites';

/* -- DOM REFS -- */

const toastContainer = document.getElementById('toastContainer');

const favouritesNavBtn = document.getElementById('favouritesNavBtn');
const favouritesModal = document.getElementById('favouritesModal');
const favouritesList = document.getElementById('favouritesList');
const favBadge = document.getElementById('favBadge');

const statsSummary = document.getElementById('statsSummary');
const chartsGrid = document.getElementById('chartsGrid');

/* -- CHART COLOURS -- */

// Chart.js paints to canvas, so it cannot use CSS variables. Resolve the
// theme tokens at build time so charts stay readable in both modes.
function chartColours() {
    const css = getComputedStyle(document.documentElement);
    const read = name => css.getPropertyValue(name).trim();
    const ink = read('--ink');
    const n = parseInt(ink.replace('#', ''), 16);
    const inkRgb = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
    return {
        ink,
        muted: read('--muted'),
        border: read('--surface-border'),
        grid: `rgba(${inkRgb}, 0.10)`,
        segment: `rgba(${inkRgb}, 0.18)`,
    };
}

/* -- FAVOURITES -- */

function getFavourites() {
    try {
        return JSON.parse(localStorage.getItem(KEY_FAVS) || '[]');
    } catch {
        return [];
    }
}

function saveFavourites(favs) {
    localStorage.setItem(KEY_FAVS, JSON.stringify(favs));
    refreshFavBadge();
}

function refreshFavBadge() {
    const count = getFavourites().length;
    if (count > 0) {
        favBadge.textContent = count;
        favBadge.classList.add('show');
        favBadge.setAttribute('aria-label', `${count} favourite${count !== 1 ? 's' : ''}`);
    } else {
        favBadge.textContent = '';
        favBadge.classList.remove('show');
        favBadge.setAttribute('aria-label', 'No favourites');
    }
}

function renderFavourites() {
    const favs = getFavourites();

    if (favs.length === 0) {
        favouritesList.innerHTML =
            '<p class="empty-state">No favourites yet.<br>Star a reason to save it here!</p>';
        return;
    }

    const itemsHtml = favs.map((fav, i) => `
    <div class="fav-item" role="listitem">
      <p class="fav-text">${escapeHtml(fav.reason)}</p>
      <div class="fav-actions">
        <button class="fav-btn" data-action="copy" data-index="${i}" title="Copy to clipboard" aria-label="Copy reason to clipboard">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
        <button class="fav-btn danger" data-action="remove" data-index="${i}" title="Remove from favourites" aria-label="Remove from favourites">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

    const clearHtml = `
    <div class="fav-clear-row">
      <button class="fav-clear-btn" id="clearAllFavsBtn" aria-label="Clear all favourites">Clear all</button>
    </div>
  `;

    favouritesList.innerHTML = itemsHtml + clearHtml;

    favouritesList.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            if (btn.dataset.action === 'copy') copyFavourite(idx);
            if (btn.dataset.action === 'remove') removeFavourite(idx);
        });
    });

    const clearBtn = document.getElementById('clearAllFavsBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearAllFavourites);
}

function copyFavourite(index) {
    const fav = getFavourites()[index];
    if (!fav) return;
    navigator.clipboard.writeText(fav.reason)
        .then(() => showToast('Copied to clipboard'))
        .catch(() => showToast('Copy failed - try again'));
}

function removeFavourite(index) {
    const favs = getFavourites();
    if (!favs[index]) return;
    favs.splice(index, 1);
    saveFavourites(favs);
    renderFavourites();
    showToast('Removed from favourites');
}

function clearAllFavourites() {
    if (!confirm('Clear all favourites? This cannot be undone.')) return;
    saveFavourites([]);
    renderFavourites();
    showToast('All favourites cleared');
}

/* -- TOAST -- */

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add('show'));
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 220);
    }, 2400);
}

/* -- UTILS -- */

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatNumber(n) {
    return n.toLocaleString();
}

function getLast7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
    }
    return days;
}

function formatDayLabel(isoDate) {
    const [, month, day] = isoDate.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}`;
}

/* -- STATS RENDERING -- */

function renderSummaryCards(totalStats) {
    const cards = [{
            key: 'total',
            label: 'Total Uses',
            value: totalStats.total,
            dot: null
        },
        {
            key: 'webapp',
            label: 'Web App',
            value: totalStats.webapp,
            dot: PLATFORMS.webapp.color
        },
        {
            key: 'telegram',
            label: 'Telegram',
            value: totalStats.telegram,
            dot: PLATFORMS.telegram.color
        },
        {
            key: 'discord',
            label: 'Discord',
            value: totalStats.discord,
            dot: PLATFORMS.discord.color
        },
        {
            key: 'api',
            label: 'API',
            value: totalStats.api,
            dot: PLATFORMS.api.color
        },
    ];

    statsSummary.innerHTML = cards.map(c => `
    <div class="stat-card glass">
      ${c.dot ? `<span class="stat-dot" style="background:${c.dot}" aria-hidden="true"></span>` : ''}
      <span class="stat-value">${formatNumber(c.value)}</span>
      <span class="stat-label">${c.label}</span>
    </div>
  `).join('');
}

function renderPieChart(byPlatform) {
    const ctx = document.getElementById('pieChart');
    if (!ctx) return;

    const filtered = byPlatform.filter(p => PLATFORMS[p.platform]);
    if (filtered.length === 0) {
        ctx.parentElement.innerHTML = '<p class="stats-error">No data yet.</p>';
        return;
    }

    const c = chartColours();

    new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: filtered.map(p => PLATFORMS[p.platform].label),
            datasets: [{
                data: filtered.map(p => p.count),
                backgroundColor: filtered.map(p => PLATFORMS[p.platform].color),
                borderWidth: 3,
                borderColor: c.segment,
                hoverBorderColor: c.border,
                hoverOffset: 6,
            }]
        },
        options: {
            cutout: '60%',
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            family: 'Jua',
                            size: 12
                        },
                        color: c.ink,
                        padding: 16,
                        usePointStyle: true,
                        pointStyleWidth: 10,
                    }
                },
                tooltip: {
                    callbacks: {
                        label(ctx) {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0.0';
                            return ` ${ctx.label}: ${ctx.parsed.toLocaleString()} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderBarChart(byDay) {
    const ctx = document.getElementById('barChart');
    if (!ctx) return;

    const last7 = getLast7Days();

    function getCount(day, platform) {
        const entry = byDay.find(r => r.day === day && r.platform === platform);
        return entry ? entry.count : 0;
    }

    const c = chartColours();

    const datasets = Object.entries(PLATFORMS).map(([key, p]) => ({
        label: p.label,
        data: last7.map(day => getCount(day, key)),
        backgroundColor: p.color,
        borderRadius: 3,
        borderSkipped: false,
    }));

    new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: last7.map(formatDayLabel),
            datasets,
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        display: false
                    },
                    border: {
                        display: false
                    },
                    ticks: {
                        font: {
                            family: 'Jua',
                            size: 11
                        },
                        color: c.muted,
                    }
                },
                y: {
                    stacked: true,
                    grid: {
                        color: c.grid
                    },
                    border: {
                        display: false,
                        dash: [4, 4]
                    },
                    ticks: {
                        font: {
                            family: 'Jua',
                            size: 11
                        },
                        color: c.muted,
                        precision: 0,
                        maxTicksLimit: 6,
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            family: 'Jua',
                            size: 12
                        },
                        color: c.ink,
                        padding: 16,
                        usePointStyle: true,
                        pointStyleWidth: 10,
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label(ctx) {
                            if (ctx.parsed.y === 0) return null;
                            return ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}`;
                        }
                    }
                }
            }
        }
    });
}

function showChartsError(message) {
    chartsGrid.innerHTML = `<p class="stats-error">${escapeHtml(message)}<br><br><a href="/stats">Reload page</a></p>`;
}

/* -- FETCH STATS -- */

async function loadStats() {
    try {
        const res = await signedFetch('/api/get-stats');
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Server error');

        const {
            totalStats,
            byPlatform,
            byDay
        } = json.data;

        renderSummaryCards(totalStats);
        renderPieChart(byPlatform);
        renderBarChart(byDay);
    } catch (err) {
        console.error('[stats]', err);
        statsSummary.innerHTML = '';
        showChartsError('Could not load stats. Check your connection and try again.');
    }
}

/* -- EVENT LISTENERS -- */

// Theme button and close/backdrop clicks are wired in theme.js.
favouritesNavBtn.addEventListener('click', () => {
    renderFavourites();
    hydrateIcons(favouritesModal);
    openModal('favouritesModal');
    const closeBtn = favouritesModal.querySelector('[data-close-modal]'); // focus for a11y
    if (closeBtn) setTimeout(() => closeBtn.focus(), 50);
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeModal('themeModal');
        closeModal('favouritesModal');
    }
});

/* -- INIT -- */

(async function init() {
    refreshFavBadge();
    await initGuestKey('reasons-to-say-no'); // no login on this site - every visitor signs as a guest
    loadStats();
})();
