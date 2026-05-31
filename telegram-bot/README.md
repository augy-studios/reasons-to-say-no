# Reasons to Say No - Telegram Bot

A Telethon-powered bot that reads reasons and writes stats directly via the Supabase client. Supports group chats, per-user favourites, cross-platform usage statistics, and interactive inline buttons.

---

## Commands

| Command   | Description                                              |
|-----------|----------------------------------------------------------|
| `/start`  | Show the command list with links to the web app and docs |
| `/no`     | Get a random reason to say no                            |
| `/fav`    | Save the last reason shown to you to your favourites     |
| `/myfavs` | Browse and manage your saved favourites                  |
| `/stats`  | Cross-platform usage chart (web + Telegram + Discord)    |
| `/about`  | About the project, including total reason count          |

Every reason message includes:

- **🔄 New Reason** - edits the message in place with a fresh reason
- **⭐ Save** - adds the current reason to your personal favourites

The **🌐 Web App** link appears only on `/start` and `/about` responses.

---

## Inline mode

The bot supports Telegram inline mode. Type `@no_reasons_bot` followed by a space in any chat to get results without leaving the conversation:

- **🎲 Random Reason** - a fresh random reason fetched from the database
- **⭐ Favourited Reason 1, 2, …** - your saved favourites (up to 50), listed in order

Tap any result to send it as a plain message in the current chat. Stats are logged for the random reason result only.

---

## Data storage

### Supabase (shared with the web app and Discord bot)

| Table        | Used for                                                         |
|--------------|------------------------------------------------------------------|
| `no_reasons` | Read - one random row fetched per `/no` or button press          |
| `no_stats`   | Write - one row inserted per fetch with `platform = 'telegram'`  |

The `/stats` chart reads all rows from `no_stats` across every platform so you can see web app vs Telegram vs Discord side by side.

### Local SQLite (`rtsn.db`)

Created automatically on first run. Never committed (listed in `.gitignore`).

| Table             | Purpose                                                                      |
|-------------------|------------------------------------------------------------------------------|
| `active_buttons`  | Tracks live inline buttons; stores reason text so **Save** works locally     |
| `user_favourites` | Per-user saved reasons with a unique constraint on `(user_id, reason_id)`    |

---

## Group chat usage

Invite the bot to any group. With default privacy settings, address commands with your bot's username:

```text
/no@YourBotUsername
/stats@YourBotUsername
```

With privacy disabled the bare `/no` form also works. Inline buttons always work regardless of privacy mode.
