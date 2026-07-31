/* -- STORAGE KEYS -- */

const KEY_FAVS = 'rtsn_favourites';

/* -- STATE -- */

let currentReason = null; // { id, reason }
let isLoading = false;

/* -- DOM REFS -- */

const xOverlay = document.getElementById('xOverlay');
const reasonText = document.getElementById('reasonText');
const regenerateBtn = document.getElementById('regenerateBtn');
const shareBtn = document.getElementById('shareBtn');
const favouriteCardBtn = document.getElementById('favouriteCardBtn');
const toastContainer = document.getElementById('toastContainer');

const favouritesNavBtn = document.getElementById('favouritesNavBtn');
const favouritesModal = document.getElementById('favouritesModal');
const favouritesList = document.getElementById('favouritesList');
const favBadge = document.getElementById('favBadge');

/* -- FETCH REASON -- */

async function fetchReason() {
    if (isLoading) return;
    isLoading = true;

    triggerRegenerateAnim();
    playXAnimation();

    reasonText.classList.add('loading');
    reasonText.textContent = 'Finding a reason for you...';
    setFavouriteCardState(false);

    try {
        const res = await signedFetch('/api/get-reason');
        const json = await res.json();

        if (!res.ok || !json.success) {
            throw new Error(json.error || 'Unknown server error');
        }

        currentReason = json.data; // { id, reason }
        reasonText.textContent = json.data.reason;
        reasonText.classList.remove('loading');

        updateFavouriteCardBtn();

        trackStat('webapp'); // fire-and-forget

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
        await signedFetch('/api/track-stat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                platform
            }),
        });
    } catch {
        // non-critical; ignore
    }
}

/* -- ANIMATIONS -- */

function playXAnimation() {
    xOverlay.classList.remove('animate');
    void xOverlay.offsetWidth; // force reflow for re-trigger
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

/* -- FAVOURITES: STORAGE -- */

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

/* -- FAVOURITES: RENDER -- */

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

    const clearHtml = `
    <div class="fav-clear-row">
      <button class="fav-clear-btn" id="clearAllFavsBtn" aria-label="Clear all favourites">
        Clear all
      </button>
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
    if (clearBtn) {
        clearBtn.addEventListener('click', clearAllFavourites);
    }
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

/* -- SHARE -- */

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
        // fallback: copy
        navigator.clipboard.writeText(currentReason.reason)
            .then(() => showToast('Reason copied to clipboard'))
            .catch(() => showToast('Share is not supported on this browser'));
    }
}

/* -- TOAST -- */

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);

    // double rAF - ensure paint before .show
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

/* -- EVENT LISTENERS -- */

// Card actions
regenerateBtn.addEventListener('click', fetchReason);
shareBtn.addEventListener('click', shareReason);
favouriteCardBtn.addEventListener('click', toggleFavourite);

// Favourites modal. Theme button and close/backdrop clicks are wired in theme.js.
favouritesNavBtn.addEventListener('click', () => {
    renderFavourites();
    hydrateIcons(favouritesModal);
    openModal('favouritesModal');
    const closeBtn = favouritesModal.querySelector('[data-close-modal]'); // focus for a11y
    if (closeBtn) setTimeout(() => closeBtn.focus(), 50);
});

// Escape closes modals, Space regenerates
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeModal('themeModal');
        closeModal('favouritesModal');
    }
    if (
        e.key === ' ' &&
        !document.querySelector('.modal-backdrop:not(.hidden)') &&
        document.activeElement.tagName !== 'BUTTON' &&
        document.activeElement.tagName !== 'A'
    ) {
        e.preventDefault();
        fetchReason();
    }
});

/* -- SERVICE WORKER -- */

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .catch(err => console.warn('[RTSN] SW registration failed:', err));
    });
}

/* -- INIT -- */

(async function init() {
    refreshFavBadge();
    await initGuestKey('reasons-to-say-no'); // no login on this site - every visitor signs as a guest
    fetchReason(); // triggers X anim + loads first reason
})();