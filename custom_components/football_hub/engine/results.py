"""Result processing for Football Hub."""

from __future__ import annotations

from typing import Any

from .helpers import clean_fixture, is_finished, sort_by_kickoff


def results(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Return cleaned finished results, latest first."""
    fixtures = data.get("fixtures", []) or []
    matches = [match for match in fixtures if is_finished(match)]
    return list(reversed([clean_fixture(match) for match in sort_by_kickoff(matches)]))


def last_result(data: dict[str, Any]) -> dict[str, Any]:
    """Return the latest result."""
    all_results = results(data)
    return all_results[0] if all_results else {}


def results_count(data: dict[str, Any]) -> int:
    """Return result count."""
    return len(results(data))
