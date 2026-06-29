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
        self.api = FootballHubAPI(hass, entry.data["api_key"])

        self.competition = COMPETITIONS[entry.data["competition"]]
        self.season = entry.data["season"]

        super().__init__(
            hass,
            _LOGGER,
            name=f"Football Hub - {self.competition['name']}",
            update_interval=timedelta(seconds=60),
        )

    async def _async_update_data(self):
        """Fetch all competition data."""

        try:
            return await self.api.get_competition_data(
                self.competition["league_id"],
                self.season,
            )

        except Exception as err:
            raise UpdateFailed(err) from err
