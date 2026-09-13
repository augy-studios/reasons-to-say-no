// Service worker registration and the update bar. Classic script, loaded
// last on every page. The one place the worker is registered: the bar needs
// the ServiceWorkerRegistration object, which an inline register() call in
// the markup has nowhere to hand to.
//
// The rule the whole thing rests on: a new worker never activates on its
// own. It downloads, installs, and waits; the only thing that promotes it is
// a person pressing Reload here.
//
// This is the only top-of-page bar the site has. If an offline or connection
// bar is ever added, it should share this region and a single precedence
// order (unreachable outranks a version being ready) rather than stack.

const SW_URL = '/sw.js';
const SITE_NAME = 'Reasons to Say No';

let registration = null;
let waitingWorker = null;
let reloading = false;
let dismissed = false; // this page view only, never stored

function watchForUpdate() {
    if (!registration) return;

    // A worker already waiting when the page opened. This is the ordinary
    // case on the second page view after a deploy, and without it the prompt
    // would only reach somebody who had the page open at the moment the new
    // worker finished installing.
    if (registration.waiting && navigator.serviceWorker.controller) {
        waitingWorker = registration.waiting;
        renderUpdateNotice();
    }

    registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;

        installing.addEventListener('statechange', () => {
            // `installed` with a controller present means an update. With no
            // controller it is a first install, which has nothing to prompt
            // about: there is no previous version on screen to protect.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                waitingWorker = registration.waiting ?? installing;
                renderUpdateNotice();
            }
        });
    });
}

function registerWorker() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
        .register(SW_URL)
        .then(reg => {
            registration = reg;
            watchForUpdate();
        })
        .catch(cause => {
            // A refused registration is not a reason to break the page.
            console.warn('[RTSN] service worker registration failed:', cause);
        });

    // The swap, once somebody has accepted it. Reloading here rather than in
    // the click handler is what brings the page back on the new version: the
    // controller has changed by this point, so the reload is served by the
    // new worker and not the one being replaced.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
    });
}

function renderUpdateNotice() {
    const existing = document.querySelector('.update-notice');

    if (!waitingWorker || dismissed) {
        existing?.remove();
        return;
    }

    if (existing) return; // already drawn for this waiting worker

    const bar = document.createElement('div');
    bar.className = 'update-notice';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-label', 'Update');

    const inner = document.createElement('div');
    inner.className = 'update-notice-inner';

    const text = document.createElement('p');
    text.textContent = `A new version of ${SITE_NAME} is ready.`;

    const reloadBtn = document.createElement('button');
    reloadBtn.type = 'button';
    reloadBtn.className = 'btn btn-primary';
    reloadBtn.setAttribute('data-sw-update', '');
    reloadBtn.textContent = 'Reload';
    reloadBtn.addEventListener('click', () => {
        // The only place anything asks for skipWaiting. The reload happens on
        // controllerchange, not here.
        waitingWorker?.postMessage('skip-waiting');
    });

    const laterBtn = document.createElement('button');
    laterBtn.type = 'button';
    laterBtn.className = 'btn btn-quiet';
    laterBtn.setAttribute('data-sw-later', '');
    laterBtn.textContent = 'Not now';
    laterBtn.addEventListener('click', () => {
        dismissed = true;
        renderUpdateNotice();
    });

    inner.append(text, reloadBtn, laterBtn);
    bar.appendChild(inner);
    document.body.prepend(bar);
}

// Registration on `load`, not immediately: installing fetches everything the
// worker precaches, and starting that while the page is still fetching its
// own assets makes a first visit slower for no gain.
if (document.readyState === 'complete') registerWorker();
else window.addEventListener('load', registerWorker, { once: true });
