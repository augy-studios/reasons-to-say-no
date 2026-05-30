# Reasons to Say No — Site

A PWA that generates a compelling reason to say no on demand.

## Stack

- **Frontend**: Vanilla HTML / CSS / JS — PWA with service worker
- **Hosting**: Vercel (Pro)
- **Serverless**: Vercel Functions (`/api`)
- **Database**: Supabase (`no_reasons` & `no_stats` tables)

---

## Project Structure

```bash
/
├── index.html          ← Main app shell
├── style.css           ← All shared styles
├── script.js           ← Main page client-side logic
├── stats.html          ← Stats for Nerds page
├── stats.css           ← Stats page styles (overrides + additions)
├── stats.js            ← Stats page client-side logic (charts, theme, favourites)
├── sw.js               ← Service worker (PWA caching)
├── manifest.json       ← PWA manifest
├── package.json        ← Serverless dependencies
└── api/
    ├── get-reason.js   ← GET  /api/get-reason
    ├── get-stats.js    ← GET  /api/get-stats
    └── track-stat.js   ← POST /api/track-stat
```

---

## Pages

### `/` — Main App

Get a random reason to say no. Regenerate, share, or save to favourites. Theme picker with 7 colour options. Works offline via service worker.

### `/stats` — Stats for Nerds

Live cross-platform usage charts powered by `/api/get-stats`:

- **Summary cards** — all-time totals per platform (Web App, Telegram, Discord, API)
- **Doughnut chart** — all-time platform distribution
- **Stacked bar chart** — last 7 days of activity broken down by platform

The stats page shares the same nav, footer, theme picker, and favourites modal as the main page.

---

## API Endpoints

| Method | Route             | Description                                             |
| ------ | ----------------- | ------------------------------------------------------- |
| `GET`  | `/api/get-reason` | Returns a random reason `{ id, reason }`                |
| `GET`  | `/api/get-stats`  | Returns usage stats (totals, by platform, last 7 days)  |
| `POST` | `/api/track-stat` | Records a platform use — body: `{ platform }`           |

---

## Keyboard Shortcuts

| Key       | Page | Action                  |
| --------- | ---- | ----------------------- |
| `Space`   | Main | Regenerate reason       |
| `Escape`  | Both | Close any open modal    |

---

## Future Plans

- **PWA install banner** — intercept `beforeinstallprompt` and show a custom install prompt
