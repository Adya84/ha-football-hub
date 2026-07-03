"""Fixture processing for Football Hub."""

from __future__ import annotations

from typing import Any

from .helpers import clean_fixture, fixture_timestamp, is_not_started, now_timestamp, sort_by_kickoff


def upcoming_fixtures(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Return cleaned upcoming fixtures."""
    now_ts = now_timestamp()
    fixtures = data.get("fixtures", []) or []

    matches = [
        match
        for match in fixtures
        if is_not_started(match) and fixture_timestamp(match) >= now_ts
    ]

    return [clean_fixture(match) for match in sort_by_kickoff(matches)]


def next_fixture(data: dict[str, Any]) -> dict[str, Any]:
    """Return the next fixture."""
    fixtures = upcoming_fixtures(data)
    return fixtures[0] if fixtures else {}


def fixtures_count(data: dict[str, Any]) -> int:
    """Return upcoming fixture count."""
    return len(upcoming_fixtures(data))
