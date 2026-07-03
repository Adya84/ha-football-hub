"""Player processing for Football Hub."""

from __future__ import annotations

from typing import Any

from .helpers import clean_player_record


def top_scorers(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Return cleaned top scorers."""
    return [clean_player_record(record) for record in data.get("top_scorers", []) or []]


def top_assists(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Return cleaned top assists."""
    return [clean_player_record(record) for record in data.get("top_assists", []) or []]
