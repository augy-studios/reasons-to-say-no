# Supabase client - reads no_reasons, writes/reads no_stats.

import asyncio
import logging
import random
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from supabase import AsyncClient, create_async_client

logger = logging.getLogger("rtsn-discord.pg")


class PgDatabase:
    def __init__(self):
        self._client: AsyncClient | None = None

    async def connect(self, url: str, key: str):
        self._client = await create_async_client(url, key)
        logger.info("Supabase client ready")

    # ── no_reasons ────────────────────────────────────────────────────────────

    async def get_random_reason(self) -> dict | None:
        # PostgREST has no ORDER BY RANDOM(), so count first then offset randomly.
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

    async def get_random_reasons(self, n: int) -> list[dict]:
        try:
            count_res = (
                await self._client.table("no_reasons")
                .select("id", count="exact")
                .limit(0)
                .execute()
            )
            total = count_res.count or 0
            if total == 0:
                return []

            n       = min(n, total)
            offsets = random.sample(range(total), n)

            results = await asyncio.gather(
                *[self._fetch_at_offset(off) for off in offsets],
                return_exceptions=True,
            )
            return [r for r in results if isinstance(r, dict)]
        except Exception as exc:
            logger.error("get_random_reasons failed: %s", exc)
            return []

    async def _fetch_at_offset(self, offset: int) -> dict | None:
        res = (
            await self._client.table("no_reasons")
            .select("id, reason")
            .limit(1)
            .offset(offset)
            .execute()
        )
        return res.data[0] if res.data else None

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
        try:
            await self._client.table("no_stats").insert({"platform": platform}).execute()
        except Exception as exc:
            logger.error("log_stat failed: %s", exc)

    async def _fetch_all_stats(self, since: str | None = None) -> list[dict]:
        # PostgREST caps unpaginated selects at 1000 rows, so page through with .range().
        rows: list[dict] = []
        page_size = 1000
        start = 0
        while True:
            query = self._client.table("no_stats").select("platform, created_at")
            if since is not None:
                query = query.gte("created_at", since)
            res = await query.range(start, start + page_size - 1).execute()
            rows.extend(res.data)
            if len(res.data) < page_size:
                break
            start += page_size
        return rows

    async def get_stats_by_platform(self) -> list[dict]:
        try:
            rows = await self._fetch_all_stats()
            counts = Counter(row["platform"] for row in rows)
            return [
                {"platform": p, "count": c}
                for p, c in sorted(counts.items(), key=lambda x: -x[1])
            ]
        except Exception as exc:
            logger.error("get_stats_by_platform failed: %s", exc)
            return []

    async def get_stats_by_day(self, days: int = 7) -> list[dict]:
        try:
            since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
            rows = await self._fetch_all_stats(since=since)

            day_counts: dict = defaultdict(lambda: defaultdict(int))
            for row in rows:
                day = row["created_at"][:10]
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
        try:
            rows = await self._fetch_all_stats()
            counts = Counter(row["platform"] for row in rows)
            return {
                "total":    sum(counts.values()),
                "webapp":   counts.get("webapp",   0),
                "telegram": counts.get("telegram", 0),
                "discord":  counts.get("discord",  0),
                "api":      counts.get("api",      0),
            }
        except Exception as exc:
            logger.error("get_total_stats failed: %s", exc)
            return {"total": 0, "webapp": 0, "telegram": 0, "discord": 0, "api": 0}

    async def close(self):
        pass  # supabase-py manages its own session
