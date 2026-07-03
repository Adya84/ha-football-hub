"""Live match processing for Football Hub."""

from __future__ import annotations

from typing import Any

from .helpers import clean_fixture, sort_by_kickoff


def live_matches(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Return cleaned live matches."""
    matches = data.get("live", []) or []
    return [clean_fixture(match) for match in sort_by_kickoff(matches)]


def live_count(data: dict[str, Any]) -> int:
    """Return live match count."""
    return len(live_matches(data))
