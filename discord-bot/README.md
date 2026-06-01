# Reasons to Say No - Discord Bot

A discord.py bot that reads reasons and writes stats directly via the Supabase client. Supports servers and DMs, per-user favourites, cross-platform usage statistics, and persistent interactive buttons.

---

## Commands

| Command | Description |
|---------|-------------|
| `/no` | Get a random reason to say no |
| `/no mention:@user` | Ping someone with a reason |
| `/no count:5` | Get up to 20 reasons in a numbered list |
| `/myfavs` | Browse and manage your saved favourites |
| `/pickfav` | Pick one of your saved favourites to send as a public message |
| `/pickfav mention:@user` | Pick a saved favourite and ping someone with it |
| `/stats` | Cross-platform usage chart (web + Telegram + Discord + API) |
| `/help` | About the project and full command list |

Every single `/no` response includes:

- **🔄 Regenerate** - replaces the reason in-place with a fresh one
- **⭐ Add to Fav** - saves the current reason to your personal favourites

---

## Data storage

### Supabase (shared with the web app and Telegram bot)

| Table | Used for |
|-------|----------|
| `no_reasons` | Read - one random row fetched per `/no` or button press |
| `no_stats` | Write - one row inserted per fetch with `platform = 'discord'` |

### Local SQLite (`rtsn.db`)

Created automatically on first run. Never committed.

| Table | Purpose |
|-------|---------|
| `active_buttons` | Tracks live button state so **Add to Fav** works after bot restarts |
| `user_favourites` | Per-user saved reasons with a unique constraint on `(user_id, reason_id)` |

---
