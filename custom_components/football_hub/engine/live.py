"""Live engine for Football Hub."""

from __future__ import annotations

from typing import Any

from .helpers import clean_fixture, fixture_timestamp, is_live, limit_list


def raw_live(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Return raw live data."""
    return data.get("live", []) or []


def live_matches(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Return cleaned live matches."""
    matches = raw_live(data)
    if not matches:
        # fallback in case API puts live states in fixture list
        matches = [match for match in data.get("fixtures", []) or [] if is_live(match)]
    matches.sort(key=fixture_timestamp)
    return [clean_fixture(match) for match in matches]


def live_summary(data: dict[str, Any], limit: int = 20) -> dict[str, Any]:
    """Return live summary for sensor attributes."""
    matches = live_matches(data)
    return {
        "total_live": len(matches),
        "showing": min(len(matches), limit),
        "matches": limit_list(matches, limit),
    }
