"""API-Football client for Football Hub."""

from __future__ import annotations

import asyncio
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

        headers = {
            "x-apisports-key": self.api_key,
        }

        url = f"{API_BASE}/{endpoint}"

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
                        f"{response.status} - {text}"
                    )

                data = await response.json()

        except aiohttp.ClientError as err:
            raise FootballHubAPIError(err) from err

        if not isinstance(data, dict):
            raise FootballHubAPIError("Invalid API response")

        if data.get("errors"):
            _LOGGER.warning("API returned errors: %s", data["errors"])

        return data.get("response", [])

    async def get_live(self, league_id: int, season: int):
        return await self.request(
            "fixtures",
            {
                "live": "all",
                "league": league_id,
                "season": season,
            },
        )

    async def get_fixtures(self, league_id: int, season: int):
        return await self.request(
            "fixtures",
            {
                "league": league_id,
                "season": season,
            },
        )

    async def get_standings(self, league_id: int, season: int):
        return await self.request(
            "standings",
            {
                "league": league_id,
                "season": season,
            },
        )

    async def get_top_scorers(self, league_id: int, season: int):
        return await self.request(
            "players/topscorers",
            {
                "league": league_id,
                "season": season,
            },
        )

    async def get_top_assists(self, league_id: int, season: int):
        return await self.request(
            "players/topassists",
            {
                "league": league_id,
                "season": season,
            },
        )

    async def get_competition_data(self, league_id: int, season: int):
        """Fetch all competition data in parallel."""

        (
            live,
            fixtures,
            standings,
            scorers,
            assists,
        ) = await asyncio.gather(
            self.get_live(league_id, season),
            self.get_fixtures(league_id, season),
            self.get_standings(league_id, season),
            self.get_top_scorers(league_id, season),
            self.get_top_assists(league_id, season),
        )

        return {
            "live": live,
            "fixtures": fixtures,
            "standings": standings,
            "top_scorers": scorers,
            "top_assists": assists,
        }
