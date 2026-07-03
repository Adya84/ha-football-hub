"""Shared Football Hub engine helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

FINISHED_STATUSES = {"FT", "AET", "PEN"}
UPCOMING_STATUSES = {"NS", "TBD"}
LIVE_STATUSES = {"1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"}

STATUS_TEXT = {
    "TBD": "Time To Be Defined",
    "NS": "Not Started",
    "1H": "First Half",
    "HT": "Half Time",
    "2H": "Second Half",
    "ET": "Extra Time",
    "BT": "Break Time",
    "P": "Penalties",
    "SUSP": "Suspended",
    "INT": "Interrupted",
    "FT": "Full Time",
    "AET": "After Extra Time",
    "PEN": "Penalties Finished",
    "PST": "Postponed",
    "CANC": "Cancelled",
    "ABD": "Abandoned",
    "AWD": "Technical Loss",
    "WO": "Walkover",
}


def safe_get(data: dict[str, Any] | None, *keys: str, default: Any = None) -> Any:
    """Safely read nested dictionary values."""
    current: Any = data or {}
    for key in keys:
        if not isinstance(current, dict):
            return default
        current = current.get(key)
    return default if current is None else current


def utc_now_ts() -> int:
    """Return current UTC timestamp."""
    return int(datetime.now(timezone.utc).timestamp())


def parse_iso(value: str | None) -> datetime | None:
    """Parse API ISO datetime safely."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def format_uk_datetime(value: str | None) -> str | None:
    """Return a simple UK-friendly datetime string."""
    parsed = parse_iso(value)
    if not parsed:
        return None
    return parsed.strftime("%d/%m/%Y %H:%M")


def status_short(match: dict[str, Any]) -> str | None:
    """Return fixture short status."""
    return safe_get(match, "fixture", "status", "short")


def status_long(match: dict[str, Any]) -> str | None:
    """Return human-readable status."""
    short = status_short(match)
    return STATUS_TEXT.get(short, safe_get(match, "fixture", "status", "long", default=short))


def fixture_timestamp(match: dict[str, Any]) -> int:
    """Return fixture timestamp."""
    value = safe_get(match, "fixture", "timestamp", default=0)
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def is_finished(match: dict[str, Any]) -> bool:
    """Return True if match is finished."""
    return status_short(match) in FINISHED_STATUSES


def is_upcoming(match: dict[str, Any]) -> bool:
    """Return True if match has not started."""
    return status_short(match) in UPCOMING_STATUSES


def is_live(match: dict[str, Any]) -> bool:
    """Return True if match is live."""
    return status_short(match) in LIVE_STATUSES


def clean_fixture(match: dict[str, Any] | None) -> dict[str, Any]:
    """Convert raw API fixture into a clean Football Hub fixture object."""
    if not match:
        return {}

    fixture = match.get("fixture", {}) or {}
    league = match.get("league", {}) or {}
    teams = match.get("teams", {}) or {}
    goals = match.get("goals", {}) or {}
    score = match.get("score", {}) or {}
    venue = fixture.get("venue", {}) or {}
    status = fixture.get("status", {}) or {}
    home = teams.get("home", {}) or {}
    away = teams.get("away", {}) or {}

    kickoff = fixture.get("date")
    elapsed = status.get("elapsed")
    status_s = status.get("short")

    return {
        "fixture_id": fixture.get("id"),
        "kickoff": kickoff,
        "kickoff_uk": format_uk_datetime(kickoff),
        "timestamp": fixture.get("timestamp"),
        "timezone": fixture.get("timezone"),
        "status": STATUS_TEXT.get(status_s, status.get("long")),
        "status_short": status_s,
        "elapsed": elapsed,
        "is_live": status_s in LIVE_STATUSES,
        "is_finished": status_s in FINISHED_STATUSES,
        "is_upcoming": status_s in UPCOMING_STATUSES,
        "league": league.get("name"),
        "league_id": league.get("id"),
        "country": league.get("country"),
        "season": league.get("season"),
        "round": league.get("round"),
        "home_team": home.get("name"),
        "home_team_id": home.get("id"),
        "home_logo": home.get("logo"),
        "home_winner": home.get("winner"),
        "away_team": away.get("name"),
        "away_team_id": away.get("id"),
        "away_logo": away.get("logo"),
        "away_winner": away.get("winner"),
        "home_goals": goals.get("home"),
        "away_goals": goals.get("away"),
        "scoreline": make_scoreline(home.get("name"), away.get("name"), goals.get("home"), goals.get("away")),
        "score": score,
        "stadium": venue.get("name"),
        "city": venue.get("city"),
        "referee": fixture.get("referee"),
    }


def make_scoreline(home: str | None, away: str | None, home_goals: Any, away_goals: Any) -> str | None:
    """Return a readable scoreline."""
    if not home or not away:
        return None
    if home_goals is None or away_goals is None:
        return f"{home} vs {away}"
    return f"{home} {home_goals}-{away_goals} {away}"


def limit_list(items: list[Any], limit: int = 20) -> list[Any]:
    """Limit attribute payloads to keep Home Assistant recorder happy."""
    return items[:limit]
