"""Welsh league data read from Football Hub's GitHub cache.

The upstream site blocks direct Home Assistant HTTP clients. A scheduled
repository workflow refreshes compact JSON files, and Home Assistant reads
those public cache files without contacting the upstream provider.
"""
from __future__ import annotations

from datetime import datetime, timezone
from time import monotonic
from typing import Any

from homeassistant.helpers.aiohttp_client import async_get_clientsession

RAW_BASE = "https://raw.githubusercontent.com/Adya84/ha-football-hub/main/welsh_data"
WELSH_CACHE_FILES = {
    111: "cymru_north.json",
    112: "cymru_south.json",
}
CACHE_TTL = 4 * 60


class SofaScoreFallback:
    """Read Welsh-only cached fixtures and standings."""

    def __init__(self, hass):
        self.session = async_get_clientsession(hass)
        self._cache: dict[int, tuple[float, dict]] = {}

    @staticmethod
    def supports(league_id: Any) -> bool:
        try:
            return int(league_id) in WELSH_CACHE_FILES
        except (TypeError, ValueError):
            return False

    async def _data(self, league_id: Any) -> dict:
        league_id = int(league_id)
        cached = self._cache.get(league_id)
        if cached and monotonic() - cached[0] < CACHE_TTL:
            return cached[1]
        filename = WELSH_CACHE_FILES[league_id]
        async with self.session.get(
            f"{RAW_BASE}/{filename}",
            headers={"Accept": "application/json", "User-Agent": "Football-Hub/0.4"},
            timeout=30,
        ) as response:
            response.raise_for_status()
            data = await response.json(content_type=None)
        safe = data if isinstance(data, dict) else {}
        self._cache[league_id] = (monotonic(), safe)
        return safe

    @staticmethod
    def _team(team: dict) -> dict:
        team_id = team.get("id")
        return {
            "id": team_id,
            "name": team.get("name") or team.get("shortName") or "Unknown",
            "logo": (
                f"https://img.sofascore.com/api/v1/team/{team_id}/image"
                if team_id and not str(team_id).startswith("seed-")
                else ""
            ),
        }

    @classmethod
    def _fixture(cls, event: dict) -> dict:
        home = event.get("homeTeam") or event.get("home") or {}
        away = event.get("awayTeam") or event.get("away") or {}
        status = event.get("status") or {}
        status_type = str(status.get("type") or "").casefold()
        status_code = str(status.get("code") or "")
        finished = status_type == "finished" or status_code == "100"
        live = status_type in {"inprogress", "halftime"} or status_code in {"6", "7", "31"}
        start = int(event.get("startTimestamp") or event.get("timestamp") or 0)
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
            "league": {
                "id": unique.get("id") or tournament.get("id"),
                "name": unique.get("name") or tournament.get("name") or "",
                "country_code": "WAL",
            },
            "teams": {"home": cls._team(home), "away": cls._team(away)},
            "goals": {"home": home_score, "away": away_score},
            "score": {"fulltime": {"home": home_score, "away": away_score}},
        }

    async def get_fixtures(self, league_id: Any, season: Any) -> list[dict]:
        data = await self._data(league_id)
        events = data.get("events") or []
        return sorted(
            (self._fixture(event) for event in events if isinstance(event, dict)),
            key=lambda item: (item.get("fixture") or {}).get("timestamp") or 0,
        )

    async def get_standings(self, league_id: Any, season: Any) -> list[dict]:
        data = await self._data(league_id)
        source_rows = data.get("standings") or data.get("teams") or []
        rows = []
        for index, item in enumerate(source_rows, 1):
            team = self._team(item.get("team") or item)
            rows.append({
                "rank": item.get("position") or item.get("rank") or index,
                "team": team,
                "points": item.get("points") or 0,
                "goalsDiff": item.get("scoreDiffFormatted") or item.get("scoreDiff") or 0,
                "all": {
                    "played": item.get("matches") or item.get("played") or 0,
                    "win": item.get("wins") or item.get("win") or 0,
                    "draw": item.get("draws") or item.get("draw") or 0,
                    "lose": item.get("losses") or item.get("lose") or 0,
                    "goals": {
                        "for": item.get("scoresFor") or item.get("goalsFor") or 0,
                        "against": item.get("scoresAgainst") or item.get("goalsAgainst") or 0,
                    },
                },
            })
        return [{"league": {"standings": [rows]}}] if rows else []
