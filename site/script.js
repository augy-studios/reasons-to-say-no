/* ============================================================
   THEMES
   ============================================================ */

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

/* ============================================================
   STORAGE KEYS
   ============================================================ */

const KEY_THEME = 'rtsn_theme';
const KEY_FAVS = 'rtsn_favourites';

/* ============================================================
   STATE
   ============================================================ */

let currentReason = null; // { id, reason }
let isLoading = false;

/* ============================================================
   DOM REFS
   ============================================================ */

const xOverlay = document.getElementById('xOverlay');
const reasonText = document.getElementById('reasonText');
const regenerateBtn = document.getElementById('regenerateBtn');
const shareBtn = document.getElementById('shareBtn');
const favouriteCardBtn = document.getElementById('favouriteCardBtn');
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

/* ============================================================
   THEME
   ============================================================ */

function applyTheme(themeId) {
    const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
    document.documentElement.style.setProperty('--brand', theme.color);

    const metaEl = document.getElementById('metaThemeColour');
    if (metaEl) metaEl.setAttribute('content', theme.color);

    localStorage.setItem(KEY_THEME, themeId);

    // Update active state in grid
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
        // Break label at \n
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

/* ============================================================
   FETCH REASON
   ============================================================ */

async function fetchReason() {
    if (isLoading) return;
    isLoading = true;

    // Start spin & X animation immediately
    triggerRegenerateAnim();
    playXAnimation();

    reasonText.classList.add('loading');
    reasonText.textContent = 'Finding a reason for you...';
    setFavouriteCardState(false);

    try {
        const res = await fetch('/api/get-reason');
        const json = await res.json();

        if (!res.ok || !json.success) {
            throw new Error(json.error || 'Unknown server error');
        }

        currentReason = json.data; // { id, reason }
        reasonText.textContent = json.data.reason;
        reasonText.classList.remove('loading');

        updateFavouriteCardBtn();

        // Fire-and-forget stat tracking
        trackStat('webapp');

    } catch (err) {
        console.error('[RTSN] fetchReason error:', err);
        reasonText.textContent =
            'Could not load a reason. Check your connection and try again.';
        reasonText.classList.remove('loading');
        currentReason = null;
    } finally {
        isLoading = false;
    }
}

async function trackStat(platform) {
    try {
        await fetch('/api/track-stat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                platform
            }),
        });
    } catch {
        // Stat tracking is non-critical; silently fail
    }
}

/* ============================================================
   ANIMATIONS
   ============================================================ */

function playXAnimation() {
    xOverlay.classList.remove('animate');
    // Force reflow so re-triggering works
    void xOverlay.offsetWidth;
    xOverlay.classList.add('animate');
}

function triggerRegenerateAnim() {
    regenerateBtn.classList.remove('spinning');
    void regenerateBtn.offsetWidth;
    regenerateBtn.classList.add('spinning');
    regenerateBtn.addEventListener(
        'animationend',
        () => regenerateBtn.classList.remove('spinning'), {
            once: true
        }
    );
}

/* ============================================================
   FAVOURITES — STORAGE
   ============================================================ */

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

function isFavourited(id) {
    return getFavourites().some(f => f.id === id);
}

function toggleFavourite() {
    if (!currentReason) return;

    const favs = getFavourites();
    const idx = favs.findIndex(f => f.id === currentReason.id);

    if (idx >= 0) {
        favs.splice(idx, 1);
        showToast('Removed from favourites');
    } else {
        favs.unshift({
            id: currentReason.id,
            reason: currentReason.reason
        });
        showToast('Added to favourites');
    }

    saveFavourites(favs);
    updateFavouriteCardBtn();
}

function updateFavouriteCardBtn() {
    if (!currentReason) return;
    setFavouriteCardState(isFavourited(currentReason.id));
}

function setFavouriteCardState(active) {
    favouriteCardBtn.classList.toggle('active', active);
    favouriteCardBtn.setAttribute('aria-pressed', String(active));
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

/* ============================================================
   FAVOURITES — MODAL RENDER
   ============================================================ */

function renderFavourites() {
    const favs = getFavourites();

    if (favs.length === 0) {
        favouritesList.innerHTML =
            '<p class="empty-state">No favourites yet.<br>Star a reason to save it here!</p>';
        return;
    }

    // Build list items
    const itemsHtml = favs.map((fav, i) => `
    <div class="fav-item" role="listitem">
      <p class="fav-text">${escapeHtml(fav.reason)}</p>
      <div class="fav-actions">
        <button
          class="fav-btn"
          data-action="copy"
          data-index="${i}"
          title="Copy to clipboard"
          aria-label="Copy reason to clipboard"
        >
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
        <button
          class="fav-btn danger"
          data-action="remove"
          data-index="${i}"
          title="Remove from favourites"
          aria-label="Remove from favourites"
        >
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

    // Clear all button
    const clearHtml = `
    <div class="fav-clear-row">
      <button class="fav-clear-btn" id="clearAllFavsBtn" aria-label="Clear all favourites">
        Clear all
      </button>
    </div>
  `;

    favouritesList.innerHTML = itemsHtml + clearHtml;

    // Bind action buttons
    favouritesList.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            if (btn.dataset.action === 'copy') copyFavourite(idx);
            if (btn.dataset.action === 'remove') removeFavourite(idx);
        });
    });

    const clearBtn = document.getElementById('clearAllFavsBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearAllFavourites);
    }
}

function copyFavourite(index) {
    const fav = getFavourites()[index];
    if (!fav) return;
    navigator.clipboard.writeText(fav.reason)
        .then(() => showToast('Copied to clipboard'))
        .catch(() => showToast('Copy failed — try again'));
}

function removeFavourite(index) {
    const favs = getFavourites();
    if (!favs[index]) return;
    favs.splice(index, 1);
    saveFavourites(favs);
    renderFavourites();
    if (currentReason) updateFavouriteCardBtn();
    showToast('Removed from favourites');
}

function clearAllFavourites() {
    if (!confirm('Clear all favourites? This cannot be undone.')) return;
    saveFavourites([]);
    renderFavourites();
    if (currentReason) updateFavouriteCardBtn();
    showToast('All favourites cleared');
}

/* ============================================================
   SHARE
   ============================================================ */

function shareReason() {
    if (!currentReason) return;

    const shareData = {
        title: 'Reasons to Say No',
        text: currentReason.reason,
        url: window.location.href,
    };

    if (navigator.share) {
        navigator.share(shareData).catch(err => {
            if (err.name !== 'AbortError') showToast('Share failed');
        });
    } else {
        // Graceful fallback: copy to clipboard
        navigator.clipboard.writeText(currentReason.reason)
            .then(() => showToast('Reason copied to clipboard'))
            .catch(() => showToast('Share is not supported on this browser'));
    }
}

/* ============================================================
   MODAL
   ============================================================ */

function openModal(modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Focus the close button for accessibility
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) setTimeout(() => closeBtn.focus(), 50);
}

function closeModal(modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
}

/* ============================================================
   TOAST
   ============================================================ */

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);

    // Two rAF to ensure element is painted before adding .show
    requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add('show'));
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 220);
    }, 2400);
}

/* ============================================================
   UTILS
   ============================================================ */

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/* ============================================================
   EVENT LISTENERS
   ============================================================ */

// Card actions
regenerateBtn.addEventListener('click', fetchReason);
shareBtn.addEventListener('click', shareReason);
favouriteCardBtn.addEventListener('click', toggleFavourite);

// Theme modal
themeNavBtn.addEventListener('click', () => {
    buildThemeGrid();
    openModal(themeModal);
});
themeModalClose.addEventListener('click', () => closeModal(themeModal));
themeModalBackdrop.addEventListener('click', () => closeModal(themeModal));

// Favourites modal
favouritesNavBtn.addEventListener('click', () => {
    renderFavourites();
    openModal(favouritesModal);
});
favouritesModalClose.addEventListener('click', () => closeModal(favouritesModal));
favouritesModalBackdrop.addEventListener('click', () => closeModal(favouritesModal));

// Keyboard: Escape closes modals, Space regenerates
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeModal(themeModal);
        closeModal(favouritesModal);
    }
    // Space to regenerate (only when no modal is open and focus isn't on a button)
    if (
        e.key === ' ' &&
        !themeModal.classList.contains('open') &&
        !favouritesModal.classList.contains('open') &&
        document.activeElement.tagName !== 'BUTTON' &&
        document.activeElement.tagName !== 'A'
    ) {
        e.preventDefault();
        fetchReason();
    }
});

/* ============================================================
   SERVICE WORKER
   ============================================================ */

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .catch(err => console.warn('[RTSN] SW registration failed:', err));
    });
}

/* ============================================================
   INIT
   ============================================================ */

(function init() {
    initTheme();
    refreshFavBadge();
    fetchReason(); // Triggers X animation + loads first reason
})();