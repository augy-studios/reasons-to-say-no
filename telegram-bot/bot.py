# Reasons to Say No - Telegram Bot

import asyncio
import io
import logging
import os
from collections import defaultdict

import matplotlib
import matplotlib.pyplot as plt
import numpy as np
from dotenv import load_dotenv
from telethon import Button, TelegramClient, events
from telethon.errors import MessageNotModifiedError, QueryIdInvalidError

from database import Database
from pg import PgDatabase

matplotlib.use("Agg")
load_dotenv()

# Config

API_ID       = int(os.environ["API_ID"])
API_HASH     = os.environ["API_HASH"]
BOT_TOKEN    = os.environ["BOT_TOKEN"]
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

WEBAPP_URL   = "https://no.uwuapps.org/"
API_DOCS_URL = "https://docs.api.uwuapps.org/no"

FAVS_PAGE_SIZE = 5

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("rtsn-bot")

bot = TelegramClient("bot_session", API_ID, API_HASH)
db  = Database("rtsn.db")  # buttons + favourites
pg  = PgDatabase()          # reasons + stats

BOT_USERNAME: str = ""


# Helpers

def is_for_bot(raw_text: str) -> bool:
    # Accept /cmd or /cmd@ourbotusername; ignore /cmd@otherbot in groups.
    at_pos = raw_text.find("@")
    if at_pos == -1:
        return True
    username_part = raw_text[at_pos + 1:].split()[0].lower()
    return username_part == BOT_USERNAME.lower()


def reason_buttons(reason_id: int) -> list:
    return [
        [Button.inline("🔄  New Reason", data=f"nr:{reason_id}")],
        [Button.inline("⭐  Save", data=f"fav:{reason_id}")],
    ]


def format_reason(reason: dict) -> str:
    return f"**Reason to say no:**\n\n__{reason['reason']}__"


# Reason sender

async def send_reason(event):
    reason = await pg.get_random_reason()
    if not reason:
        await event.respond("❌  Couldn't reach the database right now - try again in a moment.")
        return None

    msg = await event.respond(
        format_reason(reason),
        buttons=reason_buttons(reason["id"]),
    )
    db.upsert_active_button(msg.id, event.chat_id, event.sender_id, reason["id"], reason["reason"])
    asyncio.create_task(pg.log_stat("telegram"))
    return msg


# Commands

@bot.on(events.NewMessage(pattern=r"^/start(?:@\w+)?$"))
async def cmd_start(event):
    if not is_for_bot(event.raw_text):
        return

    text = (
        "**Reasons to Say No**\n\n"
        "Here's what I can do:\n\n"
        "🎲 `/no` - Get a random reason to say no\n"
        "⭐ `/fav` - Save the last reason to your favourites\n"
        "📋 `/myfavs` - Browse your saved favourites\n"
        "📊 `/stats` - View cross-platform usage stats as a chart\n"
        "ℹ️ `/about` - About this project\n\n"
        "_In a group, mention me or use_ `/cmd@username` _to talk to me._"
    )
    await event.respond(
        text,
        buttons=[[Button.url("📖  API Docs", API_DOCS_URL), Button.url("🌐  Web App", WEBAPP_URL)]],
    )


@bot.on(events.NewMessage(pattern=r"^/no(?:@\w+)?$"))
async def cmd_no(event):
    if not is_for_bot(event.raw_text):
        return
    await send_reason(event)


@bot.on(events.NewMessage(pattern=r"^/fav(?:@\w+)?$"))
async def cmd_fav(event):
    if not is_for_bot(event.raw_text):
        return

    last = db.get_last_button_for_user(event.sender_id)
    if not last:
        await event.respond("❌  No recent reason found for you.\n\nUse /no to get one first!")
        return

    saved = db.save_favourite(event.sender_id, last["reason_id"], last["reason_text"])
    if saved:
        await event.respond(f"⭐  Saved!\n\n__{last['reason_text']}__")
    else:
        await event.respond("Already in your favourites!")


@bot.on(events.NewMessage(pattern=r"^/myfavs(?:@\w+)?$"))
async def cmd_myfavs(event):
    if not is_for_bot(event.raw_text):
        return
    await send_favs_page(event, event.sender_id, page=0, send_new=True)


@bot.on(events.NewMessage(pattern=r"^/stats(?:@\w+)?$"))
async def cmd_stats(event):
    if not is_for_bot(event.raw_text):
        return

    totals = await pg.get_total_stats()
    if totals["total"] == 0:
        await event.respond("📊  No stats recorded yet - use /no to get started!")
        return

    by_platform = await pg.get_stats_by_platform()
    by_day      = await pg.get_stats_by_day(7)
    img = build_stats_chart(by_platform, by_day, totals)

    caption = (
        f"📊  **Usage Statistics** (all time)\n\n"
        f"Total fetches: **{totals['total']:,}**\n"
        f"🌐 Web app:   **{totals['webapp']:,}**\n"
        f"✈️ Telegram:   **{totals['telegram']:,}**\n"
        f"🎮 Discord:    **{totals['discord']:,}**"
    )
    await event.respond(caption, file=img)


@bot.on(events.NewMessage(pattern=r"^/about(?:@\w+)?$"))
async def cmd_about(event):
    if not is_for_bot(event.raw_text):
        return

    count = await pg.get_reason_count()
    text = (
        f"ℹ️  **About Reasons to Say No**\n\n"
        f"An open project by **Augy** / UwU Apps.\n\n"
        f"There are currently **{count:,}** reasons in the database, "
        f"fetched live on every request.\n\n"
        f"📖 The API is free and open for anyone to use."
    )
    await event.respond(
        text,
        buttons=[[Button.url("📖  API Docs", API_DOCS_URL), Button.url("🌐  Web App", WEBAPP_URL)]],
    )


# Callbacks

@bot.on(events.CallbackQuery(pattern=rb"^nr:(\d+)$"))
async def cb_new_reason(event):
    try:
        await event.answer("Fetching a new reason…")
    except QueryIdInvalidError:
        pass

    reason = await pg.get_random_reason()
    if not reason:
        try:
            await event.answer("❌  Database error - try again!", alert=True)
        except QueryIdInvalidError:
            pass
        return

    try:
        await event.edit(format_reason(reason), buttons=reason_buttons(reason["id"]))
    except MessageNotModifiedError:
        pass

    db.upsert_active_button(event.message_id, event.chat_id, event.sender_id, reason["id"], reason["reason"])
    asyncio.create_task(pg.log_stat("telegram"))


@bot.on(events.CallbackQuery(pattern=rb"^fav:(\d+)$"))
async def cb_save_fav(event):
    reason_id = int(event.pattern_match.group(1))
    row = db.get_active_button(event.message_id, event.chat_id)

    if not row or not row.get("reason_text"):
        try:
            await event.answer("❌  Couldn't find the reason data - please try again.", alert=True)
        except QueryIdInvalidError:
            pass
        return

    saved = db.save_favourite(event.sender_id, reason_id, row["reason_text"])
    msg   = "⭐  Saved to your favourites!" if saved else "Already in your favourites!"
    try:
        await event.answer(msg)
    except QueryIdInvalidError:
        pass


@bot.on(events.CallbackQuery(pattern=rb"^favpage:(\d+):(\d+)$"))
async def cb_favs_page(event):
    user_id = int(event.pattern_match.group(1))
    page    = int(event.pattern_match.group(2))

    if event.sender_id != user_id:
        try:
            await event.answer("These aren't your favourites!", alert=True)
        except QueryIdInvalidError:
            pass
        return

    try:
        await event.answer()
    except QueryIdInvalidError:
        pass

    await send_favs_page(event, user_id, page=page, send_new=False)


@bot.on(events.CallbackQuery(pattern=rb"^unfav:(\d+):(\d+)$"))
async def cb_unfav(event):
    reason_id = int(event.pattern_match.group(1))
    page      = int(event.pattern_match.group(2))

    db.remove_favourite(event.sender_id, reason_id)
    try:
        await event.answer("🗑️  Removed from favourites.")
    except QueryIdInvalidError:
        pass

    await send_favs_page(event, event.sender_id, page=page, send_new=False)


# Favourites pager

async def send_favs_page(event, user_id: int, page: int, send_new: bool):
    total  = db.count_favourites(user_id)
    offset = page * FAVS_PAGE_SIZE
    favs   = db.get_favourites(user_id, limit=FAVS_PAGE_SIZE, offset=offset)

    if not favs and page == 0:
        text = (
            "📋  **Your Favourites**\n\n"
            "Nothing saved yet.\n\n"
            "Use /no to get a reason, then tap **⭐ Save** to keep it here."
        )
        if send_new:
            await event.respond(text)
        else:
            try:
                await event.edit(text, buttons=None)
            except (MessageNotModifiedError, Exception):
                pass
        return

    lines = [f"📋  **Your Favourites** ({total} total)\n"]
    for i, fav in enumerate(favs, start=offset + 1):
        lines.append(f"**{i}.** __{fav['reason_text']}__\n")

    text    = "\n".join(lines)
    buttons = []

    for fav in favs:
        short = fav["reason_text"][:35] + ("…" if len(fav["reason_text"]) > 35 else "")
        buttons.append([Button.inline(f"🗑️  {short}", data=f"unfav:{fav['reason_id']}:{page}")])

    nav_row = []
    if page > 0:
        nav_row.append(Button.inline("◀  Prev", data=f"favpage:{user_id}:{page - 1}"))
    if offset + FAVS_PAGE_SIZE < total:
        nav_row.append(Button.inline("Next  ▶", data=f"favpage:{user_id}:{page + 1}"))
    if nav_row:
        buttons.append(nav_row)

    if send_new:
        await event.respond(text, buttons=buttons)
    else:
        try:
            await event.edit(text, buttons=buttons)
        except MessageNotModifiedError:
            pass


# Stats chart

CHART_BG    = "#ccffcc"  # PWA classic green
PANEL_BG    = "#e8ffe8"
TEXT_COLOR  = "#1a3a1a"

PLATFORM_COLORS = {
    "webapp":   "#2e7d32",  # deep green
    "telegram": "#1565c0",  # deep blue
    "discord":  "#6a1b9a",  # deep purple
}
FALLBACK_COLORS = ["#c62828", "#f57f17", "#00695c"]


def _platform_color(platform: str, idx: int) -> str:
    return PLATFORM_COLORS.get(platform, FALLBACK_COLORS[idx % len(FALLBACK_COLORS)])


def build_stats_chart(by_platform: list[dict], by_day: list[dict], totals: dict) -> io.BytesIO:
    fig, (ax_pie, ax_bar) = plt.subplots(1, 2, figsize=(13, 5))
    fig.patch.set_facecolor(CHART_BG)

    ax_pie.set_facecolor(PANEL_BG)
    if by_platform:
        labels = [r["platform"].title() for r in by_platform]
        sizes  = [r["count"] for r in by_platform]
        colors = [_platform_color(r["platform"], i) for i, r in enumerate(by_platform)]
        _, _, autos = ax_pie.pie(
            sizes, labels=labels, colors=colors,
            autopct="%1.1f%%", startangle=90,
            textprops={"color": TEXT_COLOR, "fontsize": 11},
            wedgeprops={"linewidth": 1.5, "edgecolor": CHART_BG},
        )
        for a in autos:
            a.set_color("white")
            a.set_fontsize(10)
    ax_pie.set_title("By Platform (all time)", color=TEXT_COLOR, fontsize=14, fontweight="bold", pad=14)

    ax_bar.set_facecolor(PANEL_BG)
    ax_bar.tick_params(colors=TEXT_COLOR)
    for spine in ax_bar.spines.values():
        spine.set_edgecolor("#99cc99")

    if by_day:
        day_plat: dict = defaultdict(lambda: defaultdict(int))
        for row in by_day:
            day_plat[str(row["day"])][row["platform"]] += row["count"]

        all_days  = sorted(day_plat)
        platforms = sorted({row["platform"] for row in by_day})
        x         = np.arange(len(all_days))
        width     = 0.8 / max(len(platforms), 1)

        for i, plat in enumerate(platforms):
            vals   = [day_plat[d][plat] for d in all_days]
            offset = (i - len(platforms) / 2 + 0.5) * width
            bars   = ax_bar.bar(
                x + offset, vals, width,
                label=plat.title(), color=_platform_color(plat, i),
                alpha=0.9, edgecolor=CHART_BG, linewidth=0.8,
            )
            for bar in bars:
                h = bar.get_height()
                if h:
                    ax_bar.text(
                        bar.get_x() + bar.get_width() / 2, h + 0.05,
                        str(int(h)), ha="center", va="bottom", color=TEXT_COLOR, fontsize=8,
                    )

        ax_bar.set_xticks(x)
        ax_bar.set_xticklabels(
            [d[5:] for d in all_days],  # MM-DD
            color=TEXT_COLOR, rotation=40, ha="right",
        )
        ax_bar.yaxis.set_tick_params(labelcolor=TEXT_COLOR)
        ax_bar.set_ylabel("Requests", color=TEXT_COLOR, fontsize=11)
        ax_bar.legend(facecolor=CHART_BG, labelcolor=TEXT_COLOR, framealpha=0.8, fontsize=10,
                      edgecolor="#99cc99")

    ax_bar.set_title("Last 7 Days by Platform", color=TEXT_COLOR, fontsize=14, fontweight="bold", pad=14)
    fig.suptitle("Reasons to Say No - Usage Stats", color=TEXT_COLOR, fontsize=15, fontweight="bold", y=1.01)
    plt.tight_layout()

    buf = io.BytesIO()
    buf.name = "rtsn-stats.png"
    plt.savefig(buf, format="png", dpi=130, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    return buf


# Entry point

async def main():
    global BOT_USERNAME
    await pg.connect(SUPABASE_URL, SUPABASE_KEY)
    await bot.start(bot_token=BOT_TOKEN)
    me = await bot.get_me()
    BOT_USERNAME = me.username or ""
    logger.info("Bot running as @%s", BOT_USERNAME)
    try:
        await bot.run_until_disconnected()
    finally:
        await pg.close()


if __name__ == "__main__":
    asyncio.run(main())
