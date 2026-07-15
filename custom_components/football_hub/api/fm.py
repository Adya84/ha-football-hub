"""FotMob enrichment provider for Football Hub.

ESPN remains the main provider. This module only fills missing club data:
stadium, manager, squad details, injuries and transfers.
"""
from __future__ import annotations

import asyncio
import logging
import re
from time import monotonic
from typing import Any

import aiohttp

_LOGGER = logging.getLogger(__name__)

FOTMOB_BASE = "https://www.fotmob.com"
CACHE_SECONDS = 6 * 60 * 60


class FotMobProvider:
    """Fetch and normalize FotMob club data for Football Hub."""

    def __init__(self, session: aiohttp.ClientSession, ccode3: str = "GBR"):
        self.session = session
        self.ccode3 = ccode3
        self._search_cache: dict[str, tuple[float, dict | None]] = {}
        self._team_cache: dict[str, tuple[float, dict]] = {}

    @staticmethod
    def _normalise(value: Any) -> str:
        text = str(value or "").casefold()
        text = re.sub(r"[^a-z0-9]+", " ", text)
        return re.sub(r"\s+", " ", text).strip()

    @classmethod
    def _name_score(cls, wanted: str, candidate: str) -> int:
        wanted_n = cls._normalise(wanted)
        candidate_n = cls._normalise(candidate)

        if not wanted_n or not candidate_n:
            return 0
        if wanted_n == candidate_n:
            return 100
        if wanted_n in candidate_n or candidate_n in wanted_n:
            return 85

        wanted_words = set(wanted_n.split())
        candidate_words = set(candidate_n.split())
        if not wanted_words:
            return 0

        return int(70 * len(wanted_words & candidate_words) / len(wanted_words))

    async def _get(
        self,
        path: str,
        params: dict[str, Any] | None = None,
    ) -> dict:
        url = f"{FOTMOB_BASE}/{path.lstrip('/')}"
        headers = {
            "Accept": "application/json",
            "Accept-Language": "en-GB,en;q=0.9",
            "Referer": "https://www.fotmob.com/",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        }

        try:
            async with self.session.get(
                url,
                params=params or {},
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30),
            ) as response:
                if response.status == 429:
                    _LOGGER.warning("FotMob rate limited request: %s", url)
                    return {}
                if response.status != 200:
                    _LOGGER.debug(
                        "FotMob request returned HTTP %s: %s",
                        response.status,
                        url,
                    )
                    return {}

                data = await response.json(content_type=None)
                return data if isinstance(data, dict) else {}
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as err:
            _LOGGER.debug("FotMob request failed for %s: %s", url, err)
            return {}

    @staticmethod
    def _walk(value: Any):
        if isinstance(value, dict):
            yield value
            for child in value.values():
                yield from FotMobProvider._walk(child)
        elif isinstance(value, list):
            for child in value:
                yield from FotMobProvider._walk(child)

    @staticmethod
    def _image(value: Any) -> str | None:
        if isinstance(value, str) and value.startswith("http"):
            return value
        if isinstance(value, dict):
            for key in (
                "url",
                "imageUrl",
                "image",
                "photo",
                "src",
                "headshot",
            ):
                found = FotMobProvider._image(value.get(key))
                if found:
                    return found
        if isinstance(value, list):
            for item in value:
                found = FotMobProvider._image(item)
                if found:
                    return found
        return None

    @staticmethod
    def _first(data: Any, *keys: str) -> Any:
        wanted = {key.casefold() for key in keys}
        for node in FotMobProvider._walk(data):
            for key, value in node.items():
                if str(key).casefold() in wanted and value not in (
                    None,
                    "",
                    [],
                    {},
                ):
                    return value
        return None

    async def search_team(self, team_name: str) -> dict | None:
        """Resolve a FotMob team ID from the ESPN team name."""
        cache_key = self._normalise(team_name)
        if not cache_key:
            return None

        cached = self._search_cache.get(cache_key)
        if cached and monotonic() - cached[0] < 24 * 60 * 60:
            return cached[1]

        data = await self._get("api/searchData", {"term": team_name})
        candidates = data.get("team") or data.get("teams") or []

        best: dict | None = None
        best_score = 0

        for item in candidates:
            if not isinstance(item, dict):
                continue

            candidate_name = (
                item.get("name")
                or item.get("localizedName")
                or item.get("shortName")
            )
            candidate_id = item.get("id") or item.get("teamId")

            if not candidate_name or candidate_id in (None, ""):
                continue

            score = self._name_score(team_name, candidate_name)
            if score > best_score:
                best_score = score
                best = {
                    "id": candidate_id,
                    "name": candidate_name,
                }

        if best_score < 60:
            best = None

        self._search_cache[cache_key] = (monotonic(), best)
        return best

    async def _load_team(self, team_name: str) -> dict:
        """Load the overview and relevant FotMob team tabs."""
        match = await self.search_team(team_name)
        if not match:
            return {}

        team_id = str(match["id"])
        cached = self._team_cache.get(team_id)
        if cached and monotonic() - cached[0] < CACHE_SECONDS:
            return cached[1]

        base_params = {
            "id": team_id,
            "ccode3": self.ccode3,
        }

        overview, squad, transfers, history, stats = await asyncio.gather(
            self._get("api/data/teams", base_params),
            self._get("api/data/teams", {**base_params, "tab": "squad"}),
            self._get(
                "api/data/teams",
                {**base_params, "tab": "transfers"},
            ),
            self._get("api/data/teams", {**base_params, "tab": "history"}),
            self._get("api/data/teams", {**base_params, "tab": "stats"}),
        )

        merged = dict(overview or {})
        merged["_football_hub_fotmob_team"] = match
        merged["_football_hub_fotmob_id"] = team_id

        if squad:
            merged["_football_hub_squad_tab"] = squad
        if transfers:
            merged["_football_hub_transfers_tab"] = transfers
        if history:
            merged["_football_hub_history_tab"] = history
        if stats:
            merged["_football_hub_stats_tab"] = stats

        self._team_cache[team_id] = (monotonic(), merged)
        return merged

    def _stadium(self, data: dict) -> dict:
        """Extract stadium details from the team response."""
        stadium = {}

        for node in self._walk(data):
            if not isinstance(node, dict):
                continue

            name = (
                node.get("stadiumName")
                or node.get("venueName")
                or node.get("stadium")
                or node.get("venue")
            )
            capacity = (
                node.get("capacity")
                or node.get("stadiumCapacity")
            )

            if name or capacity:
                stadium = node
                break

        name = (
            stadium.get("stadiumName")
            or stadium.get("venueName")
            or stadium.get("stadium")
            or stadium.get("venue")
            or stadium.get("name")
            or self._first(
                data,
                "stadiumName",
                "venueName",
                "stadium",
            )
        )

        city = (
            stadium.get("city")
            or stadium.get("stadiumCity")
            or stadium.get("venueCity")
            or stadium.get("location")
            or self._first(
                data,
                "stadiumCity",
                "venueCity",
            )
        )

        capacity = (
            stadium.get("capacity")
            or stadium.get("stadiumCapacity")
            or self._first(
                data,
                "stadiumCapacity",
                "capacity",
            )
        )

        image = self._image(
            stadium.get("stadiumImage")
            or stadium.get("venueImage")
            or stadium.get("image")
            or stadium.get("images")
        )

        return {
            "name": name,
            "city": city,
            "capacity": capacity,
            "image": image,
        }

    def _manager(self, data: dict, team_name: str) -> list[dict]:
        """Extract the current manager/head coach."""
        manager = None

        for node in self._walk(data):
            if not isinstance(node, dict):
                continue

            role = self._normalise(
                node.get("role")
                or node.get("title")
                or node.get("position")
                or node.get("type")
            )
            name = (
                node.get("name")
                or node.get("fullName")
                or node.get("managerName")
                or node.get("coachName")
            )

            if name and any(
                word in role
                for word in ("manager", "coach", "head coach")
            ):
                manager = node
                break

            if name and any(
                key in node
                for key in ("managerId", "coachId")
            ):
                manager = node
                break

        if not manager:
            manager_name = self._first(
                data,
                "managerName",
                "coachName",
                "headCoachName",
            )
            if not manager_name:
                return []
            manager = {"name": manager_name}

        return [{
            "id": (
                manager.get("id")
                or manager.get("managerId")
                or manager.get("coachId")
            ),
            "name": (
                manager.get("name")
                or manager.get("fullName")
                or manager.get("managerName")
                or manager.get("coachName")
            ),
            "age": manager.get("age"),
            "nationality": (
                manager.get("nationality")
                or manager.get("country")
                or manager.get("countryName")
            ),
            "photo": self._image(
                manager.get("image")
                or manager.get("imageUrl")
                or manager.get("photo")
                or manager.get("headshot")
            ),
            "career": [{
                "team": {"name": team_name},
                "start": manager.get("startDate"),
                "end": manager.get("endDate"),
            }],
        }]

    def _squad(self, data: dict) -> list[dict]:
        """Extract squad players from the squad tab."""
        source = data.get("_football_hub_squad_tab") or data
        players: dict[str, dict] = {}

        for node in self._walk(source):
            if not isinstance(node, dict):
                continue

            player_id = node.get("id") or node.get("playerId")
            name = (
                node.get("name")
                or node.get("fullName")
                or node.get("playerName")
            )

            if not player_id or not name:
                continue

            if not any(
                key in node
                for key in (
                    "position",
                    "role",
                    "shirtNumber",
                    "jerseyNumber",
                    "age",
                    "birthDate",
                    "imageUrl",
                )
            ):
                continue

            players[str(player_id)] = {
                "id": player_id,
                "name": name,
                "age": node.get("age"),
                "number": (
                    node.get("shirtNumber")
                    or node.get("jerseyNumber")
                    or node.get("number")
                ),
                "position": (
                    node.get("position")
                    or node.get("role")
                    or node.get("positionName")
                ),
                "photo": self._image(
                    node.get("imageUrl")
                    or node.get("image")
                    or node.get("photo")
                ),
            }

        return list(players.values())

    def _injuries(self, data: dict) -> list[dict]:
        """Extract injuries and suspensions supplied in the team response."""
        output = []
        seen = set()

        for node in self._walk(data):
            if not isinstance(node, dict):
                continue

            status_text = self._normalise(
                node.get("injury")
                or node.get("reason")
                or node.get("status")
                or node.get("type")
                or node.get("description")
            )

            if not any(
                word in status_text
                for word in (
                    "injur",
                    "suspend",
                    "doubt",
                    "illness",
                    "out",
                )
            ):
                continue

            player = (
                node.get("player")
                if isinstance(node.get("player"), dict)
                else node
            )

            player_name = (
                player.get("name")
                or player.get("fullName")
                or node.get("playerName")
            )
            if not player_name:
                continue

            key = (
                self._normalise(player_name),
                status_text,
            )
            if key in seen:
                continue
            seen.add(key)

            output.append({
                "player": {
                    "id": (
                        player.get("id")
                        or node.get("playerId")
                    ),
                    "name": player_name,
                    "photo": self._image(
                        player.get("imageUrl")
                        or player.get("image")
                        or player.get("photo")
                    ),
                },
                "team": {},
                "type": (
                    node.get("type")
                    or node.get("status")
                ),
                "reason": (
                    node.get("reason")
                    or node.get("injury")
                    or node.get("description")
                ),
                "date": (
                    node.get("date")
                    or node.get("expectedReturn")
                    or node.get("returnDate")
                ),
            })

        return output

    def _transfers(self, data: dict) -> list[dict]:
        """Extract recent transfers from the transfers tab."""
        source = data.get("_football_hub_transfers_tab") or data
        output = []
        seen = set()

        for node in self._walk(source):
            if not isinstance(node, dict):
                continue

            player = (
                node.get("player")
                if isinstance(node.get("player"), dict)
                else node
            )

            player_name = (
                player.get("name")
                or player.get("fullName")
                or node.get("playerName")
            )

            from_team = (
                node.get("fromClub")
                or node.get("fromTeam")
                or node.get("fromTeamName")
            )
            to_team = (
                node.get("toClub")
                or node.get("toTeam")
                or node.get("toTeamName")
            )

            if not player_name or not (from_team or to_team):
                continue

            key = (
                self._normalise(player_name),
                self._normalise(from_team),
                self._normalise(to_team),
            )
            if key in seen:
                continue
            seen.add(key)

            output.append({
                "player": {
                    "id": (
                        player.get("id")
                        or node.get("playerId")
                    ),
                    "name": player_name,
                    "photo": self._image(
                        player.get("imageUrl")
                        or player.get("image")
                        or player.get("photo")
                    ),
                },
                "date": (
                    node.get("transferDate")
                    or node.get("date")
                ),
                "type": (
                    node.get("transferType")
                    or node.get("type")
                    or node.get("fee")
                ),
                "teams": {
                    "in": {"name": to_team},
                    "out": {"name": from_team},
                },
            })

        return output[:30]

    async def get_team(self, team_name: str) -> dict:
        data = await self._load_team(team_name)
        if not data:
            return {}

        match = data.get("_football_hub_fotmob_team") or {}

        return {
            "team": {
                "id": data.get("_football_hub_fotmob_id"),
                "name": match.get("name") or team_name,
                "logo": self._image(
                    self._first(
                        data,
                        "logo",
                        "logoUrl",
                        "teamLogo",
                    )
                ),
            },
            "venue": self._stadium(data),
        }

    async def get_coach(self, team_name: str) -> list[dict]:
        data = await self._load_team(team_name)
        return self._manager(data, team_name) if data else []

    async def get_squad(self, team_name: str) -> list[dict]:
        data = await self._load_team(team_name)
        if not data:
            return []

        players = self._squad(data)
        return [{
            "team": {"name": team_name},
            "players": players,
        }] if players else []

    async def get_injuries(self, team_name: str) -> list[dict]:
        data = await self._load_team(team_name)
        return self._injuries(data) if data else []

    async def get_transfers(self, team_name: str) -> list[dict]:
        data = await self._load_team(team_name)
        return self._transfers(data) if data else []
