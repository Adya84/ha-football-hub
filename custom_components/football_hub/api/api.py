"""API-Football client for Football Hub."""

from __future__ import annotations

import logging
from typing import Any

import aiohttp
from homeassistant.helpers.aiohttp_client import async_get_clientsession

_LOGGER = logging.getLogger(__name__)

API_BASE = "https://v3.football.api-sports.io"


class FootballHubAPIError(Exception):
    """Football Hub API error."""


class FootballHubAPI:
    """API-Football client."""

    def __init__(self, hass, api_key: str):
        self.hass = hass
        self.api_key = api_key
        self.session = async_get_clientsession(hass)

    async def request(self, endpoint: str, params: dict[str, Any] | None = None):
        """Send request to API-Football."""
        url = f"{API_BASE}/{endpoint}"

        headers = {
            "x-apisports-key": self.api_key,
        }

        try:
            async with self.session.get(
                url,
                headers=headers,
                params=params or {},
                timeout=aiohttp.ClientTimeout(total=30),
            ) as response:
                if response.status == 429:
                    raise FootballHubAPIError("API rate limit reached")

                if response.status >= 400:
                    text = await response.text()
                    raise FootballHubAPIError(
                        f"API request failed: {response.status} - {text}"
                    )

                data = await response.json()

        except aiohttp.ClientError as err:
            raise FootballHubAPIError(f"Connection error: {err}") from err

        if not isinstance(data, dict):
            raise FootballHubAPIError("Invalid API response")

        errors = data.get("errors")
        if errors:
            _LOGGER.warning("API-Football returned errors: %s", errors)

        return data.get("response", [])

    async def get_live(self, league_id: int, season: int):
        """Return live fixtures."""
        return await self.request(
            "fixtures",
            {
                "live": "all",
                "league": league_id,
                "season": season,
            },
        )

    async def get_fixtures(self, league_id: int, season: int):
        """Return all fixtures."""
        return await self.request(
            "fixtures",
            {
                "league": league_id,
                "season": season,
            },
        )

    async def get_standings(self, league_id: int, season: int):
        """Return standings."""
        return await self.request(
            "standings",
            {
                "league": league_id,
                "season": season,
            },
        )

    async def get_top_scorers(self, league_id: int, season: int):
        """Return top scorers."""
        return await self.request(
            "players/topscorers",
            {
                "league": league_id,
                "season": season,
            },
        )

    async def get_top_assists(self, league_id: int, season: int):
        """Return top assists."""
        return await self.request(
            "players/topassists",
            {
                "league": league_id,
                "season": season,
            },
        )
