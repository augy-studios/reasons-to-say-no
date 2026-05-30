# Reasons to Say No - Discord Bot

import asyncio
import io
import logging
import os
import urllib.request
from collections import defaultdict
from pathlib import Path

import discord
from discord import app_commands
from discord.ext import commands
import matplotlib
import matplotlib.pyplot as plt
import numpy as np
from dotenv import load_dotenv
from matplotlib import font_manager

from database import Database
from pg import PgDatabase

matplotlib.use("Agg")
load_dotenv()

# ── Font ──────────────────────────────────────────────────────────────────────

_JUA_PATH = Path(__file__).parent / "fonts" / "Jua-Regular.ttf"
_JUA_URL  = "https://github.com/google/fonts/raw/main/ofl/jua/Jua-Regular.ttf"


def _load_jua() -> bool:
    try:
        _JUA_PATH.parent.mkdir(exist_ok=True)
        if not _JUA_PATH.exists():
            urllib.request.urlretrieve(_JUA_URL, _JUA_PATH)
        font_manager.fontManager.addfont(str(_JUA_PATH))
        return True
    except Exception as exc:
        logging.getLogger("rtsn-discord").warning("Jua font unavailable: %s", exc)
        return False


_JUA_LOADED = _load_jua()

# ── Config ────────────────────────────────────────────────────────────────────

DISCORD_TOKEN = os.environ["DISCORD_TOKEN"]
SUPABASE_URL  = os.environ["SUPABASE_URL"]
SUPABASE_KEY  = os.environ["SUPABASE_SERVICE_KEY"]

WEBAPP_URL     = "https://no.uwuapps.org/"
API_DOCS_URL   = "https://docs.api.uwuapps.org/no"
FAVS_PAGE_SIZE = 5

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("rtsn-discord")

db = Database("rtsn.db")
pg = PgDatabase()

# ── Styling ───────────────────────────────────────────────────────────────────

EMBED_COLOR = 0x2E7D32
CHART_BG    = "#ccffcc"
PANEL_BG    = "#e8ffe8"
TEXT_COLOR  = "#1a3a1a"
PLATFORM_COLORS = {
    "webapp":   "#2e7d32",
    "telegram": "#1565c0",
    "discord":  "#6a1b9a",
    "api":      "#00838f",
}
FALLBACK_COLORS = ["#c62828", "#f57f17", "#00695c"]


def _platform_color(platform: str, idx: int) -> str:
    return PLATFORM_COLORS.get(platform, FALLBACK_COLORS[idx % len(FALLBACK_COLORS)])


# ── Embed helpers ─────────────────────────────────────────────────────────────

def make_reason_embed(reason: dict) -> discord.Embed:
    embed = discord.Embed(
        title="Reason to Say No",
        description=f"*{reason['reason']}*",
        color=EMBED_COLOR,
    )
    embed.set_footer(text=f"Reason #{reason['id']}")
    return embed


def make_reasons_embed(reasons: list[dict]) -> discord.Embed:
    lines = "\n".join(f"**{i}.** *{r['reason']}*" for i, r in enumerate(reasons, 1))
    embed = discord.Embed(
        title=f"{len(reasons)} Reasons to Say No",
        description=lines,
        color=EMBED_COLOR,
    )
    return embed


# ── Stats chart ───────────────────────────────────────────────────────────────

def build_stats_chart(by_platform: list[dict], by_day: list[dict], totals: dict) -> io.BytesIO:
    font_ctx = {"font.family": "Jua"} if _JUA_LOADED else {}
    with matplotlib.rc_context(font_ctx):
        return _draw_stats_chart(by_platform, by_day, totals)


def _draw_stats_chart(by_platform: list[dict], by_day: list[dict], totals: dict) -> io.BytesIO:
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
        width     = 0.4 / max(len(platforms), 1)

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
            [d[5:] for d in all_days],
            color=TEXT_COLOR, rotation=40, ha="right",
        )
        ax_bar.yaxis.set_tick_params(labelcolor=TEXT_COLOR)
        ax_bar.set_ylabel("Requests", color=TEXT_COLOR, fontsize=11)
        ax_bar.legend(
            facecolor=CHART_BG, labelcolor=TEXT_COLOR,
            framealpha=0.8, fontsize=10, edgecolor="#99cc99",
        )

    ax_bar.set_title("Last 7 Days by Platform", color=TEXT_COLOR, fontsize=14, fontweight="bold", pad=14)
    fig.suptitle("Reasons to Say No - Usage Stats", color=TEXT_COLOR, fontsize=15, fontweight="bold", y=1.01)
    plt.tight_layout()

    buf = io.BytesIO()
    buf.name = "rtsn-stats.png"
    plt.savefig(buf, format="png", dpi=130, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    return buf


# ── Persistent reason view ────────────────────────────────────────────────────
# A single instance is registered with the bot on startup.
# All Regenerate / Add-to-Fav button presses route here regardless of which
# message triggered them; callbacks look up state from SQLite by message ID.

class PersistentReasonView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(
        label="🔄 Regenerate",
        style=discord.ButtonStyle.secondary,
        custom_id="rtsn:regen",
    )
    async def regen(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer()
        reason = await pg.get_random_reason()
        if not reason:
            await interaction.followup.send(
                "❌ Couldn't reach the database right now - try again in a moment.",
                ephemeral=True,
            )
            return

        embed      = make_reason_embed(reason)
        channel_id = interaction.channel_id or 0
        await interaction.edit_original_response(embed=embed)
        db.upsert_active_button(
            interaction.message.id, channel_id,
            interaction.user.id, reason["id"], reason["reason"],
        )
        asyncio.create_task(pg.log_stat("discord"))

    @discord.ui.button(
        label="⭐ Add to Fav",
        style=discord.ButtonStyle.primary,
        custom_id="rtsn:addfav",
    )
    async def addfav(self, interaction: discord.Interaction, button: discord.ui.Button):
        channel_id = interaction.channel_id or 0
        row = db.get_active_button(interaction.message.id, channel_id)
        if not row:
            await interaction.response.send_message(
                "❌ Couldn't find the reason data - try `/no` again.", ephemeral=True
            )
            return

        saved = db.save_favourite(interaction.user.id, row["reason_id"], row["reason_text"])
        msg   = "⭐ Saved to your favourites!" if saved else "Already in your favourites!"
        await interaction.response.send_message(msg, ephemeral=True)


# ── Favourites pager ──────────────────────────────────────────────────────────

def build_favs_page(
    user_id: int, page: int
) -> tuple[discord.Embed, discord.ui.View | None]:
    total  = db.count_favourites(user_id)
    offset = page * FAVS_PAGE_SIZE
    favs   = db.get_favourites(user_id, limit=FAVS_PAGE_SIZE, offset=offset)

    if not favs and page == 0:
        embed = discord.Embed(
            title="📋 Your Favourites",
            description=(
                "Nothing saved yet.\n\n"
                "Use `/no` to get a reason, then tap **⭐ Add to Fav** to keep it here."
            ),
            color=EMBED_COLOR,
        )
        return embed, None

    lines = [f"**{offset + i + 1}.** *{fav['reason_text']}*" for i, fav in enumerate(favs)]
    total_pages = max(1, (total + FAVS_PAGE_SIZE - 1) // FAVS_PAGE_SIZE)

    embed = discord.Embed(
        title=f"📋 Your Favourites  ({total} total)",
        description="\n\n".join(lines),
        color=EMBED_COLOR,
    )
    embed.set_footer(text=f"Page {page + 1} / {total_pages}")
    return embed, FavsView(user_id, page, total, favs)


class FavsView(discord.ui.View):
    def __init__(self, user_id: int, page: int, total: int, favs: list[dict]):
        super().__init__(timeout=300)
        offset = page * FAVS_PAGE_SIZE

        for row_idx, fav in enumerate(favs):
            short = fav["reason_text"][:38] + ("…" if len(fav["reason_text"]) > 38 else "")
            self.add_item(UnfavButton(user_id, fav["reason_id"], short, page, row=row_idx))

        nav_row = min(len(favs), 4)
        if page > 0:
            self.add_item(FavNavButton("◀ Prev", user_id, page - 1, nav_row))
        if offset + FAVS_PAGE_SIZE < total:
            self.add_item(FavNavButton("Next ▶", user_id, page + 1, nav_row))


class UnfavButton(discord.ui.Button):
    def __init__(self, user_id: int, reason_id: int, short_text: str, page: int, row: int):
        super().__init__(
            label=f"🗑️ {short_text}",
            style=discord.ButtonStyle.danger,
            row=row,
        )
        self.user_id   = user_id
        self.reason_id = reason_id
        self.page      = page

    async def callback(self, interaction: discord.Interaction):
        if interaction.user.id != self.user_id:
            await interaction.response.send_message(
                "These aren't your favourites!", ephemeral=True
            )
            return
        db.remove_favourite(self.user_id, self.reason_id)
        await interaction.response.defer()
        embed, view = build_favs_page(self.user_id, self.page)
        await interaction.edit_original_response(embed=embed, view=view)


class FavNavButton(discord.ui.Button):
    def __init__(self, label: str, user_id: int, target_page: int, row: int):
        super().__init__(label=label, style=discord.ButtonStyle.secondary, row=row)
        self.user_id     = user_id
        self.target_page = target_page

    async def callback(self, interaction: discord.Interaction):
        if interaction.user.id != self.user_id:
            await interaction.response.send_message(
                "These aren't your favourites!", ephemeral=True
            )
            return
        await interaction.response.defer()
        embed, view = build_favs_page(self.user_id, self.target_page)
        await interaction.edit_original_response(embed=embed, view=view)


# ── Bot ───────────────────────────────────────────────────────────────────────

intents = discord.Intents.default()


class RtsnBot(commands.Bot):
    def __init__(self):
        super().__init__(command_prefix=commands.when_mentioned, intents=intents)

    async def setup_hook(self):
        await pg.connect(SUPABASE_URL, SUPABASE_KEY)
        self.add_view(PersistentReasonView())  # register persistent handler inside the event loop
        await self.tree.sync()
        logger.info("Slash commands synced")

    async def on_ready(self):
        logger.info("Logged in as %s (ID: %s)", self.user, self.user.id)
        await self._update_presence()

    async def on_guild_join(self, guild: discord.Guild):
        await self._update_presence()

    async def on_guild_remove(self, guild: discord.Guild):
        await self._update_presence()

    async def _update_presence(self):
        count = len(self.guilds)
        await self.change_presence(
            activity=discord.Game(name=f"saying NO to {count} guild{'s' if count != 1 else ''}")
        )


bot = RtsnBot()


# ── /no ───────────────────────────────────────────────────────────────────────

@bot.tree.command(name="no", description="Get a random reason to say no")
@app_commands.describe(
    mention="Ping a user along with the reason",
    count="Number of reasons to get at once (max 20)",
)
async def cmd_no(
    interaction: discord.Interaction,
    mention: discord.User | None = None,
    count: app_commands.Range[int, 1, 20] | None = None,
):
    await interaction.response.defer()
    content = mention.mention if mention else None

    if count and count > 1:
        reasons = await pg.get_random_reasons(count)
        if not reasons:
            await interaction.followup.send(
                "❌ Couldn't reach the database right now - try again in a moment."
            )
            return
        embed = make_reasons_embed(reasons)
        await interaction.followup.send(content=content, embed=embed)
        for _ in reasons:
            asyncio.create_task(pg.log_stat("discord"))
        return

    reason = await pg.get_random_reason()
    if not reason:
        await interaction.followup.send(
            "❌ Couldn't reach the database right now - try again in a moment."
        )
        return

    embed = make_reason_embed(reason)
    view  = PersistentReasonView()
    msg   = await interaction.followup.send(content=content, embed=embed, view=view, wait=True)
    db.upsert_active_button(
        msg.id, interaction.channel_id or 0,
        interaction.user.id, reason["id"], reason["reason"],
    )
    asyncio.create_task(pg.log_stat("discord"))


# ── /myfavs ───────────────────────────────────────────────────────────────────

@bot.tree.command(name="myfavs", description="Browse your saved favourite reasons")
async def cmd_myfavs(interaction: discord.Interaction):
    await interaction.response.defer()
    embed, view = build_favs_page(interaction.user.id, 0)
    await interaction.followup.send(embed=embed, view=view)


# ── /stats ────────────────────────────────────────────────────────────────────

@bot.tree.command(name="stats", description="View cross-platform usage statistics")
async def cmd_stats(interaction: discord.Interaction):
    await interaction.response.defer()

    totals = await pg.get_total_stats()
    if totals["total"] == 0:
        await interaction.followup.send(
            "📊 No stats recorded yet - use `/no` to get started!"
        )
        return

    by_platform = await pg.get_stats_by_platform()
    by_day      = await pg.get_stats_by_day(7)
    img         = await asyncio.to_thread(build_stats_chart, by_platform, by_day, totals)

    embed = discord.Embed(title="📊 Usage Statistics (all time)", color=EMBED_COLOR)
    embed.add_field(name="Total Fetches", value=f"{totals['total']:,}", inline=False)
    embed.add_field(name="🌐 Web App",  value=f"{totals['webapp']:,}",   inline=True)
    embed.add_field(name="✈️ Telegram", value=f"{totals['telegram']:,}", inline=True)
    embed.add_field(name="🎮 Discord",  value=f"{totals['discord']:,}",  inline=True)
    embed.add_field(name="🔌 API",      value=f"{totals['api']:,}",      inline=True)
    embed.set_image(url="attachment://rtsn-stats.png")

    file = discord.File(img, filename="rtsn-stats.png")
    await interaction.followup.send(embed=embed, file=file)


# ── /help ─────────────────────────────────────────────────────────────────────

@bot.tree.command(name="help", description="About Reasons to Say No and available commands")
async def cmd_help(interaction: discord.Interaction):
    await interaction.response.defer()

    count = await pg.get_reason_count()
    embed = discord.Embed(
        title="Reasons to Say No",
        description=(
            f"An open project by **Augy** / UwU Apps.\n\n"
            f"There are currently **{count:,}** reasons in the database, "
            f"fetched live on every request.\n\n"
            f"📖 The API is free and open for anyone to use.\n\n"
            f"**Commands**\n"
            f"🎲 `/no` - Get a random reason to say no\n"
            f"👤 `/no mention:@user` - Ping someone with a reason\n"
            f"🔢 `/no count:5` - Get multiple reasons at once (max 20)\n"
            f"⭐ `/myfavs` - Browse and manage your saved favourites\n"
            f"📊 `/stats` - Cross-platform usage chart\n"
            f"❓ `/help` - Show this message"
        ),
        color=EMBED_COLOR,
    )
    view = discord.ui.View()
    view.add_item(discord.ui.Button(label="📖 API Docs", url=API_DOCS_URL, style=discord.ButtonStyle.link))
    view.add_item(discord.ui.Button(label="🌐 Web App",  url=WEBAPP_URL,   style=discord.ButtonStyle.link))
    await interaction.followup.send(embed=embed, view=view)


# ── Entry point ───────────────────────────────────────────────────────────────

async def main():
    async with bot:
        await bot.start(DISCORD_TOKEN)


if __name__ == "__main__":
    asyncio.run(main())
