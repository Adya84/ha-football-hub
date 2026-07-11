"""API-Football client for Football Hub."""
from __future__ import annotations

from typing import Any
import aiohttp
from homeassistant.helpers.aiohttp_client import async_get_clientsession

API_BASE = "https://v3.football.api-sports.io"


class FootballHubAPIError(Exception):
    """Football Hub API error."""


class FootballHubAPI:
    def __init__(self, hass, api_key: str):
        self.hass = hass
        self.api_key = api_key
        self.session = async_get_clientsession(hass)

    async def request(self, endpoint: str, params: dict[str, Any] | None = None):
        async with self.session.get(
            f"{API_BASE}/{endpoint}",
            headers={"x-apisports-key": self.api_key},
            params=params or {},
            timeout=aiohttp.ClientTimeout(total=30),
        ) as response:
            if response.status == 429:
                raise FootballHubAPIError("API rate limit reached")
            if response.status >= 400:
                raise FootballHubAPIError(f"{response.status} - {await response.text()}")
            data = await response.json()
        if not isinstance(data, dict):
            raise FootballHubAPIError("Invalid API response")
        if data.get("errors"):
            raise FootballHubAPIError(str(data["errors"]))
        return data.get("response", [])

    async def get_live(self, league_id, season):
        return await self.request("fixtures", {"live": "all", "league": league_id, "season": season})
    async def get_fixtures(self, league_id, season):
        return await self.request("fixtures", {"league": league_id, "season": season})
    async def get_standings(self, league_id, season):
        return await self.request("standings", {"league": league_id, "season": season})
    async def get_top_scorers(self, league_id, season):
        return await self.request("players/topscorers", {"league": league_id, "season": season})
    async def get_top_assists(self, league_id, season):
        return await self.request("players/topassists", {"league": league_id, "season": season})
    async def get_fixture_events(self, fixture_id):
        return await self.request("fixtures/events", {"fixture": fixture_id})
    async def get_fixture_statistics(self, fixture_id):
        return await self.request("fixtures/statistics", {"fixture": fixture_id})
    async def get_fixture_lineups(self, fixture_id):
        return await self.request("fixtures/lineups", {"fixture": fixture_id})

    async def get_teams(self, league_id, season):
        return await self.request("teams", {"league": league_id, "season": season})
    async def get_team_statistics(self, team_id, league_id, season):
        return await self.request("teams/statistics", {"team": team_id, "league": league_id, "season": season})
    async def get_team_seasons(self, team_id):
        return await self.request("teams/seasons", {"team": team_id})
    async def get_squad(self, team_id):
        return await self.request("players/squads", {"team": team_id})
    async def get_coach(self, team_id):
        return await self.request("coachs", {"team": team_id})
    async def get_injuries(self, team_id, season):
        return await self.request("injuries", {"team": team_id, "season": season})
    async def get_transfers(self, team_id):
        return await self.request("transfers", {"team": team_id})
    async def get_team_players(self, team_id, league_id, season, page=1):
        return await self.request("players", {"team": team_id, "league": league_id, "season": season, "page": page})
    async def get_top_yellow_cards(self, league_id, season):
        return await self.request("players/topyellowcards", {"league": league_id, "season": season})
    async def get_top_red_cards(self, league_id, season):
        return await self.request("players/topredcards", {"league": league_id, "season": season})
    async def get_head_to_head(self, team_id, opponent_id):
        return await self.request("fixtures/headtohead", {"h2h": f"{team_id}-{opponent_id}", "last": 10})
    async def get_prediction(self, fixture_id):
        return await self.request("predictions", {"fixture": fixture_id})
    async def get_trophies_for_players(self, player_ids):
        ids = "-".join(str(value) for value in player_ids[:20] if value)
        return await self.request("trophies", {"players": ids}) if ids else []
    async def get_trophies_for_coach(self, coach_id):
        return await self.request("trophies", {"coach": coach_id})
    async def get_sidelined_players(self, player_ids):
        ids = "-".join(str(value) for value in player_ids[:20] if value)
        return await self.request("sidelined", {"players": ids}) if ids else []
