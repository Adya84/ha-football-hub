"""Player engine for Football Hub."""

from __future__ import annotations

from typing import Any

from .helpers import limit_list


def top_scorers(data: dict[str, Any], limit: int = 20) -> dict[str, Any]:
    """Return top scorers summary."""
    scorers = data.get("top_scorers", []) or []
    return {
        "total_top_scorers": len(scorers),
        "showing": min(len(scorers), limit),
        "top_scorers": limit_list(scorers, limit),
    }


def top_assists(data: dict[str, Any], limit: int = 20) -> dict[str, Any]:
    """Return top assists summary."""
    assists = data.get("top_assists", []) or []
    return {
        "total_top_assists": len(assists),
        "showing": min(len(assists), limit),
        "top_assists": limit_list(assists, limit),
    }
