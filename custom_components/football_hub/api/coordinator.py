"""Football Hub data coordinator with independent dataset refresh periods."""

from __future__ import annotations

import asyncio
import copy
from datetime import datetime, timezone
from datetime import timedelta
import logging
from time import monotonic
from typing import Any, Awaitable

from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from ..competitions import COMPETITIONS
from ..engine import FootballHubEngine
from .api import FootballHubAPI

_LOGGER = logging.getLogger(__name__)

LIVE_TTL = 10
FIXTURES_TTL = 6 * 60 * 60
STANDINGS_TTL = 6 * 60 * 60
PLAYERS_TTL = 12 * 60 * 60
LIVE_EVENTS_TTL = 10
LIVE_STATISTICS_TTL = 15
LINEUPS_TTL = 5 * 60
LIVE_RATE_LIMIT_BACKOFF = 30
PRE_LIVE_WINDOW = timedelta(minutes=5)
POST_LIVE_WINDOW = timedelta(hours=3, minutes=15)
PRE_LIVE_PROMOTION_END = timedelta(minutes=20)


class FootballHubCoordinator(DataUpdateCoordinator):
    """Coordinate Football Hub data updates."""

    def __init__(self, hass, entry):
        """Initialise the coordinator."""
        self.entry = entry
        self.api = FootballHubAPI(hass, entry.data["api_key"])
        self.competition_key = entry.options.get("active_competition", entry.data["competition"])
        self.competition = COMPETITIONS[self.competition_key]
        self.season = entry.data["season"]
        self.engine = FootballHubEngine()
        self._cache: dict[str, Any] = {}
        self._updated_at: dict[str, float] = {}
        self._live_rate_limited_until = 0.0
        self.supported_team = entry.options.get("supported_team", "")

        super().__init__(
            hass,
            _LOGGER,
            name=f"Football Hub - {self.competition['name']}",
            update_interval=timedelta(seconds=30),
        )

    def _is_stale(self, key: str, ttl: int) -> bool:
        """Return whether a cached dataset needs refreshing."""
        if key not in self._cache or key not in self._updated_at:
            return True
        return monotonic() - self._updated_at[key] >= ttl

    def _store(self, key: str, value: Any) -> None:
        """Store a refreshed dataset."""
        self._cache[key] = value
        self._updated_at[key] = monotonic()

    def _live_poll_window_active(self) -> bool:
        """Poll live data from five minutes before kickoff through match end."""
        now = datetime.now(timezone.utc)
        for item in self._cache.get("fixtures", []) or []:
            fixture = (item or {}).get("fixture", {}) or {}
            status = (fixture.get("status", {}) or {}).get("short")
            if status in {"1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"}:
                return True
            value = fixture.get("date")
            if not value:
                continue
            try:
                kickoff = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            except ValueError:
                continue
            if kickoff - PRE_LIVE_WINDOW <= now <= kickoff + POST_LIVE_WINDOW:
                return True
        return not self._cache.get("fixtures")

    def _pre_live_matches(self) -> list[dict[str, Any]]:
        """Expose matches as awaiting live data shortly before kickoff."""
        now = datetime.now(timezone.utc)
        waiting: list[dict[str, Any]] = []
        for item in self._cache.get("fixtures", []) or []:
            fixture = (item or {}).get("fixture", {}) or {}
            status = (fixture.get("status", {}) or {}).get("short")
            if status not in {"NS", "TBD"}:
                continue
            value = fixture.get("date")
            if not value:
                continue
            try:
                kickoff = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            except ValueError:
                continue
            if not kickoff - PRE_LIVE_WINDOW <= now <= kickoff + PRE_LIVE_PROMOTION_END:
                continue
            promoted = copy.deepcopy(item)
            promoted_fixture = promoted.setdefault("fixture", {})
            promoted_fixture["status"] = {
                "short": "LIVE",
                "long": "Awaiting kickoff API data",
                "elapsed": None,
            }
            promoted["awaiting_live_api_data"] = True
            waiting.append(promoted)
        return waiting

    async def async_set_competition(self, competition_key: str) -> None:
        """Switch the active competition and refresh every dataset."""
        if competition_key not in COMPETITIONS:
            raise ValueError(f"Unknown competition: {competition_key}")
        if competition_key == self.competition_key:
            return
        self.competition_key = competition_key
        self.competition = COMPETITIONS[competition_key]
        self._cache.clear()
        self._updated_at.clear()
        self._live_rate_limited_until = 0.0
        empty_data = {
            "live": [],
            "fixtures": [],
            "standings": [],
            "top_scorers": [],
            "top_assists": [],
            "live_events": [],
            "live_statistics": [],
            "live_lineups": [],
            "live_details": {},
        }
        self.engine.update(empty_data)
        options = {**self.entry.options, "active_competition": competition_key}
        self.hass.config_entries.async_update_entry(self.entry, options=options)
        self.async_set_updated_data(empty_data)
        await self.async_request_refresh()

    async def async_set_supported_team(self, team: str) -> None:
        """Persist the team whose live match receives detailed API polling."""
        self.supported_team = str(team or "").strip()
        options = {**self.entry.options, "supported_team": self.supported_team}
        self.hass.config_entries.async_update_entry(self.entry, options=options)
        await self.async_request_refresh()

    async def _async_update_data(self):
        """Refresh only datasets whose cache period has expired."""
        league_id = self.competition["league_id"]
        requests: list[tuple[str, Awaitable[Any]]] = []

        if self._is_stale("live", LIVE_TTL) and self._live_poll_window_active():
            requests.append(("live", self.api.get_live(league_id, self.season)))
        if self._is_stale("fixtures", FIXTURES_TTL):
            requests.append(("fixtures", self.api.get_fixtures(league_id, self.season)))
        if self._is_stale("standings", STANDINGS_TTL):
            requests.append(("standings", self.api.get_standings(league_id, self.season)))
        if self._is_stale("top_scorers", PLAYERS_TTL):
            requests.append(
                ("top_scorers", self.api.get_top_scorers(league_id, self.season))
            )
        if self._is_stale("top_assists", PLAYERS_TTL):
            requests.append(
                ("top_assists", self.api.get_top_assists(league_id, self.season))
            )

        if requests:
            results = await asyncio.gather(
                *(request for _, request in requests), return_exceptions=True
            )
            failures: list[str] = []

            for (key, _), result in zip(requests, results, strict=True):
                if isinstance(result, Exception):
                    failures.append(f"{key}: {result}")
                    _LOGGER.warning("Football Hub %s refresh failed: %s", key, result)
                else:
                    self._store(key, result)

            # The integration cannot work without fixture data on the first load.
            if failures and "fixtures" not in self._cache:
                raise UpdateFailed("; ".join(failures))

        raw_live = self._cache.get("live", [])
        if not raw_live:
            raw_live = self._pre_live_matches()
        live_fixture_ids: list[int] = []
        supported_fixture_id = None
        for item in raw_live:
            if not isinstance(item, dict):
                continue
            fixture_id = (item.get("fixture") or {}).get("id")
            if fixture_id:
                live_fixture_ids.append(fixture_id)
                teams = (item.get("teams") or {}) if isinstance(item, dict) else {}
                home_name = str((teams.get("home") or {}).get("name") or "").casefold()
                away_name = str((teams.get("away") or {}).get("name") or "").casefold()
                if self.supported_team.casefold() in {home_name, away_name}:
                    supported_fixture_id = fixture_id

        detail_fixture_ids = [supported_fixture_id or live_fixture_ids[0]] if live_fixture_ids else []

        # World Cup-style per-fixture live caches. This allows the frontend to
        # select any live match while the remaining games stay score-only.
        if live_fixture_ids and monotonic() >= self._live_rate_limited_until:
            detail_requests: list[tuple[str, int, str, Awaitable[Any]]] = []
            for fixture_id in detail_fixture_ids:
                event_key = f"live_events:{fixture_id}"
                stats_key = f"live_statistics:{fixture_id}"
                lineup_key = f"live_lineups:{fixture_id}"
                if self._is_stale(event_key, LIVE_EVENTS_TTL):
                    detail_requests.append((event_key, fixture_id, "events", self.api.get_fixture_events(fixture_id)))
                if self._is_stale(stats_key, LIVE_STATISTICS_TTL):
                    detail_requests.append((stats_key, fixture_id, "statistics", self.api.get_fixture_statistics(fixture_id)))
                if self._is_stale(lineup_key, LINEUPS_TTL):
                    detail_requests.append((lineup_key, fixture_id, "lineups", self.api.get_fixture_lineups(fixture_id)))

            if detail_requests:
                detail_results = await asyncio.gather(
                    *(request for _, _, _, request in detail_requests),
                    return_exceptions=True,
                )
                for (cache_key, fixture_id, kind, _), result in zip(
                    detail_requests, detail_results, strict=True
                ):
                    if isinstance(result, Exception):
                        if "rate limit" in str(result).lower() or "429" in str(result):
                            self._live_rate_limited_until = monotonic() + LIVE_RATE_LIMIT_BACKOFF
                        _LOGGER.warning(
                            "Football Hub live %s refresh failed for fixture %s: %s",
                            kind,
                            fixture_id,
                            result,
                        )
                    else:
                        self._store(cache_key, result)

        live_details: dict[str, dict[str, Any]] = {}
        for fixture_id in detail_fixture_ids:
            live_details[str(fixture_id)] = {
                "events": self._cache.get(f"live_events:{fixture_id}", []),
                "statistics": self._cache.get(f"live_statistics:{fixture_id}", []),
                "lineups": self._cache.get(f"live_lineups:{fixture_id}", []),
            }

        primary_fixture_id = live_fixture_ids[0] if live_fixture_ids else None

        data = {
            "live": raw_live,
            "fixtures": self._cache.get("fixtures", []),
            "standings": self._cache.get("standings", []),
            "top_scorers": self._cache.get("top_scorers", []),
            "top_assists": self._cache.get("top_assists", []),
            "live_events": live_details.get(str(primary_fixture_id), {}).get("events", []),
            "live_statistics": live_details.get(str(primary_fixture_id), {}).get("statistics", []),
            "live_lineups": live_details.get(str(primary_fixture_id), {}).get("lineups", []),
            "live_details": live_details,
        }
        self.engine.update(data)
        return data
