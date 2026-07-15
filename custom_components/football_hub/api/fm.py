"""Experimental FotMob enrichment provider for Football Hub.

FotMob is used only as a fallback/enrichment source. ESPN remains the main
provider. If FotMob changes, blocks, or returns no data, Football Hub should
continue working with ESPN data.
"""
from __future__ import annotations

import re
from time import monotonic
from typing import Any

import aiohttp

FOTMOB_BASE = "https://www.fotmob.com/api"


class FotMobProvider:
    """Small defensive FotMob reader used to fill missing ESPN data."""

    def __init__(self, session):
        self.session = session
        self._search_cache: dict[str, tuple[float, dict | None]] = {}
        self._team_cache: dict[str, tuple[float, dict]] = {}

    @staticmethod
    def _norm(value: Any) -> str:
        text = str(value or "").lower()
        text = re.sub(r"[^a-z0-9]+", " ", text)
        return re.sub(r"\s+", " ", text).strip()

    @classmethod
    def _score_name(cls, wanted: str, candidate: str) -> int:
        wanted_n = cls._norm(wanted)
        candidate_n = cls._norm(candidate)
        if not wanted_n or not candidate_n:
            return 0
        if wanted_n == candidate_n:
            return 100
        if wanted_n in candidate_n or candidate_n in wanted_n:
            return 80
        wanted_words = set(wanted_n.split())
        candidate_words = set(candidate_n.split())
        if not wanted_words:
            return 0
        overlap = len(wanted_words & candidate_words)
        return int((overlap / len(wanted_words)) * 70)

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> dict:
        url = f"{FOTMOB_BASE}/{path.lstrip('/')}"
        async with self.session.get(
            url,
            params=params or {},
            headers={
                "Accept": "application/json",
                "User-Agent": "Football-Hub/Home-Assistant",
                "Referer": "https://www.fotmob.com/",
            },
            timeout=aiohttp.ClientTimeout(total=20),
        ) as response:
            if response.status >= 400:
                return {}
            data = await response.json(content_type=None)
        return data if isinstance(data, dict) else {}

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
    def _first_value(data: Any, keys: tuple[str, ...]) -> Any:
        wanted = {key.lower() for key in keys}
        for node in FotMobProvider._walk(data):
            for key, value in node.items():
                if str(key).lower() in wanted and value not in (None, "", [], {}):
                    return value
        return None

    @staticmethod
    def _image_from(value: Any) -> str | None:
        if isinstance(value, str) and value.startswith("http"):
            return value
        if isinstance(value, dict):
            for key in ("url", "imageUrl", "image", "photo", "src"):
                item = value.get(key)
                if isinstance(item, str) and item.startswith("http"):
                    return item
        if isinstance(value, list):
            for item in value:
                found = FotMobProvider._image_from(item)
                if found:
                    return found
        return None

    def _candidate_team(self, node: dict) -> tuple[str | None, str | int | None]:
        name = (
            node.get("name")
            or node.get("teamName")
            or node.get("title")
            or node.get("shortName")
            or node.get("localizedName")
        )
        team_id = node.get("id") or node.get("teamId") or node.get("pageId")
        return (str(name) if name else None, team_id)

    async def search_team(self, team_name: str) -> dict | None:
        key = self._norm(team_name)
        if not key:
            return None
        cached = self._search_cache.get(key)
        if cached and monotonic() - cached[0] < 24 * 60 * 60:
            return cached[1]

        data = await self._get("searchData", {"term": team_name})
        best: dict | None = None
        best_score = 0

        for node in self._walk(data):
            name, team_id = self._candidate_team(node)
            if not name or team_id in (None, ""):
                continue
            node_type = self._norm(node.get("type") or node.get("entityType") or node.get("pageType"))
            # Prefer football teams but stay flexible because FotMob's search JSON changes.
            type_bonus = 10 if "team" in node_type or not node_type else 0
            score = self._score_name(team_name, name) + type_bonus
            if score > best_score:
                best_score = score
                best = {"id": team_id, "name": name, "raw": node}

        if best_score < 55:
            best = None

        self._search_cache[key] = (monotonic(), best)
        return best

    async def team_data(self, team_name: str) -> dict:
        match = await self.search_team(team_name)
        if not match:
            return {}

        team_id = str(match["id"])
        cached = self._team_cache.get(team_id)
        if cached and monotonic() - cached[0] < 6 * 60 * 60:
            return cached[1]

        data = await self._get("teams", {"id": team_id})
        if data:
            data["_fotmob_team"] = match
            data["_fotmob_id"] = team_id
        self._team_cache[team_id] = (monotonic(), data)
        return data

    def _stadium(self, data: dict) -> dict:
        stadium_node = None
        for node in self._walk(data):
            keys = {str(k).lower() for k in node.keys()}
            if {"stadium", "capacity"} & keys or {"venue", "capacity"} & keys:
                stadium_node = node
                break

        stadium_node = stadium_node or {}
        name = (
            stadium_node.get("stadium")
            or stadium_node.get("venue")
            or stadium_node.get("name")
            or stadium_node.get("stadiumName")
            or self._first_value(data, ("stadiumName", "stadium", "venueName"))
        )
        city = (
            stadium_node.get("city")
            or stadium_node.get("location")
            or self._first_value(data, ("city", "venueCity", "stadiumCity"))
        )
        capacity = stadium_node.get("capacity") or self._first_value(data, ("capacity", "stadiumCapacity"))
        image = self._image_from(stadium_node.get("image") or stadium_node.get("images")) or self._image_from(
            self._first_value(data, ("stadiumImage", "venueImage"))
        )

        return {
            "name": name,
            "city": city,
            "capacity": capacity,
            "image": image,
        }

    def _manager(self, data: dict, team_name: str) -> list[dict]:
        best = None
        for node in self._walk(data):
            label = self._norm(node.get("role") or node.get("title") or node.get("type") or node.get("position"))
            has_manager_label = any(word in label for word in ("coach", "manager", "head coach"))
            has_name = node.get("name") or node.get("fullName")
            if has_name and has_manager_label:
                best = node
                break
            if has_name and any(key in node for key in ("coachId", "managerId")):
                best = node
                break

        if not best:
            return []

        photo = self._image_from(best.get("image") or best.get("photo") or best.get("headshot"))
        return [{
            "id": best.get("id") or best.get("coachId") or best.get("managerId"),
            "name": best.get("name") or best.get("fullName"),
            "age": best.get("age"),
            "nationality": best.get("country") or best.get("nationality"),
            "photo": photo,
            "career": [{"team": {"name": team_name}, "start": None, "end": None}],
        }]

    def _players(self, data: dict) -> list[dict]:
        players: dict[str, dict] = {}

        for node in self._walk(data):
            name = node.get("name") or node.get("fullName") or node.get("playerName")
            player_id = node.get("id") or node.get("playerId")
            if not name or not player_id:
                continue
            if not any(k in node for k in ("position", "role", "shirtNumber", "number", "age", "imageUrl", "photo")):
                continue
            key = str(player_id)
            players[key] = {
                "id": player_id,
                "name": name,
                "age": node.get("age"),
                "number": node.get("shirtNumber") or node.get("number") or node.get("jerseyNumber"),
                "position": node.get("position") or node.get("role"),
                "photo": self._image_from(node.get("imageUrl") or node.get("image") or node.get("photo")),
            }

        return list(players.values())

    def _injuries(self, data: dict) -> list[dict]:
        output = []
        for node in self._walk(data):
            status = self._norm(node.get("status") or node.get("injury") or node.get("type") or node.get("reason"))
            if not any(word in status for word in ("injur", "suspend", "doubt", "out")):
                continue
            player = node.get("player") if isinstance(node.get("player"), dict) else node
            name = player.get("name") or player.get("fullName") or node.get("playerName")
            if not name:
                continue
            output.append({
                "player": {
                    "id": player.get("id") or node.get("playerId"),
                    "name": name,
                    "photo": self._image_from(player.get("imageUrl") or player.get("image") or player.get("photo")),
                },
                "team": {},
                "type": node.get("type") or node.get("status"),
                "reason": node.get("reason") or node.get("injury") or node.get("description"),
                "date": node.get("date") or node.get("expectedReturn"),
            })
        return output

    def _transfers(self, data: dict) -> list[dict]:
        output = []
        for node in self._walk(data):
            if not any(k in node for k in ("fromClub", "toClub", "transferDate", "fee", "type")):
                continue
            player = node.get("player") if isinstance(node.get("player"), dict) else node
            name = player.get("name") or player.get("fullName") or node.get("playerName")
            if not name:
                continue
            output.append({
                "player": {
                    "id": player.get("id") or node.get("playerId"),
                    "name": name,
                    "photo": self._image_from(player.get("imageUrl") or player.get("image") or player.get("photo")),
                },
                "date": node.get("transferDate") or node.get("date"),
                "type": node.get("type") or node.get("transferType"),
                "teams": {
                    "in": {"name": node.get("toClub") or node.get("toTeam")},
                    "out": {"name": node.get("fromClub") or node.get("fromTeam")},
                },
            })
        return output[:25]

    async def get_team(self, team_name: str) -> dict:
        data = await self.team_data(team_name)
        if not data:
            return {}
        match = data.get("_fotmob_team") or {}
        team_logo = self._image_from(self._first_value(data, ("logo", "logoUrl", "imageUrl")))
        return {
            "team": {
                "id": data.get("_fotmob_id"),
                "name": match.get("name") or team_name,
                "logo": team_logo,
            },
            "venue": self._stadium(data),
        }

    async def get_coach(self, team_name: str) -> list[dict]:
        data = await self.team_data(team_name)
        return self._manager(data, team_name) if data else []

    async def get_squad(self, team_name: str) -> list[dict]:
        data = await self.team_data(team_name)
        if not data:
            return []
        players = self._players(data)
        return [{"team": {"name": team_name}, "players": players}] if players else []

    async def get_injuries(self, team_name: str) -> list[dict]:
        data = await self.team_data(team_name)
        return self._injuries(data) if data else []

    async def get_transfers(self, team_name: str) -> list[dict]:
        data = await self.team_data(team_name)
        return self._transfers(data) if data else []
