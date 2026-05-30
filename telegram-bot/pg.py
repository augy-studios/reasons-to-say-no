"""
Supabase client — reads no_reasons and writes/reads no_stats.
Uses the standard SUPABASE_URL + SUPABASE_SERVICE_KEY credentials.
"""

import logging
import random
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from supabase import AsyncClient, create_async_client

logger = logging.getLogger("rtsn-bot.pg")


class PgDatabase:
    def __init__(self):
        self._client: AsyncClient | None = None

    async def connect(self, url: str, key: str):
        self._client = await create_async_client(url, key)
        logger.info("Supabase client ready")

    # ── no_reasons ────────────────────────────────────────────────────────────

    async def get_random_reason(self) -> dict | None:
        """
        Fetch one random reason.
        PostgREST has no ORDER BY RANDOM(), so we count rows first then use
        a random offset — two fast indexed queries.
        """
        try:
            count_res = (
                await self._client.table("no_reasons")
                .select("id", count="exact")
                .limit(0)
                .execute()
            )
            total = count_res.count or 0
            if total == 0:
                return None

            offset = random.randint(0, total - 1)
            res = (
                await self._client.table("no_reasons")
                .select("id, reason")
                .limit(1)
                .offset(offset)
                .execute()
            )
            return res.data[0] if res.data else None
        except Exception as exc:
            logger.error("get_random_reason failed: %s", exc)
            return None

    async def get_reason_count(self) -> int:
        try:
            res = (
                await self._client.table("no_reasons")
                .select("id", count="exact")
                .limit(0)
                .execute()
            )
            return res.count or 0
        except Exception as exc:
            logger.error("get_reason_count failed: %s", exc)
            return 0

    # ── no_stats ──────────────────────────────────────────────────────────────

    async def log_stat(self, platform: str):
        """Insert a row into no_stats (platform must be webapp|telegram|discord)."""
        try:
            await self._client.table("no_stats").insert({"platform": platform}).execute()
        except Exception as exc:
            logger.error("log_stat failed: %s", exc)

    async def get_stats_by_platform(self) -> list[dict]:
        """All-time count grouped by platform, aggregated client-side."""
        try:
            res = await self._client.table("no_stats").select("platform").execute()
            counts = Counter(row["platform"] for row in res.data)
            return [
                {"platform": p, "count": c}
                for p, c in sorted(counts.items(), key=lambda x: -x[1])
            ]
        except Exception as exc:
            logger.error("get_stats_by_platform failed: %s", exc)
            return []

    async def get_stats_by_day(self, days: int = 7) -> list[dict]:
        """Per-day, per-platform counts for the last N days, aggregated client-side."""
        try:
            since = (
                datetime.now(timezone.utc) - timedelta(days=days)
            ).isoformat()
            res = (
                await self._client.table("no_stats")
                .select("platform, created_at")
                .gte("created_at", since)
                .execute()
            )

            day_counts: dict = defaultdict(lambda: defaultdict(int))
            for row in res.data:
                day = row["created_at"][:10]   # YYYY-MM-DD
                day_counts[day][row["platform"]] += 1

            result = []
            for day in sorted(day_counts):
                for platform, count in day_counts[day].items():
                    result.append({"day": day, "platform": platform, "count": count})
            return result
        except Exception as exc:
            logger.error("get_stats_by_day failed: %s", exc)
            return []

    async def get_total_stats(self) -> dict:
        """Grand totals per platform plus an overall sum."""
        try:
            res = await self._client.table("no_stats").select("platform").execute()
            counts = Counter(row["platform"] for row in res.data)
            return {
                "total":    sum(counts.values()),
                "webapp":   counts.get("webapp",   0),
                "telegram": counts.get("telegram", 0),
                "discord":  counts.get("discord",  0),
            }
        except Exception as exc:
            logger.error("get_total_stats failed: %s", exc)
            return {"total": 0, "webapp": 0, "telegram": 0, "discord": 0}
