"""Low-scan persistent FotMob enrichment for Football Hub."""
from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Any

import aiohttp
from homeassistant.helpers.storage import Store

_LOGGER = logging.getLogger(__name__)

FOTMOB_BASE = "https://www.fotmob.com"
STORE_VERSION = 1
STORE_KEY = "football_hub_fm"

PROFILE_TTL = 30 * 24 * 60 * 60
MANAGER_TTL = 7 * 24 * 60 * 60
SQUAD_TTL = 7 * 24 * 60 * 60
TRANSFERS_TTL = 24 * 60 * 60
INJURIES_TTL = 24 * 60 * 60


class FotMobProvider:
    """Persist FotMob club enrichment in Home Assistant storage."""

    def __init__(self, hass, session: aiohttp.ClientSession, ccode3: str = "GBR"):
        self.hass = hass
        self.session = session
        self.ccode3 = ccode3
        self._store = Store(hass, STORE_VERSION, STORE_KEY)
        self._data: dict[str, Any] = {"teams": {}, "name_map": {}}
        self._loaded = False
        self._load_lock = asyncio.Lock()
        self._team_locks: dict[str, asyncio.Lock] = {}

    @staticmethod
    def _now() -> float:
        return datetime.now(timezone.utc).timestamp()

    @staticmethod
    def _normalise(value: Any) -> str:
        text = str(value or "").casefold()
        text = re.sub(r"[^a-z0-9]+", " ", text)
        return re.sub(r"\s+", " ", text).strip()

    async def _ensure_loaded(self) -> None:
        if self._loaded:
            return
        async with self._load_lock:
            if self._loaded:
                return
            stored = await self._store.async_load()
            if isinstance(stored, dict):
                self._data = stored
            self._data.setdefault("teams", {})
            self._data.setdefault("name_map", {})
            self._loaded = True

    async def _save(self) -> None:
        await self._store.async_save(self._data)

    def _fresh(self, record: dict, section: str, ttl: int) -> bool:
        stamp = ((record.get("updated") or {}).get(section))
        try:
            return self._now() - float(stamp) < ttl
        except (TypeError, ValueError):
            return False

    async def _get(self, path: str, params: dict[str, Any]) -> dict:
        url = f"{FOTMOB_BASE}/{path.lstrip('/')}"
        headers = {
            "Accept": "application/json",
            "Accept-Language": "en-GB,en;q=0.9",
            "Referer": "https://www.fotmob.com/",
            "User-Agent": "Mozilla/5.0 Football-Hub/Home-Assistant",
        }
        try:
            async with self.session.get(
                url,
                params=params,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30),
            ) as response:
                if response.status != 200:
                    _LOGGER.debug("FotMob HTTP %s for %s", response.status, url)
                    return {}
                data = await response.json(content_type=None)
                return data if isinstance(data, dict) else {}
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as err:
            _LOGGER.debug("FotMob request failed: %s", err)
            return {}

    @classmethod
    def _name_score(cls, wanted: str, candidate: str) -> int:
        a, b = cls._normalise(wanted), cls._normalise(candidate)
        if not a or not b:
            return 0
        if a == b:
            return 100
        if a in b or b in a:
            return 85
        aw, bw = set(a.split()), set(b.split())
        return int(70 * len(aw & bw) / len(aw)) if aw else 0

    async def _resolve_team(self, team_name: str) -> dict | None:
        await self._ensure_loaded()
        key = self._normalise(team_name)
        mapped = self._data["name_map"].get(key)
        if isinstance(mapped, dict) and mapped.get("id"):
            return mapped

        response = await self._get("api/searchData", {"term": team_name})
        best, best_score = None, 0
        for item in response.get("team") or response.get("teams") or []:
            if not isinstance(item, dict):
                continue
            name = item.get("name") or item.get("localizedName")
            team_id = item.get("id") or item.get("teamId")
            if not name or team_id in (None, ""):
                continue
            score = self._name_score(team_name, name)
            if score > best_score:
                best_score = score
                best = {"id": str(team_id), "name": name}

        if best_score < 60:
            return None

        self._data["name_map"][key] = best
        await self._save()
        return best

    @staticmethod
    def _image_url(kind: str, item_id: Any) -> str | None:
        if item_id in (None, ""):
            return None
        return f"https://images.fotmob.com/image_resources/{kind}/{item_id}.png"

    @staticmethod
    def _profile_from(data: dict) -> dict:
        details = data.get("details") or {}
        sports = details.get("sportsTeamJSONLD") or {}
        location = sports.get("location") or {}
        address = location.get("address") or {}

        venue_name = location.get("name")
        city = address.get("addressLocality")
        country = address.get("addressCountry")
        capacity = None
        opened = None

        for qa in data.get("QAData") or []:
            question = str(qa.get("question") or "").casefold()
            answer = str(qa.get("answer") or "")
            if "capacity" in question:
                match = re.search(r"(\d[\d,]*)", answer)
                if match:
                    capacity = int(match.group(1).replace(",", ""))
            elif "opened" in question:
                match = re.search(r"\b(18|19|20)\d{2}\b", answer)
                if match:
                    opened = int(match.group(0))
            elif "where is" in question and not venue_name:
                venue_name = answer.rsplit("called ", 1)[-1].rstrip(".") if "called " in answer else None

        return {
            "team": {
                "id": details.get("id"),
                "name": details.get("name"),
                "code": details.get("shortName"),
                "country": country or details.get("country"),
                "logo": sports.get("logo"),
            },
            "venue": {
                "name": venue_name,
                "city": city,
                "capacity": capacity,
                "opened": opened,
                "latitude": ((location.get("geo") or {}).get("latitude")),
                "longitude": ((location.get("geo") or {}).get("longitude")),
            },
        }

    @staticmethod
    def _manager_from(data: dict, team_name: str) -> list[dict]:
        overview = data.get("overview") or {}
        history = overview.get("coachHistory") or []
        if isinstance(history, dict):
            history = history.get("coachHistory") or history.get("coaches") or []
        if not isinstance(history, list) or not history:
            return []

        current = history[0] or {}
        name = current.get("name") or current.get("coachName")
        if not name:
            return []
        coach_id = current.get("id") or current.get("coachId")
        return [{
            "id": coach_id,
            "name": name,
            "age": current.get("age"),
            "nationality": current.get("country") or current.get("nationality"),
            "photo": FotMobProvider._image_url("playerimages", coach_id),
            "career": [{
                "team": {"name": team_name},
                "start": current.get("startDate"),
                "end": current.get("endDate"),
            }],
        }]

    @staticmethod
    def _squad_from(data: dict, team_name: str) -> list[dict]:
        raw = data.get("squad") or {}
        groups = raw.get("squad") if isinstance(raw, dict) else raw
        players: list[dict] = []

        if isinstance(groups, list):
            for group in groups:
                members = group.get("members") or group.get("players") or group.get("squad") or []
                if not members and (group.get("id") or group.get("playerId")):
                    members = [group]
                for player in members:
                    player_id = player.get("id") or player.get("playerId")
                    name = player.get("name") or player.get("playerName")
                    if not name:
                        continue
                    position = player.get("position")
                    if isinstance(position, dict):
                        position = position.get("label") or position.get("name")
                    players.append({
                        "id": player_id,
                        "name": name,
                        "age": player.get("age"),
                        "number": player.get("shirtNumber") or player.get("number"),
                        "position": position,
                        "photo": FotMobProvider._image_url("playerimages", player_id),
                    })

        return [{"team": {"name": team_name}, "players": players}] if players else []

    @staticmethod
    def _transfers_from(data: dict) -> list[dict]:
        transfers = data.get("transfers") or {}
        rows = transfers.get("allTransfers") or []
        output = []
        for item in rows[:40]:
            player_id = item.get("playerId")
            fee = item.get("fee")
            if isinstance(fee, dict):
                fee = fee.get("feeText") or fee.get("localizedFeeText") or fee.get("value")
            transfer_type = item.get("transferType")
            if isinstance(transfer_type, dict):
                transfer_type = transfer_type.get("text")
            output.append({
                "player": {
                    "id": player_id,
                    "name": item.get("name"),
                    "photo": FotMobProvider._image_url("playerimages", player_id),
                },
                "date": item.get("transferDate"),
                "type": transfer_type or fee,
                "teams": {
                    "in": {"name": item.get("toClubFullName") or item.get("toClub")},
                    "out": {"name": item.get("fromClubFullName") or item.get("fromClub")},
                },
            })
        return output

    @staticmethod
    def _injuries_from(data: dict) -> list[dict]:
        output = []
        seen = set()

        def walk(value: Any):
            if isinstance(value, dict):
                yield value
                for child in value.values():
                    yield from walk(child)
            elif isinstance(value, list):
                for child in value:
                    yield from walk(child)

        for node in walk(data.get("squad") or {}):
            text = " ".join(str(node.get(k) or "") for k in ("injury", "status", "reason", "availability")).casefold()
            if not any(word in text for word in ("injur", "suspend", "doubt", "illness", "unavailable")):
                continue
            player_id = node.get("id") or node.get("playerId")
            name = node.get("name") or node.get("playerName")
            if not name:
                continue
            key = (player_id, text)
            if key in seen:
                continue
            seen.add(key)
            output.append({
                "player": {
                    "id": player_id,
                    "name": name,
                    "photo": FotMobProvider._image_url("playerimages", player_id),
                },
                "team": {},
                "type": node.get("status") or node.get("availability"),
                "reason": node.get("injury") or node.get("reason"),
                "date": node.get("expectedReturn") or node.get("returnDate"),
            })
        return output

    async def _refresh(self, team_name: str, section: str) -> dict:
        match = await self._resolve_team(team_name)
        if not match:
            return {}

        team_id = str(match["id"])
        lock = self._team_locks.setdefault(team_id, asyncio.Lock())
        async with lock:
            record = self._data["teams"].setdefault(team_id, {
                "fotmob_id": team_id,
                "name": match.get("name") or team_name,
                "updated": {},
            })

            ttl = {
                "profile": PROFILE_TTL,
                "manager": MANAGER_TTL,
                "squad": SQUAD_TTL,
                "transfers": TRANSFERS_TTL,
                "injuries": INJURIES_TTL,
            }[section]
            if self._fresh(record, section, ttl) and record.get(section) not in (None, "", [], {}):
                return record

            params = {"id": team_id, "ccode3": self.ccode3}
            if section == "squad" or section == "injuries":
                params["tab"] = "squad"
            elif section == "transfers":
                params["tab"] = "transfers"

            response = await self._get("api/data/teams", params)
            if not response:
                return record

            if section == "profile":
                value = self._profile_from(response)
            elif section == "manager":
                value = self._manager_from(response, record["name"])
            elif section == "squad":
                value = self._squad_from(response, record["name"])
            elif section == "transfers":
                value = self._transfers_from(response)
            else:
                value = self._injuries_from(response)

            if value not in (None, "", [], {}):
                record[section] = value
                record["updated"][section] = self._now()
                await self._save()

            return record

    async def get_team(self, team_name: str) -> dict:
        record = await self._refresh(team_name, "profile")
        return record.get("profile") or {}

    async def get_coach(self, team_name: str) -> list[dict]:
        record = await self._refresh(team_name, "manager")
        return record.get("manager") or []

    async def get_squad(self, team_name: str) -> list[dict]:
        record = await self._refresh(team_name, "squad")
        return record.get("squad") or []

    async def get_injuries(self, team_name: str) -> list[dict]:
        record = await self._refresh(team_name, "injuries")
        return record.get("injuries") or []

    async def get_transfers(self, team_name: str) -> list[dict]:
        record = await self._refresh(team_name, "transfers")
        return record.get("transfers") or []
