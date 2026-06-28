"""Football Hub Data Coordinator."""

from __future__ import annotations

from datetime import timedelta
import logging

from homeassistant.helpers.update_coordinator import (
    DataUpdateCoordinator,
    UpdateFailed,
)

from .api import FootballHubAPI
from ..competitions import COMPETITIONS

_LOGGER = logging.getLogger(__name__)


class FootballHubCoordinator(DataUpdateCoordinator):
    """Coordinate Football Hub data updates."""

    def __init__(self, hass, entry):
        """Initialise the coordinator."""

        self.entry = entry

        self.api = FootballHubAPI(entry.data["api_key"])

        self.competition = COMPETITIONS[entry.data["competition"]]
        self.season = entry.data["season"]

        super().__init__(
            hass,
            _LOGGER,
            name="Football Hub",
            update_interval=timedelta(seconds=60),
        )

    async def _async_update_data(self):
        """Fetch all data."""

        try:
            league_id = self.competition["league_id"]

            return {
                "live": await self.api.get_live(
                    league_id,
                    self.season,
                ),
                "fixtures": await self.api.get_fixtures(
                    league_id,
                    self.season,
                ),
                "standings": await self.api.get_standings(
                    league_id,
                    self.season,
                ),
            }

        except Exception as err:
            raise UpdateFailed(err) from err
