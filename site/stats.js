/* -- THEMES (shared with script.js) -- */

const THEMES = [{
        id: 'classic',
        label: 'Classic',
        color: '#ccffcc'
    },
    {
        id: 'not-green-1',
        label: 'Not Green 1',
        color: '#ffcccc'
    },
    {
        id: 'not-green-2',
        label: 'Not Green 2',
        color: '#ccccff'
    },
    {
        id: 'not-green-3',
        label: 'Not Green 3',
        color: '#ffffcc'
    },
    {
        id: 'not-green-4',
        label: 'Not Green 4',
        color: '#ffccff'
    },
    {
        id: 'not-green-5',
        label: 'Not Green 5',
        color: '#ccffff'
    },
    {
        id: 'pure-white',
        label: 'Really Really\nLight Green',
        color: '#ffffff'
    },
];

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

const KEY_THEME = 'rtsn_theme';
const KEY_FAVS = 'rtsn_favourites';

/* -- DOM REFS -- */

const toastContainer = document.getElementById('toastContainer');
const themeNavBtn = document.getElementById('themeNavBtn');
const themeModal = document.getElementById('themeModal');
const themeModalClose = document.getElementById('themeModalClose');
const themeModalBackdrop = document.getElementById('themeModalBackdrop');
const themeGrid = document.getElementById('themeGrid');

const favouritesNavBtn = document.getElementById('favouritesNavBtn');
const favouritesModal = document.getElementById('favouritesModal');
const favouritesModalClose = document.getElementById('favouritesModalClose');
const favouritesModalBackdrop = document.getElementById('favouritesModalBackdrop');
const favouritesList = document.getElementById('favouritesList');
const favBadge = document.getElementById('favBadge');

const statsSummary = document.getElementById('statsSummary');
const chartsGrid = document.getElementById('chartsGrid');

/* -- THEME -- */

function applyTheme(themeId) {
    const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
    document.documentElement.style.setProperty('--brand', theme.color);

    const metaEl = document.getElementById('metaThemeColour');
    if (metaEl) metaEl.setAttribute('content', theme.color);

    localStorage.setItem(KEY_THEME, themeId);

    document.querySelectorAll('.theme-option').forEach(el => {
        const active = el.dataset.theme === themeId;
        el.classList.toggle('active', active);
        el.setAttribute('aria-pressed', String(active));
    });
}

function buildThemeGrid() {
    const savedId = localStorage.getItem(KEY_THEME) || 'classic';

    themeGrid.innerHTML = THEMES.map(t => {
        const active = t.id === savedId;
        const extraBorder = t.color === '#ffffff' ? 'border: 2px solid #d1d5db;' : '';
        const labelHtml = t.label.replace('\n', '<br>');
        return `
      <button
        class="theme-option${active ? ' active' : ''}"
        data-theme="${t.id}"
        aria-label="Select ${t.label.replace('\n', ' ')} theme"
        aria-pressed="${active}"
      >
        <span class="theme-swatch" style="background-color:${t.color};${extraBorder}"></span>
        <span class="theme-name">${labelHtml}</span>
      </button>
    `;
    }).join('');

    themeGrid.querySelectorAll('.theme-option').forEach(btn => {
        btn.addEventListener('click', () => {
            applyTheme(btn.dataset.theme);
            closeModal(themeModal);
            showToast('Theme applied');
        });
    });
}

function initTheme() {
    const savedId = localStorage.getItem(KEY_THEME) || 'classic';
    applyTheme(savedId);
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

/* -- MODAL -- */

function openModal(modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) setTimeout(() => closeBtn.focus(), 50);
}

function closeModal(modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
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

    new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: filtered.map(p => PLATFORMS[p.platform].label),
            datasets: [{
                data: filtered.map(p => p.count),
                backgroundColor: filtered.map(p => PLATFORMS[p.platform].color),
                borderWidth: 3,
                borderColor: 'rgba(255,255,255,0.85)',
                hoverBorderColor: 'rgba(255,255,255,1)',
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
                        color: '#374151',
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
                        color: '#6b7280',
                    }
                },
                y: {
                    stacked: true,
                    grid: {
                        color: 'rgba(0,0,0,0.06)'
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
                        color: '#6b7280',
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
                        color: '#374151',
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
    chartsGrid.innerHTML = `<p class="stats-error">${escapeHtml(message)}<br><br><a href="/stats" style="color:var(--text-secondary)">Reload page</a></p>`;
}

/* -- FETCH STATS -- */

async function loadStats() {
    try {
        const res = await fetch('/api/get-stats');
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

themeNavBtn.addEventListener('click', () => {
    buildThemeGrid();
    openModal(themeModal);
});
themeModalClose.addEventListener('click', () => closeModal(themeModal));
themeModalBackdrop.addEventListener('click', () => closeModal(themeModal));

favouritesNavBtn.addEventListener('click', () => {
    renderFavourites();
    openModal(favouritesModal);
});
favouritesModalClose.addEventListener('click', () => closeModal(favouritesModal));
favouritesModalBackdrop.addEventListener('click', () => closeModal(favouritesModal));

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeModal(themeModal);
        closeModal(favouritesModal);
    }
});

/* -- INIT -- */

(function init() {
    initTheme();
    refreshFavBadge();
    loadStats();
})();
