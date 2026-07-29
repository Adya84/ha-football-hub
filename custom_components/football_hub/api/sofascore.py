"""Small SofaScore fallback for competitions unavailable from FM.

FM remains Football Hub's primary provider.  This module is deliberately
limited to explicitly mapped competitions and returns the same compact shapes
used by the existing frontend.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from time import monotonic
from typing import Any

from homeassistant.helpers.aiohttp_client import async_get_clientsession

SOFASCORE_BASE = "https://www.sofascore.com/api/v1"
SOFASCORE_TOURNAMENTS = {
    111: 13820,  # Cymru North
    112: 13821,  # Cymru South
}
STATIC_TTL = 6 * 60 * 60


class SofaScoreFallback:
    """Fetch only competitions that FM does not cover."""

    def __init__(self, hass):
        self.session = async_get_clientsession(hass)
        self._cache: dict[str, tuple[float, Any]] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    @staticmethod
    def supports(league_id: Any) -> bool:
        try:
            return int(league_id) in SOFASCORE_TOURNAMENTS
        except (TypeError, ValueError):
            return False

    async def _get(self, path: str, ttl: int = STATIC_TTL) -> dict:
        cached = self._cache.get(path)
        if cached and monotonic() - cached[0] < ttl:
            return cached[1]
        lock = self._locks.setdefault(path, asyncio.Lock())
        async with lock:
            cached = self._cache.get(path)
            if cached and monotonic() - cached[0] < ttl:
                return cached[1]
            async with self.session.get(
                f"{SOFASCORE_BASE}/{path}",
                headers={"Accept": "application/json", "User-Agent": "Football-Hub/0.4"},
                timeout=30,
            ) as response:
                response.raise_for_status()
                data = await response.json(content_type=None)
            self._cache[path] = (monotonic(), data if isinstance(data, dict) else {})
            return self._cache[path][1]

    async def _season(self, league_id: Any, requested: Any) -> tuple[int, int]:
        tournament = SOFASCORE_TOURNAMENTS[int(league_id)]
        data = await self._get(f"unique-tournament/{tournament}/seasons", 24 * 60 * 60)
        seasons = data.get("seasons") or []
        requested_text = str(requested or "")
        requested_year = requested_text[:4]
        chosen = next(
            (item for item in seasons if requested_text and requested_text in str(item.get("name") or "")),
            None,
        ) or next(
            (item for item in seasons if requested_year and requested_year in str(item.get("name") or "")),
            None,
        ) or (seasons[0] if seasons else None)
        if not chosen or not chosen.get("id"):
            raise ValueError(f"No SofaScore season found for tournament {tournament}")
        return tournament, int(chosen["id"])

    @staticmethod
    def _team(team: dict) -> dict:
        team_id = team.get("id")
        return {
            "id": team_id,
            "name": team.get("name") or team.get("shortName") or "Unknown",
            "logo": f"https://img.sofascore.com/api/v1/team/{team_id}/image" if team_id else "",
        }

    @classmethod
    def _fixture(cls, event: dict) -> dict:
        home = event.get("homeTeam") or {}
        away = event.get("awayTeam") or {}
        status = event.get("status") or {}
        status_type = str(status.get("type") or "").casefold()
        status_code = str(status.get("code") or "")
        finished = status_type == "finished" or status_code == "100"
        live = status_type in {"inprogress", "halftime"} or status_code in {"6", "7", "31"}
        start = int(event.get("startTimestamp") or 0)
        home_score = (event.get("homeScore") or {}).get("current")
        away_score = (event.get("awayScore") or {}).get("current")
        tournament = event.get("tournament") or {}
        unique = tournament.get("uniqueTournament") or {}
        venue = event.get("venue") or {}
        city = venue.get("city") or {}
        city_name = city.get("name") if isinstance(city, dict) else str(city)
        return {
            "fixture": {
                "id": event.get("id"),
                "date": datetime.fromtimestamp(start, timezone.utc).isoformat() if start else "",
                "timestamp": start,
                "status": {
                    "long": status.get("description") or status.get("type") or "Scheduled",
                    "short": "FT" if finished else "LIVE" if live else "NS",
                    "elapsed": status.get("period") if live else None,
                },
                "venue": {"name": venue.get("name") or "", "city": city_name or ""},
            },
            "league": {"id": unique.get("id"), "name": unique.get("name") or tournament.get("name") or "", "country_code": "WAL"},
            "teams": {"home": cls._team(home), "away": cls._team(away)},
            "goals": {"home": home_score, "away": away_score},
            "score": {"fulltime": {"home": home_score, "away": away_score}},
        }

    async def get_fixtures(self, league_id: Any, season: Any) -> list[dict]:
        tournament, season_id = await self._season(league_id, season)
        events: dict[str, dict] = {}
        for direction in ("last", "next"):
            for page in range(8):
                data = await self._get(
                    f"unique-tournament/{tournament}/season/{season_id}/events/{direction}/{page}"
                )
                batch = data.get("events") or []
                for event in batch:
                    if event.get("id") is not None:
                        events[str(event["id"])] = event
                if not data.get("hasNextPage") or not batch:
                    break
        return sorted(
            (self._fixture(event) for event in events.values()),
            key=lambda item: (item.get("fixture") or {}).get("timestamp") or 0,
        )

    async def get_standings(self, league_id: Any, season: Any) -> list[dict]:
        tournament, season_id = await self._season(league_id, season)
        data = await self._get(
            f"unique-tournament/{tournament}/season/{season_id}/standings/total"
        )
        groups = data.get("standings") or []
        rows = []
        for group in groups:
            for index, item in enumerate(group.get("rows") or [], 1):
                team = self._team(item.get("team") or {})
                rows.append({
                    "rank": item.get("position") or index,
                    "team": team,
                    "points": item.get("points") or 0,
                    "goalsDiff": item.get("scoreDiffFormatted") or item.get("scoreDiff") or 0,
                    "all": {
                        "played": item.get("matches") or 0,
                        "win": item.get("wins") or 0,
                        "draw": item.get("draws") or 0,
                        "lose": item.get("losses") or 0,
                        "goals": {"for": item.get("scoresFor") or 0, "against": item.get("scoresAgainst") or 0},
                    },
                })
        return [{"league": {"standings": [rows]}}] if rows else []
