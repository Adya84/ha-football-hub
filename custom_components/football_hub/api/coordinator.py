"""Football Hub data coordinator with independent refresh intervals."""

from __future__ import annotations

import asyncio
from datetime import timedelta
import logging

from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from ..competitions import COMPETITIONS
from ..engine import FootballHubEngine
from ..engine.cache import FootballHubCache
from .api import FootballHubAPI

_LOGGER = logging.getLogger(__name__)

LIVE_TTL = 30
FIXTURES_TTL = 6 * 60 * 60
STANDINGS_TTL = 6 * 60 * 60
PLAYERS_TTL = 12 * 60 * 60


class FootballHubCoordinator(DataUpdateCoordinator):
    """Coordinate Football Hub data updates."""

    def __init__(self, hass, entry):
        self.entry = entry
        self.api = FootballHubAPI(hass, entry.data["api_key"])
        self.competition = COMPETITIONS[entry.data["competition"]]
        self.season = entry.data["season"]
        self.cache = FootballHubCache()
        self.engine = FootballHubEngine()

        super().__init__(
            hass,
            _LOGGER,
            name=f"Football Hub - {self.competition['name']}",
            update_interval=timedelta(seconds=30),
        )

    async def _async_update_data(self):
        """Refresh only datasets whose cache period has expired."""
        league_id = self.competition["league_id"]
        requests: list[tuple[str, asyncio.Future]] = []

        if self.cache.is_stale("live", LIVE_TTL):
            requests.append(("live", self.api.get_live(league_id, self.season)))
        if self.cache.is_stale("fixtures", FIXTURES_TTL):
            requests.append(("fixtures", self.api.get_fixtures(league_id, self.season)))
        if self.cache.is_stale("standings", STANDINGS_TTL):
            requests.append(("standings", self.api.get_standings(league_id, self.season)))
        if self.cache.is_stale("top_scorers", PLAYERS_TTL):
            requests.append(("top_scorers", self.api.get_top_scorers(league_id, self.season)))
        if self.cache.is_stale("top_assists", PLAYERS_TTL):
            requests.append(("top_assists", self.api.get_top_assists(league_id, self.season)))

        if requests:
            results = await asyncio.gather(
                *(request for _, request in requests), return_exceptions=True
            )
            failures = []
            for (key, _), result in zip(requests, results, strict=True):
                if isinstance(result, Exception):
                    failures.append(f"{key}: {result}")
                    _LOGGER.warning("Football Hub %s refresh failed: %s", key, result)
                else:
                    self.cache.set(key, result)

            if failures and not self.cache.get("fixtures"):
                raise UpdateFailed("; ".join(failures))

        data = {
            "live": self.cache.get("live", []),
            "fixtures": self.cache.get("fixtures", []),
            "standings": self.cache.get("standings", []),
            "top_scorers": self.cache.get("top_scorers", []),
            "top_assists": self.cache.get("top_assists", []),
        }
        self.engine.update(data)
        return data
