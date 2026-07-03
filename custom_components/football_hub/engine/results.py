"""Results engine for Football Hub."""

from __future__ import annotations

from typing import Any

from .helpers import clean_fixture, fixture_timestamp, is_finished, limit_list
from .fixtures import raw_fixtures


def results(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Return cleaned finished fixtures, newest first."""
    matches = [match for match in raw_fixtures(data) if is_finished(match)]
    matches.sort(key=fixture_timestamp, reverse=True)
    return [clean_fixture(match) for match in matches]


def last_result(data: dict[str, Any]) -> dict[str, Any]:
    """Return latest completed match."""
    matches = results(data)
    return matches[0] if matches else {}


def results_summary(data: dict[str, Any], limit: int = 20) -> dict[str, Any]:
    """Return results summary for sensor attributes."""
    matches = results(data)
    return {
        "total_results": len(matches),
        "showing": min(len(matches), limit),
        "results": limit_list(matches, limit),
    }
