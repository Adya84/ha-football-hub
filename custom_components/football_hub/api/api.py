"""Free ESPN football data provider for Football Hub."""
from __future__ import annotations

from datetime import datetime
from time import monotonic
from typing import Any

import aiohttp
from homeassistant.helpers.aiohttp_client import async_get_clientsession

ESPN_SITE_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer"
ESPN_STANDINGS_BASE = "https://site.web.api.espn.com/apis/v2/sports/soccer"

ESPN_LEAGUES = {
    39: "eng.1", 40: "eng.2", 41: "eng.3", 42: "eng.4", 43: "eng.5",
    179: "sco.1", 110: "wal.1", 408: "nir.1", 357: "irl.1",
    140: "esp.1", 78: "ger.1", 135: "ita.1", 61: "fra.1",
    88: "ned.1", 94: "por.1", 144: "bel.1", 203: "tur.1",
}


class FootballHubAPIError(Exception):
    """ESPN provider error."""


class FootballHubAPI:
    """Expose ESPN data in Football Hub's existing API-Football-shaped model."""

    def __init__(self, hass, api_key: str | None = None):
        self.hass = hass
        self.session = async_get_clientsession(hass)
        self._scoreboard_cache: dict[tuple[int, int], tuple[float, list[dict]]] = {}
        self._fixture_leagues: dict[str, str] = {}

    async def _get(self, url: str, params: dict[str, Any] | None = None) -> dict:
        async with self.session.get(
            url,
            params=params or {},
            headers={"Accept": "application/json", "User-Agent": "Football-Hub/Home-Assistant"},
            timeout=aiohttp.ClientTimeout(total=30),
        ) as response:
            if response.status == 429:
                raise FootballHubAPIError("ESPN request limit reached")
            if response.status >= 400:
                raise FootballHubAPIError(f"ESPN returned HTTP {response.status}")
            data = await response.json(content_type=None)
        if not isinstance(data, dict):
            raise FootballHubAPIError("Invalid ESPN response")
        return data

    @staticmethod
    def _league(league_id: int) -> str:
        try:
            return ESPN_LEAGUES[int(league_id)]
        except (KeyError, TypeError, ValueError) as err:
            raise FootballHubAPIError(f"ESPN league mapping is unavailable for {league_id}") from err

    @staticmethod
    def _logo(team: dict) -> str | None:
        if team.get("logo"):
            return team["logo"]
        logos = team.get("logos") or []
        return (logos[0] or {}).get("href") if logos else None

    @staticmethod
    def _int(value: Any, default: int = 0) -> int:
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _status(event: dict) -> dict:
        status = event.get("status") or {}
        kind = status.get("type") or {}
        state = kind.get("state")
        completed = bool(kind.get("completed"))
        if state == "in":
            short = "HT" if kind.get("name") == "STATUS_HALFTIME" else "LIVE"
        elif completed or state == "post":
            short = "FT"
        else:
            short = "NS"
        clock = str(status.get("displayClock") or "")
        elapsed = None
        try:
            elapsed = int(clock.split(":", 1)[0].replace("'", ""))
        except (TypeError, ValueError):
            pass
        return {
            "short": short,
            "long": kind.get("description") or kind.get("detail") or short,
            "elapsed": elapsed,
        }

    def _fixture(self, event: dict) -> dict | None:
        competitions = event.get("competitions") or []
        if not competitions:
            return None
        competition = competitions[0] or {}
        competitors = competition.get("competitors") or []
        if len(competitors) < 2:
            return None
        home = next((item for item in competitors if item.get("homeAway") == "home"), competitors[0])
        away = next((item for item in competitors if item.get("homeAway") == "away"), competitors[1])
        home_team, away_team = home.get("team") or {}, away.get("team") or {}
        venue = competition.get("venue") or {}
        timestamp = None
        try:
            timestamp = int(datetime.fromisoformat(str(event.get("date")).replace("Z", "+00:00")).timestamp())
        except (TypeError, ValueError):
            pass

        def score(item: dict) -> int | None:
            value = item.get("score")
            try:
                return int(value) if value not in (None, "") else None
            except (TypeError, ValueError):
                return None

        return {
            "fixture": {
                "id": int(event.get("id")) if str(event.get("id", "")).isdigit() else event.get("id"),
                "date": event.get("date"),
                "timestamp": timestamp,
                "status": self._status(event),
                "venue": {
                    "name": venue.get("fullName"),
                    "city": (venue.get("address") or {}).get("city"),
                },
            },
            "league": {
                "name": ((competition.get("league") or {}).get("displayName")),
                "round": (event.get("season") or {}).get("displayName"),
            },
            "teams": {
                "home": {"id": home_team.get("id"), "name": home_team.get("displayName"), "logo": self._logo(home_team)},
                "away": {"id": away_team.get("id"), "name": away_team.get("displayName"), "logo": self._logo(away_team)},
            },
            "goals": {"home": score(home), "away": score(away)},
            "score": {
                "halftime": {"home": None, "away": None},
                "fulltime": {"home": score(home), "away": score(away)},
            },
        }

    async def _fixtures(self, league_id: int, season: int) -> list[dict]:
        key = (int(league_id), int(season))
        cached = self._scoreboard_cache.get(key)
        if cached and monotonic() - cached[0] < 30:
            return cached[1]
        slug = self._league(league_id)
        calendar_data = await self._get(f"{ESPN_SITE_BASE}/{slug}/scoreboard")
        leagues = calendar_data.get("leagues") or []
        league = leagues[0] if leagues else {}
        start = str(league.get("calendarStartDate") or f"{season}-01-01")[:10].replace("-", "")
        end = str(league.get("calendarEndDate") or f"{season}-12-31")[:10].replace("-", "")
        data = await self._get(
            f"{ESPN_SITE_BASE}/{slug}/scoreboard",
            {"limit": 1000, "dates": f"{start}-{end}"},
        )
        fixtures = [item for event in data.get("events", []) if (item := self._fixture(event))]
        for item in fixtures:
            fixture_id = (item.get("fixture") or {}).get("id")
            if fixture_id is not None:
                self._fixture_leagues[str(fixture_id)] = slug
        self._scoreboard_cache[key] = (monotonic(), fixtures)
        return fixtures

    async def get_live(self, league_id, season):
        fixtures = await self._fixtures(league_id, season)
        return [item for item in fixtures if (item.get("fixture", {}).get("status", {}).get("short") in {"LIVE", "HT"})]

    async def get_fixtures(self, league_id, season):
        return await self._fixtures(league_id, season)

    async def get_standings(self, league_id, season):
        slug = self._league(league_id)
        data = await self._get(f"{ESPN_STANDINGS_BASE}/{slug}/standings", {"season": season})
        rows: list[dict] = []
        for child in data.get("children", []) or []:
            for index, entry in enumerate(((child.get("standings") or {}).get("entries") or []), 1):
                team = entry.get("team") or {}
                stats = {item.get("name"): item.get("value", item.get("displayValue")) for item in entry.get("stats", [])}
                rows.append({
                    "rank": self._int(stats.get("rank"), index),
                    "team": {"id": team.get("id"), "name": team.get("displayName"), "logo": self._logo(team)},
                    "points": self._int(stats.get("points")),
                    "goalsDiff": self._int(stats.get("pointDifferential")),
                    "all": {
                        "played": self._int(stats.get("gamesPlayed")),
                        "win": self._int(stats.get("wins")),
                        "draw": self._int(stats.get("ties")),
                        "lose": self._int(stats.get("losses")),
                        "goals": {"for": self._int(stats.get("pointsFor")), "against": self._int(stats.get("pointsAgainst"))},
                    },
                })
        return [{"league": {"standings": [rows]}}] if rows else []

    async def get_teams(self, league_id, season):
        slug = self._league(league_id)
        data = await self._get(f"{ESPN_SITE_BASE}/{slug}/teams")
        leagues = ((data.get("sports") or [{}])[0].get("leagues") or [])
        teams = (leagues[0].get("teams") or []) if leagues else []
        output = []
        for wrapper in teams:
            team = wrapper.get("team") or {}
            output.append({"team": {"id": team.get("id"), "name": team.get("displayName"), "code": team.get("abbreviation"), "country": None, "founded": None, "logo": self._logo(team)}, "venue": {}})
        return output

    async def _summary(self, fixture_id):
        slug = self._fixture_leagues.get(str(fixture_id), "all")
        return await self._get(f"{ESPN_SITE_BASE}/{slug}/summary", {"event": fixture_id})

    async def get_fixture_events(self, fixture_id):
        data = await self._summary(fixture_id)
        events = []
        for event in data.get("keyEvents", []) or []:
            participants = event.get("participants") or []
            player = ((participants[0] or {}).get("athlete") or {}) if participants else {}
            events.append({
                "time": {"elapsed": ((event.get("clock") or {}).get("value")), "extra": None},
                "team": {"id": (event.get("team") or {}).get("id"), "name": (event.get("team") or {}).get("displayName")},
                "player": {"id": player.get("id"), "name": player.get("displayName")},
                "type": ((event.get("type") or {}).get("text") or "Event"),
                "detail": event.get("shortText"),
            })
        return events

    async def get_fixture_statistics(self, fixture_id):
        data = await self._summary(fixture_id)
        output = []
        for competitor in (((data.get("header") or {}).get("competitions") or [{}])[0].get("competitors") or []):
            team = competitor.get("team") or {}
            output.append({"team": {"id": team.get("id"), "name": team.get("displayName"), "logo": self._logo(team)}, "statistics": [{"type": item.get("name"), "value": item.get("displayValue")} for item in competitor.get("statistics", [])]})
        return output

    async def get_fixture_lineups(self, fixture_id):
        data = await self._summary(fixture_id)
        output = []
        for roster in data.get("rosters", []) or []:
            team = roster.get("team") or {}
            players = []
            for item in roster.get("roster", []) or []:
                athlete = item.get("athlete") or {}
                players.append({"player": {"id": athlete.get("id"), "name": athlete.get("displayName"), "number": item.get("jersey"), "pos": (item.get("position") or {}).get("abbreviation")}})
            output.append({"team": {"id": team.get("id"), "name": team.get("displayName"), "logo": self._logo(team)}, "formation": roster.get("formation"), "startXI": [p for p, source in zip(players, roster.get("roster", []), strict=False) if source.get("starter")], "substitutes": [p for p, source in zip(players, roster.get("roster", []), strict=False) if not source.get("starter")]})
        return output

    async def get_top_scorers(self, league_id, season): return []
    async def get_top_assists(self, league_id, season): return []
    async def get_team_statistics(self, team_id, league_id, season): return {}
    async def get_team_seasons(self, team_id): return []
    async def get_squad(self, team_id): return []
    async def get_coach(self, team_id): return []
    async def get_injuries(self, team_id, season): return []
    async def get_transfers(self, team_id): return []
    async def get_team_players(self, team_id, league_id, season, page=1): return []
    async def get_top_yellow_cards(self, league_id, season): return []
    async def get_top_red_cards(self, league_id, season): return []
    async def get_head_to_head(self, team_id, opponent_id): return []
    async def get_prediction(self, fixture_id): return []
    async def get_trophies_for_players(self, player_ids): return []
    async def get_trophies_for_coach(self, coach_id): return []
    async def get_sidelined_players(self, player_ids): return []
