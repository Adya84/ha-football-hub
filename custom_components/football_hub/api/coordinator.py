"""Football Hub data coordinator with independent dataset refresh periods."""

from __future__ import annotations

import asyncio
from datetime import timedelta
import logging
from time import monotonic
from typing import Any, Awaitable

from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from ..competitions import COMPETITIONS
from ..engine import FootballHubEngine
from .api import FootballHubAPI

_LOGGER = logging.getLogger(__name__)

LIVE_TTL = 30
FIXTURES_TTL = 6 * 60 * 60
STANDINGS_TTL = 6 * 60 * 60
PLAYERS_TTL = 12 * 60 * 60


class FootballHubCoordinator(DataUpdateCoordinator):
    """Coordinate Football Hub data updates."""

    def __init__(self, hass, entry):
        """Initialise the coordinator."""
        self.entry = entry
        self.api = FootballHubAPI(hass, entry.data["api_key"])
        self.competition = COMPETITIONS[entry.data["competition"]]
        self.season = entry.data["season"]
        self.engine = FootballHubEngine()
        self._cache: dict[str, Any] = {}
        self._updated_at: dict[str, float] = {}

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

    async def _async_update_data(self):
        """Refresh only datasets whose cache period has expired."""
        league_id = self.competition["league_id"]
        requests: list[tuple[str, Awaitable[Any]]] = []

        if self._is_stale("live", LIVE_TTL):
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

        data = {
            "live": self._cache.get("live", []),
            "fixtures": self._cache.get("fixtures", []),
            "standings": self._cache.get("standings", []),
            "top_scorers": self._cache.get("top_scorers", []),
            "top_assists": self._cache.get("top_assists", []),
        }
        self.engine.update(data)
        return data
