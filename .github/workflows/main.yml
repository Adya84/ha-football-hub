"""Refresh the Welsh-only Football Hub cache used by Home Assistant."""
from __future__ import annotations

import json
from datetime import timedelta
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from curl_cffi import requests

ROOT = Path(__file__).resolve().parents[1]
BASES = ("https://api.sofascore.com/api/v1", "https://www.sofascore.com/api/v1")
LEAGUES = {
    "cymru_north": 13820,
    "cymru_south": 13821,
}


def get(path: str) -> dict:
    last_error = None
    for base in BASES:
        try:
            response = requests.get(
                f"{base}/{path}",
                impersonate="chrome",
                headers={
                    "Accept": "application/json, text/plain, */*",
                    "Accept-Language": "en-GB,en;q=0.9",
                    "Origin": "https://www.sofascore.com",
                    "Referer": "https://www.sofascore.com/",
                    # SofaScore's CDN challenges API requests without this.
                    "X-Requested-With": "XMLHttpRequest",
                },
                timeout=30,
            )
            response.raise_for_status()
            value = response.json()
            return value if isinstance(value, dict) else {}
        except Exception as err:
            last_error = err
    raise RuntimeError(f"Unable to refresh {path}: {last_error}")


def find_event(value: Any) -> dict | None:
    if isinstance(value, dict):
        if isinstance(value.get("season"), dict) and value["season"].get("id"):
            return value
        for child in value.values():
            found = find_event(child)
            if found:
                return found
    elif isinstance(value, list):
        for child in value:
            found = find_event(child)
            if found:
                return found
    return None


def refresh(slug: str, unique_id: int) -> None:
    destination = ROOT / "welsh_data" / f"{slug}.json"
    existing = {}
    if destination.exists():
        existing = json.loads(destination.read_text(encoding="utf-8"))

    now = datetime.now(timezone.utc)
    updated_text = str(existing.get("updated_at") or "")
    try:
        updated = datetime.fromisoformat(updated_text)
    except ValueError:
        updated = datetime.min.replace(tzinfo=timezone.utc)
    match_window = any(
        -3 * 60 * 60 <= int(event.get("startTimestamp") or 0) - int(now.timestamp()) <= 4 * 60 * 60
        for event in existing.get("events") or []
    )
    full_refresh = now - updated >= timedelta(hours=6)
    if not full_refresh and not match_window:
        return

    season_id = existing.get("season_id")
    tournament_id = existing.get("tournament_id")
    context = None
    if not season_id:
        featured = get(f"unique-tournament/{unique_id}/featured-events")
        context = find_event(featured)
        if not context:
            seasons = get(f"unique-tournament/{unique_id}/seasons").get("seasons") or []
            if not seasons:
                raise RuntimeError(f"No active season found for {slug}")
            season_id = int(seasons[0]["id"])
            first_page = get(f"unique-tournament/{unique_id}/season/{season_id}/events/next/0")
            context = find_event(first_page)
        else:
            season_id = int(context["season"]["id"])

    tournament = (context or {}).get("tournament") or {}
    tournament_id = tournament_id or tournament.get("id")
    events: dict[str, dict] = {
        str(event["id"]): event
        for event in existing.get("events") or []
        if event.get("id") is not None
    }
    for direction in ("last", "next"):
        for page in range(12 if full_refresh else 1):
            payload = get(
                f"unique-tournament/{unique_id}/season/{season_id}/events/{direction}/{page}"
            )
            batch = payload.get("events") or []
            for event in batch:
                if event.get("id") is not None:
                    events[str(event["id"])] = event
            if not payload.get("hasNextPage") or not batch:
                break

    standings = existing.get("standings") or []
    if full_refresh or not standings:
        standings_path = (
            f"tournament/{tournament_id}/season/{season_id}/standings/total"
            if tournament_id
            else f"unique-tournament/{unique_id}/season/{season_id}/standings/total"
        )
        standings_payload = get(standings_path)
        standings = []
        for group in standings_payload.get("standings") or []:
            standings.extend(group.get("rows") or [])

    output = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "unique_tournament_id": unique_id,
        "season_id": season_id,
        "tournament_id": tournament_id,
        "events": sorted(events.values(), key=lambda item: item.get("startTimestamp") or 0),
        "standings": standings,
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    for league_slug, tournament_id in LEAGUES.items():
        refresh(league_slug, tournament_id)
