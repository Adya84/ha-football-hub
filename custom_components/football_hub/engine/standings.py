"""Standings engine for Football Hub."""

from __future__ import annotations

from typing import Any


def standings(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Return raw standings response."""
    return data.get("standings", []) or []


def standings_summary(data: dict[str, Any]) -> dict[str, Any]:
    """Return standings summary."""
    rows = standings(data)
    return {
        "total_standings": len(rows),
        "standings": rows,
    }
