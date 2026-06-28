"""API-Football client for Football Hub."""

from __future__ import annotations

import logging

import aiohttp

_LOGGER = logging.getLogger(__name__)

API_BASE = "https://v3.football.api-sports.io"


class FootballHubAPI:
    """Simple API-Football client."""

    def __init__(self, api_key: str):
        self._api_key = api_key

    async def _request(self, endpoint: str, params: dict | None = None):
        """Send a request to API-Football."""

        headers = {
            "x-apisports-key": self._api_key,
        }

        url = f"{API_BASE}/{endpoint}"

        async with aiohttp.ClientSession() as session:
            async with session.get(
                url,
                headers=headers,
                params=params,
                timeout=30,
            ) as response:

                response.raise_for_status()

                data = await response.json()

                return data.get("response", [])

    async def get_live(self, league_id: int, season: int):
        """Return live fixtures."""
        return await self._request(
            "fixtures",
            {
                "live": "all",
                "league": league_id,
                "season": season,
            },
        )

    async def get_fixtures(self, league_id: int, season: int):
        """Return fixtures."""
        return await self._request(
            "fixtures",
            {
                "league": league_id,
                "season": season,
            },
        )

    async def get_standings(self, league_id: int, season: int):
        """Return standings."""
        return await self._request(
            "standings",
            {
                "league": league_id,
                "season": season,
            },
        )

    async def get_players(self, team_id: int, season: int):
        """Return squad."""
        return await self._request(
            "players",
            {
                "team": team_id,
                "season": season,
            },
        )
