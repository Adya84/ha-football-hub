"""Shared Football Hub engine helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


FINISHED_STATUSES = {"FT", "AET", "PEN"}
NOT_STARTED_STATUSES = {"NS", "TBD"}
LIVE_STATUSES = {"1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"}


def get_fixture(match: dict[str, Any]) -> dict[str, Any]:
    """Return the fixture object."""
    return match.get("fixture", {}) or {}


def get_league(match: dict[str, Any]) -> dict[str, Any]:
    """Return the league object."""
    return match.get("league", {}) or {}


def get_teams(match: dict[str, Any]) -> dict[str, Any]:
    """Return the teams object."""
    return match.get("teams", {}) or {}


def get_status(match: dict[str, Any]) -> dict[str, Any]:
    """Return fixture status object."""
    return get_fixture(match).get("status", {}) or {}


def status_short(match: dict[str, Any]) -> str | None:
    """Return short fixture status."""
    return get_status(match).get("short")


def is_finished(match: dict[str, Any]) -> bool:
    """Return true if the match is finished."""
    return status_short(match) in FINISHED_STATUSES


def is_not_started(match: dict[str, Any]) -> bool:
    """Return true if the match has not started."""
    return status_short(match) in NOT_STARTED_STATUSES


def is_live(match: dict[str, Any]) -> bool:
    """Return true if the match is live."""
    return status_short(match) in LIVE_STATUSES


def fixture_timestamp(match: dict[str, Any]) -> int:
    """Return fixture timestamp."""
    return get_fixture(match).get("timestamp") or 0


def now_timestamp() -> int:
    """Return current UTC timestamp."""
    return int(datetime.now(timezone.utc).timestamp())


def sort_by_kickoff(matches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sort matches by kickoff time."""
    return sorted(matches, key=fixture_timestamp)


def clean_fixture(match: dict[str, Any] | None) -> dict[str, Any]:
    """Return a clean Football Hub fixture object."""
    if not match:
        return {}

    fixture = get_fixture(match)
    league = get_league(match)
    teams = get_teams(match)
    goals = match.get("goals", {}) or {}
    score = match.get("score", {}) or {}
    venue = fixture.get("venue", {}) or {}
    status = fixture.get("status", {}) or {}

    home = teams.get("home", {}) or {}
    away = teams.get("away", {}) or {}

    return {
        "fixture_id": fixture.get("id"),
        "kickoff": fixture.get("date"),
        "timestamp": fixture.get("timestamp"),
        "timezone": fixture.get("timezone"),
        "status": status.get("long"),
        "status_short": status.get("short"),
        "elapsed": status.get("elapsed"),
        "extra": status.get("extra"),
        "league_id": league.get("id"),
        "league": league.get("name"),
        "country": league.get("country"),
        "league_logo": league.get("logo"),
        "country_flag": league.get("flag"),
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
        "score": score,
        "stadium": venue.get("name"),
        "city": venue.get("city"),
        "raw": match,
    }


def clean_player_record(record: dict[str, Any]) -> dict[str, Any]:
    """Return a clean player statistics object."""
    player = record.get("player", {}) or {}
    stats = (record.get("statistics") or [{}])[0] or {}
    team = stats.get("team", {}) or {}
    league = stats.get("league", {}) or {}
    games = stats.get("games", {}) or {}
    goals = stats.get("goals", {}) or {}
    cards = stats.get("cards", {}) or {}

    return {
        "player_id": player.get("id"),
        "name": player.get("name"),
        "firstname": player.get("firstname"),
        "lastname": player.get("lastname"),
        "age": player.get("age"),
        "nationality": player.get("nationality"),
        "photo": player.get("photo"),
        "team_id": team.get("id"),
        "team": team.get("name"),
        "team_logo": team.get("logo"),
        "league": league.get("name"),
        "season": league.get("season"),
        "appearances": games.get("appearences"),
        "lineups": games.get("lineups"),
        "minutes": games.get("minutes"),
        "position": games.get("position"),
        "rating": games.get("rating"),
        "goals": goals.get("total"),
        "assists": goals.get("assists"),
        "yellow_cards": cards.get("yellow"),
        "red_cards": cards.get("red"),
        "raw": record,
    }
