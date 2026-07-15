"""Free ESPN football data provider for Football Hub with FotMob enrichment."""
from __future__ import annotations

from datetime import datetime
from time import monotonic
from typing import Any

import aiohttp
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .fm import FotMobProvider

ESPN_SITE_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer"
ESPN_STANDINGS_BASE = "https://site.web.api.espn.com/apis/v2/sports/soccer"

ESPN_LEAGUES = {
    39: "eng.1", 40: "eng.2", 41: "eng.3", 42: "eng.4", 43: "eng.5",
    179: "sco.1", 110: "wal.1", 408: "nir.1", 357: "irl.1",
    140: "esp.1", 78: "ger.1", 135: "ita.1", 61: "fra.1",
    88: "ned.1", 94: "por.1", 144: "bel.1", 203: "tur.1",
}


class FootballHubAPIError(Exception):
    """Football Hub provider error."""


class FootballHubAPI:
    """Expose ESPN data in Football Hub's existing API-Football-shaped model.

    FotMob is used only to fill missing club data such as stadium, manager,
    squad images, injuries and transfers. ESPN remains the main provider.
    """

    def __init__(self, hass, api_key: str | None = None):
        self.hass = hass
        self.session = async_get_clientsession(hass)
        self.fotmob = FotMobProvider(self.session)
        self._scoreboard_cache: dict[tuple[int, int], tuple[float, list[dict]]] = {}
        self._fixture_leagues: dict[str, str] = {}
        self._team_leagues: dict[str, str] = {}
        self._team_cache: dict[str, tuple[float, dict]] = {}
        self._team_names: dict[str, str] = {}

    @staticmethod
    def _missing(value: Any) -> bool:
        return value in (None, "", [], {})

    @classmethod
    def _fill_missing(cls, primary: dict, fallback: dict) -> dict:
        for key, value in (fallback or {}).items():
            if isinstance(value, dict):
                base = primary.setdefault(key, {})
                if isinstance(base, dict):
                    cls._fill_missing(base, value)
                elif cls._missing(base):
                    primary[key] = value
            elif cls._missing(primary.get(key)) and not cls._missing(value):
                primary[key] = value
        return primary

    async def _safe_fotmob(self, method: str, team_name: str):
        if not team_name:
            return None
        try:
            return await getattr(self.fotmob, method)(team_name)
        except Exception:
            return None

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
            for side in ("home", "away"):
                team = ((item.get("teams") or {}).get(side) or {})
                if team.get("id") is not None and team.get("name"):
                    self._team_names[str(team.get("id"))] = team.get("name")
                    self._team_leagues[str(team.get("id"))] = slug
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
            if team.get("id") is not None:
                self._team_leagues[str(team.get("id"))] = slug
                if team.get("displayName"):
                    self._team_names[str(team.get("id"))] = team.get("displayName")
            output.append({"team": {"id": team.get("id"), "name": team.get("displayName"), "code": team.get("abbreviation"), "country": None, "founded": None, "logo": self._logo(team)}, "venue": {}})
        return output

    async def _team_detail(self, team_id, league_id=None) -> dict:
        key = str(team_id)
        cached = self._team_cache.get(key)
        if cached and monotonic() - cached[0] < 6 * 60 * 60:
            return cached[1]
        slug = self._league(league_id) if league_id is not None else self._team_leagues.get(key, "all")
        data = await self._get(f"{ESPN_SITE_BASE}/{slug}/teams/{team_id}", {"enable": "roster"})
        if not self._athletes(data):
            try:
                data["roster_data"] = await self._get(f"{ESPN_SITE_BASE}/{slug}/teams/{team_id}/roster")
            except FootballHubAPIError:
                pass
        team = self._team_object(data)
        if team.get("displayName") or team.get("name"):
            self._team_names[key] = team.get("displayName") or team.get("name")
        self._team_leagues[key] = slug
        self._team_cache[key] = (monotonic(), data)
        return data

    @staticmethod
    def _team_object(data: dict) -> dict:
        team = data.get("team") or data.get("club") or {}
        return team if isinstance(team, dict) else {}

    @classmethod
    def _athletes(cls, data: Any) -> list[dict]:
        """Find ESPN athlete records across grouped and flat roster responses."""
        found: dict[str, dict] = {}

        def walk(value: Any) -> None:
            if isinstance(value, dict):
                athlete = value.get("athlete")
                if isinstance(athlete, dict) and (athlete.get("displayName") or athlete.get("fullName")):
                    merged = {**athlete, "jersey": value.get("jersey") or athlete.get("jersey"), "position": value.get("position") or athlete.get("position")}
                    found[str(athlete.get("id") or athlete.get("displayName"))] = merged
                elif (value.get("displayName") or value.get("fullName")) and any(key in value for key in ("position", "jersey", "headshot")):
                    found[str(value.get("id") or value.get("displayName"))] = value
                for key, child in value.items():
                    if key not in {"links", "statistics", "stats"}:
                        walk(child)
            elif isinstance(value, list):
                for child in value:
                    walk(child)

        walk(data.get("athletes") or data.get("roster") or data.get("roster_data") or [])
        return list(found.values())

    async def get_team(self, team_id, league_id):
        data = await self._team_detail(team_id, league_id)
        team = self._team_object(data)
        team_name = team.get("displayName") or team.get("name") or self._team_names.get(str(team_id))
        venue = team.get("venue") or data.get("venue") or {}
        address = venue.get("address") or {}
        profile = {
            "team": {
                "id": team.get("id") or team_id,
                "name": team_name,
                "code": team.get("abbreviation"),
                "country": address.get("country") or team.get("country"),
                "founded": team.get("founded"),
                "logo": self._logo(team),
            },
            "venue": {
                "id": venue.get("id"),
                "name": venue.get("fullName") or venue.get("displayName") or venue.get("name"),
                "city": address.get("city"),
                "capacity": venue.get("capacity"),
                "surface": venue.get("grass") or venue.get("surface"),
                "image": ((venue.get("images") or [{}])[0] or {}).get("href") if venue.get("images") else None,
            },
        }

        fallback = await self._safe_fotmob("get_team", team_name)
        if isinstance(fallback, dict):
            self._fill_missing(profile, fallback)

        return [profile]

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
            source_roster = roster.get("roster", []) or []
            for item in source_roster:
                athlete = item.get("athlete") or {}
                players.append({"player": {"id": athlete.get("id"), "name": athlete.get("displayName"), "number": item.get("jersey"), "pos": (item.get("position") or {}).get("abbreviation")}})
            output.append({
                "team": {"id": team.get("id"), "name": team.get("displayName"), "logo": self._logo(team)},
                "formation": roster.get("formation"),
                "startXI": [p for p, source in zip(players, source_roster) if source.get("starter")],
                "substitutes": [p for p, source in zip(players, source_roster) if not source.get("starter")],
            })
        return output

    async def get_top_scorers(self, league_id, season):
        return await self._get_league_players(league_id, "goals")

    async def get_top_assists(self, league_id, season):
        return await self._get_league_players(league_id, "assists")

    async def _get_league_players(self, league_id, stat_name: str) -> list[dict]:
        """Read ESPN league leaders when that competition exposes them."""
        slug = self._league(league_id)
        try:
            data = await self._get(f"{ESPN_SITE_BASE}/{slug}/statistics")
        except FootballHubAPIError:
            return []
        records: dict[str, dict] = {}

        def walk(value: Any, category: str = "") -> None:
            if isinstance(value, dict):
                current = str(value.get("name") or value.get("displayName") or category).lower()
                athlete = value.get("athlete") or value.get("player")
                if isinstance(athlete, dict) and stat_name in current:
                    player_id = str(athlete.get("id") or athlete.get("displayName"))
                    amount = self._int(value.get("value") or value.get("displayValue"))
                    team = value.get("team") or {}
                    records[player_id] = {
                        "player": {"id": athlete.get("id"), "name": athlete.get("displayName") or athlete.get("fullName"), "photo": ((athlete.get("headshot") or {}).get("href"))},
                        "statistics": [{"team": {"id": team.get("id"), "name": team.get("displayName")}, "goals": {"total": amount if stat_name == "goals" else 0, "assists": amount if stat_name == "assists" else 0}}],
                    }
                for child in value.values():
                    walk(child, current)
            elif isinstance(value, list):
                for child in value:
                    walk(child, category)

        walk(data)
        return list(records.values())

    async def get_team_statistics(self, team_id, league_id, season):
        fixtures = await self._fixtures(league_id, season)
        played = wins = draws = losses = goals_for = goals_against = clean_sheets = 0
        for item in fixtures:
            fixture = item.get("fixture") or {}
            if (fixture.get("status") or {}).get("short") != "FT":
                continue
            teams, goals = item.get("teams") or {}, item.get("goals") or {}
            home, away = teams.get("home") or {}, teams.get("away") or {}
            is_home = str(home.get("id")) == str(team_id)
            is_away = str(away.get("id")) == str(team_id)
            if not (is_home or is_away):
                continue
            scored = self._int(goals.get("home") if is_home else goals.get("away"))
            conceded = self._int(goals.get("away") if is_home else goals.get("home"))
            played += 1
            goals_for += scored
            goals_against += conceded
            clean_sheets += int(conceded == 0)
            wins += int(scored > conceded)
            draws += int(scored == conceded)
            losses += int(scored < conceded)
        return {
            "fixtures": {"played": {"total": played}, "wins": {"total": wins}, "draws": {"total": draws}, "loses": {"total": losses}},
            "goals": {"for": {"total": {"total": goals_for}}, "against": {"total": {"total": goals_against}}},
            "clean_sheet": {"total": clean_sheets},
        }

    async def get_team_seasons(self, team_id):
        return []

    async def get_squad(self, team_id):
        data = await self._team_detail(team_id)
        team = self._team_object(data)
        team_name = team.get("displayName") or team.get("name") or self._team_names.get(str(team_id))
        players = []
        for athlete in self._athletes(data):
            position = athlete.get("position") or {}
            headshot = athlete.get("headshot") or {}
            athlete_id = athlete.get("id")
            photo = headshot.get("href") if isinstance(headshot, dict) else headshot
            if not photo and athlete_id:
                photo = f"https://a.espncdn.com/i/headshots/soccer/players/full/{athlete_id}.png"
            players.append({
                "id": athlete_id,
                "name": athlete.get("displayName") or athlete.get("fullName"),
                "age": athlete.get("age"),
                "number": athlete.get("jersey"),
                "position": position.get("displayName") or position.get("abbreviation") if isinstance(position, dict) else position,
                "photo": photo,
            })

        fotmob_squad = await self._safe_fotmob("get_squad", team_name)
        if isinstance(fotmob_squad, list) and fotmob_squad:
            fallback_players = ((fotmob_squad[0] or {}).get("players") or [])
            if not players:
                players = fallback_players
            else:
                by_name = {str(p.get("name", "")).casefold(): p for p in fallback_players}
                for player in players:
                    fp = by_name.get(str(player.get("name", "")).casefold())
                    if fp:
                        self._fill_missing(player, fp)

        return [{"team": {"id": team.get("id") or team_id, "name": team_name, "logo": self._logo(team)}, "players": players}] if players else []

    async def get_coach(self, team_id):
        data = await self._team_detail(team_id)
        team = self._team_object(data)
        team_name = team.get("displayName") or team.get("name") or self._team_names.get(str(team_id))
        coaches = data.get("coaches") or team.get("coaches") or []
        if isinstance(data.get("coach") or team.get("coach"), dict):
            coaches = [data.get("coach") or team.get("coach"), *coaches]
        output = []
        for coach in coaches:
            if not isinstance(coach, dict):
                continue
            headshot = coach.get("headshot") or {}
            output.append({
                "id": coach.get("id"),
                "name": coach.get("displayName") or coach.get("fullName") or coach.get("name"),
                "age": coach.get("age"),
                "nationality": coach.get("citizenship") or coach.get("nationality"),
                "photo": headshot.get("href") if isinstance(headshot, dict) else headshot,
                "career": [{"team": {"id": team.get("id") or team_id, "name": team_name}, "start": None, "end": None}],
            })
        output = [item for item in output if item.get("name")]

        fotmob_coaches = await self._safe_fotmob("get_coach", team_name)
        if isinstance(fotmob_coaches, list) and fotmob_coaches:
            if not output:
                return fotmob_coaches
            self._fill_missing(output[0], fotmob_coaches[0])

        return output

    async def get_injuries(self, team_id, season):
        slug = self._team_leagues.get(str(team_id), "all")
        try:
            data = await self._get(f"{ESPN_SITE_BASE}/{slug}/teams/{team_id}/injuries")
        except FootballHubAPIError:
            data = {}
        injuries = data.get("injuries") or data.get("items") or []
        output = []
        for record in injuries:
            athlete = record.get("athlete") or record.get("player") or {}
            output.append({
                "player": {"id": athlete.get("id"), "name": athlete.get("displayName") or athlete.get("fullName"), "photo": ((athlete.get("headshot") or {}).get("href"))},
                "team": {"id": team_id},
                "type": record.get("type") or (record.get("status") or {}).get("type"),
                "reason": record.get("details") or record.get("description") or (record.get("status") or {}).get("name"),
                "date": record.get("date"),
            })
        output = [item for item in output if item.get("player", {}).get("name")]

        if not output:
            team_name = self._team_names.get(str(team_id))
            if not team_name:
                try:
                    team = self._team_object(await self._team_detail(team_id))
                    team_name = team.get("displayName") or team.get("name")
                except Exception:
                    team_name = None
            fotmob_injuries = await self._safe_fotmob("get_injuries", team_name)
            if isinstance(fotmob_injuries, list):
                output = fotmob_injuries

        return output

    async def get_transfers(self, team_id):
        team_name = self._team_names.get(str(team_id))
        if not team_name:
            try:
                team = self._team_object(await self._team_detail(team_id))
                team_name = team.get("displayName") or team.get("name")
            except Exception:
                team_name = None
        transfers = await self._safe_fotmob("get_transfers", team_name)
        return transfers if isinstance(transfers, list) else []

    async def get_team_players(self, team_id, league_id, season, page=1):
        squad = await self.get_squad(team_id)
        if not squad:
            return []
        team = squad[0].get("team") or {}
        return [{"player": {"id": player.get("id"), "name": player.get("name"), "age": player.get("age"), "photo": player.get("photo")}, "statistics": [{"team": team, "games": {"position": player.get("position"), "number": player.get("number")}, "goals": {"total": 0, "assists": 0}}]} for player in squad[0].get("players", [])]

    async def get_top_yellow_cards(self, league_id, season):
        return []

    async def get_top_red_cards(self, league_id, season):
        return []

    async def get_head_to_head(self, team_id, opponent_id):
        matches = []
        wanted = {str(team_id), str(opponent_id)}
        for _, fixtures in self._scoreboard_cache.values():
            for item in fixtures:
                teams = item.get("teams") or {}
                ids = {str((teams.get("home") or {}).get("id")), str((teams.get("away") or {}).get("id"))}
                if ids == wanted:
                    matches.append(item)
        return matches[-10:]

    async def get_prediction(self, fixture_id):
        return []

    async def get_trophies_for_players(self, player_ids):
        return []

    async def get_trophies_for_coach(self, coach_id):
        return []

    async def get_sidelined_players(self, player_ids):
        return []
