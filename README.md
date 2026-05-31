# Reasons to Say No

Get a compelling reason to say no - whenever you need one.

An open project by **Augy** / [UwU Apps](https://uwuapps.org/), available as a web app, Telegram bot, Discord bot, and free public API. All platforms share the same database and cross-platform usage stats.

---

## Use it

| Platform | Link |
|----------|------|
| 🌐 Web App | [no.uwuapps.org](https://no.uwuapps.org/) |
| 📊 Stats | [no.uwuapps.org/stats](https://no.uwuapps.org/stats) |
| ✈️ Telegram Bot | [@no_reasons_bot](https://t.me/no_reasons_bot) |
| 🎮 Discord Bot | [Add to your server](https://discord.com/oauth2/authorize?client_id=1509196842955702537) |
| 📖 API Docs | [docs.api.uwuapps.org/no](https://docs.api.uwuapps.org/no) |

---

## Web App

A PWA at [no.uwuapps.org](https://no.uwuapps.org/) - tap to get a reason, regenerate, share, or save favourites. Supports multiple themes and works offline. Source lives in [`site/`](site/).

A **Stats for Nerds** page at [no.uwuapps.org/stats](https://no.uwuapps.org/stats) shows live cross-platform usage charts: all-time platform breakdown (doughnut chart) and the last 7 days of activity (stacked bar chart), mirroring the data shown by `/stats` in the Telegram and Discord bots.

## Telegram Bot

[@no_reasons_bot](https://t.me/no_reasons_bot) - send `/no` to get a reason, `/myfavs` to browse saved favourites, `/stats` for cross-platform usage charts, and `/help` for the full command list.

Inline mode is also supported: type `@no_reasons_bot` followed by a space in any chat to get a random reason or one of your saved favourites without leaving the conversation.

## Discord Bot

[Add the bot to your server](https://discord.com/oauth2/authorize?client_id=1509196842955702537) and use slash commands:

| Command | Description |
|---------|-------------|
| `/no` | Get a random reason to say no |
| `/no mention:@user` | Ping someone with a reason |
| `/no count:5` | Get up to 20 reasons at once |
| `/myfavs` | Browse and manage your saved favourites |
| `/stats` | Cross-platform usage chart |
| `/help` | About the project and full command list |

Source lives in [`discord-bot/`](discord-bot/).

## API

Free and open for anyone to use. Full documentation at [docs.api.uwuapps.org/no](https://docs.api.uwuapps.org/no).

---

## License

[MIT](LICENSE)
