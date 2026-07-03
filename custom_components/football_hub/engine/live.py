"""Live engine for Football Hub."""

from __future__ import annotations

from typing import Any

from .helpers import clean_fixture, sort_by_time


def live_matches(raw_live: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return live matches as clean objects."""
    return [clean_fixture(m) for m in sort_by_time(raw_live or [])]


def primary_live_match(raw_live: list[dict[str, Any]]) -> dict[str, Any]:
    """Return first live match."""
    matches = live_matches(raw_live)
    return matches[0] if matches else {}
