"""Safe, provider-neutral helpers for Nuvio sports event links."""

from __future__ import annotations

import re
import unicodedata
from typing import Any
from urllib.parse import quote


def _normalise_name(value: object) -> str:
    """Return a forgiving comparison key for team names from separate providers."""
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(character for character in text if not unicodedata.combining(character))
    text = text.casefold().replace("&", " and ")
    words = re.findall(r"[a-z0-9]+", text)

    # Sports catalogues commonly add/remove generic club suffixes while still
    # referring to the same team (e.g. "Leon" vs "Club Leon", "Queretaro FC"
    # vs "Queretaro"). Ignore only those generic tokens; keep the distinctive
    # team name intact.
    generic = {
        "fc", "cf", "afc", "sc", "ac", "club", "football", "futbol",
        "soccer", "deportivo",
    }
    stripped = [word for word in words if word not in generic]
    return " ".join(stripped or words)


def _event_sides(name: object) -> tuple[str, str] | None:
    """Split a catalogue title only when it clearly names two teams."""
    parts = re.split(r"\s+(?:vs\.?|v\.?|versus)\s+", str(name or ""), flags=re.IGNORECASE)
    if len(parts) != 2:
        return None
    home, away = (_normalise_name(part) for part in parts)
    return (home, away) if home and away else None


def match_nuvio_event(home_team: object, away_team: object, events: list[dict[str, Any]]) -> dict[str, str] | None:
    """Find a single catalogue event that has the same two teams.

    A link is deliberately withheld when the catalogue has duplicate matches or
    a title that cannot be parsed.  Football Hub therefore never guesses a
    destination for a user.
    """
    expected = {_normalise_name(home_team), _normalise_name(away_team)}
    if not all(expected) or len(expected) != 2:
        return None

    matches: list[dict[str, str]] = []
    for event in events or []:
        if not isinstance(event, dict):
            continue
        event_id = str(event.get("id") or "").strip()
        name = str(event.get("name") or "").strip()
        sides = _event_sides(name)
        if event_id and sides and set(sides) == expected:
            matches.append({"id": event_id, "name": name})
    return matches[0] if len(matches) == 1 else None


def nuvio_deep_link(event_id: object) -> str:
    """Create Nuvio's documented details-page URL for a known sport item."""
    return f"nuvio://meta?type=sport&id={quote(str(event_id or ''), safe='')}"
