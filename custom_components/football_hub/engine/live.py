"""Live engine for Football Hub."""

from __future__ import annotations

from typing import Any

from .helpers import clean_fixture, sort_by_time


def live_matches(raw_live: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return live matches as clean objects."""
    return [clean_fixture(match) for match in sort_by_time(raw_live or [])]


def primary_live_match(raw_live: list[dict[str, Any]]) -> dict[str, Any]:
    """Return the first live match."""
    matches = live_matches(raw_live)
    return matches[0] if matches else {}


def live_match_state(raw_live: list[dict[str, Any]]) -> str:
    """Return a useful state for the primary live match."""
    match = primary_live_match(raw_live)
    if not match:
        return "No live match"

    status = match.get("status_short") or "LIVE"
    elapsed = match.get("elapsed")

    if status in {"1H", "2H", "ET"} and elapsed is not None:
        return f"{elapsed}'"

    return status
