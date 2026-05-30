# Reasons to Say No

A site that generates a compelling reason to say no on demand.

## Stack

- **Frontend**: Vanilla HTML / CSS / JS - PWA with service worker
- **Hosting**: Vercel (Pro)
- **Serverless**: Vercel Functions (`/api`)
- **Database**: Supabase (`no_reasons` & `no_stats` table)

---

## Project Structure

```bash
/
├── index.html          ← App shell
├── styles.css          ← All styles
├── app.js              ← All client-side logic
├── sw.js               ← Service worker (PWA caching)
├── manifest.json       ← PWA manifest
├── vercel.json         ← Vercel headers config
├── package.json        ← Serverless dependencies
├── .env.example        ← Environment variable template
├── no_stats.sql        ← SQL to create the no_stats table
└── api/
    ├── get-reason.js   ← GET  /api/get-reason
    └── track-stat.js   ← POST /api/track-stat
```

---

## Keyboard Shortcuts

| Key      | Action                        |
|----------|-------------------------------|
| `Space`  | Regenerate reason             |
| `Escape` | Close any open modal          |

---

## Future Plans

- Telegram bot (`/no`) - track via `platform: "telegram"`
- Discord bot (`/no`) - track via `platform: "discord"`
- **Keyboard shortcut hint** - a small tooltip on the card hinting at `Space` to regenerate
- **Stats dashboard** - a `/stats` route showing per-platform usage charts
- **PWA install banner** - intercept `beforeinstallprompt` and show a custom install prompt
