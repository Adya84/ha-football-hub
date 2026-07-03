"""Standings processing for Football Hub."""

from __future__ import annotations

from typing import Any


def standings(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Return standings."""
    return data.get("standings", []) or []


def standings_count(data: dict[str, Any]) -> int:
    """Return standings count."""
    return len(standings(data))
