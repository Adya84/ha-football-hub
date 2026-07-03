"""Fixture engine for Football Hub."""

from __future__ import annotations

from typing import Any

from .helpers import clean_fixture, fixture_timestamp, is_upcoming, limit_list, utc_now_ts


def raw_fixtures(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Return raw fixtures list."""
    return data.get("fixtures", []) or []


def upcoming_fixtures(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Return cleaned upcoming fixtures sorted by kickoff."""
    now_ts = utc_now_ts()
    fixtures = [
        match
        for match in raw_fixtures(data)
        if is_upcoming(match) and fixture_timestamp(match) >= now_ts
    ]
    fixtures.sort(key=fixture_timestamp)
    return [clean_fixture(match) for match in fixtures]


def next_fixture(data: dict[str, Any]) -> dict[str, Any]:
    """Return the next fixture."""
    fixtures = upcoming_fixtures(data)
    return fixtures[0] if fixtures else {}


def fixture_summary(data: dict[str, Any], limit: int = 20) -> dict[str, Any]:
    """Return fixture summary for sensor attributes."""
    fixtures = upcoming_fixtures(data)
    return {
        "total_fixtures": len(fixtures),
        "showing": min(len(fixtures), limit),
        "fixtures": limit_list(fixtures, limit),
    }
