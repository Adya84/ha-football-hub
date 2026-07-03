"""Football Hub sensors."""

from __future__ import annotations

from datetime import datetime, timezone

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from ..competitions import COMPETITIONS, SEASONS
from ..const import DOMAIN

MAX_ATTRIBUTE_ITEMS = 20


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities):
    """Set up Football Hub sensors."""
    coordinator = hass.data[DOMAIN][entry.entry_id]["coordinator"]

    async_add_entities(
        [
            FootballHubStatusSensor(coordinator, entry),
            FootballHubLiveSensor(coordinator, entry),
            FootballHubNextFixtureSensor(coordinator, entry),
            FootballHubFixturesSensor(coordinator, entry),
            FootballHubResultsSensor(coordinator, entry),
            FootballHubStandingsSensor(coordinator, entry),
            FootballHubTopScorersSensor(coordinator, entry),
            FootballHubTopAssistsSensor(coordinator, entry),
        ]
    )


class FootballHubBaseSensor(CoordinatorEntity, SensorEntity):
    """Base Football Hub sensor."""

    def __init__(self, coordinator, entry: ConfigEntry, key: str, name: str):
        super().__init__(coordinator)
        self.entry = entry
        self.key = key
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_name = f"{entry.title} {name}"


def _fixtures(coordinator):
    return coordinator.data.get("fixtures", []) or []


def _live(coordinator):
    return coordinator.data.get("live", []) or []


def _is_finished(match):
    return match.get("fixture", {}).get("status", {}).get("short") in {
        "FT",
        "AET",
        "PEN",
    }


def _is_not_started(match):
    return match.get("fixture", {}).get("status", {}).get("short") in {
        "NS",
        "TBD",
    }


def _fixture_timestamp(match):
    return match.get("fixture", {}).get("timestamp") or 0


def _next_fixture(coordinator):
    now_ts = int(datetime.now(timezone.utc).timestamp())
    upcoming = [
        match
        for match in _fixtures(coordinator)
        if _is_not_started(match) and _fixture_timestamp(match) >= now_ts
    ]

    if not upcoming:
        return None

    return sorted(upcoming, key=_fixture_timestamp)[0]


def _clean_fixture(match):
    if not match:
        return {}

    fixture = match.get("fixture", {})
    league = match.get("league", {})
    teams = match.get("teams", {})
    goals = match.get("goals", {})
    venue = fixture.get("venue", {})
    status = fixture.get("status", {})

    home = teams.get("home", {})
    away = teams.get("away", {})

    return {
        "fixture_id": fixture.get("id"),
        "kickoff": fixture.get("date"),
        "timestamp": fixture.get("timestamp"),
        "status": status.get("long"),
        "status_short": status.get("short"),
        "elapsed": status.get("elapsed"),
        "league": league.get("name"),
        "country": league.get("country"),
        "season": league.get("season"),
        "round": league.get("round"),
        "home_team": home.get("name"),
        "home_team_id": home.get("id"),
        "home_logo": home.get("logo"),
        "away_team": away.get("name"),
        "away_team_id": away.get("id"),
        "away_logo": away.get("logo"),
        "home_goals": goals.get("home"),
        "away_goals": goals.get("away"),
        "stadium": venue.get("name"),
        "city": venue.get("city"),
    }


def _limited(items, limit=MAX_ATTRIBUTE_ITEMS):
    return items[:limit]


class FootballHubStatusSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "status", "Status")

    @property
    def native_value(self):
        return "Online"

    @property
    def extra_state_attributes(self):
        competition_key = self.entry.data.get("competition")
        competition = COMPETITIONS.get(competition_key, {})
        season = self.entry.data.get("season")
        fixtures = _fixtures(self.coordinator)
        results = [match for match in fixtures if _is_finished(match)]
        upcoming = [match for match in fixtures if _is_not_started(match)]

        return {
            "competition": competition.get("name"),
            "country": competition.get("country"),
            "league_id": competition.get("league_id"),
            "season": SEASONS.get(season, season),
            "provider_mode": self.entry.data.get("provider_mode"),
            "live_count": len(_live(self.coordinator)),
            "fixtures_count": len(upcoming),
            "results_count": len(results),
            "standings_count": len(self.coordinator.data.get("standings", []) or []),
            "top_scorers_count": len(self.coordinator.data.get("top_scorers", []) or []),
            "top_assists_count": len(self.coordinator.data.get("top_assists", []) or []),
            "attribute_limit": MAX_ATTRIBUTE_ITEMS,
        }


class FootballHubLiveSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "live_matches", "Live Matches")

    @property
    def native_value(self):
        return len(_live(self.coordinator))

    @property
    def extra_state_attributes(self):
        live = [_clean_fixture(match) for match in _live(self.coordinator)]
        return {
            "total_live": len(live),
            "matches": _limited(live),
        }


class FootballHubNextFixtureSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "next_fixture", "Next Fixture")

    @property
    def native_value(self):
        clean = _clean_fixture(_next_fixture(self.coordinator))
        if not clean:
            return None
        return f"{clean.get('home_team')} vs {clean.get('away_team')}"

    @property
    def extra_state_attributes(self):
        return _clean_fixture(_next_fixture(self.coordinator))


class FootballHubFixturesSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "fixtures", "Fixtures")

    @property
    def native_value(self):
        return len([match for match in _fixtures(self.coordinator) if _is_not_started(match)])

    @property
    def extra_state_attributes(self):
        fixtures = [
            _clean_fixture(match)
            for match in sorted(_fixtures(self.coordinator), key=_fixture_timestamp)
            if _is_not_started(match)
        ]

        return {
            "total_fixtures": len(fixtures),
            "shown_fixtures": min(len(fixtures), MAX_ATTRIBUTE_ITEMS),
            "fixtures": _limited(fixtures),
        }


class FootballHubResultsSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "results", "Results")

    @property
    def native_value(self):
        return len([match for match in _fixtures(self.coordinator) if _is_finished(match)])

    @property
    def extra_state_attributes(self):
        results = [
            _clean_fixture(match)
            for match in sorted(_fixtures(self.coordinator), key=_fixture_timestamp, reverse=True)
            if _is_finished(match)
        ]

        return {
            "total_results": len(results),
            "shown_results": min(len(results), MAX_ATTRIBUTE_ITEMS),
            "results": _limited(results),
        }


class FootballHubStandingsSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "standings", "Standings")

    @property
    def native_value(self):
        return len(self.coordinator.data.get("standings", []) or [])

    @property
    def extra_state_attributes(self):
        standings = self.coordinator.data.get("standings", []) or []
        return {
            "total_standings": len(standings),
            "standings": standings,
        }


class FootballHubTopScorersSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "top_scorers", "Top Scorers")

    @property
    def native_value(self):
        return len(self.coordinator.data.get("top_scorers", []) or [])

    @property
    def extra_state_attributes(self):
        scorers = self.coordinator.data.get("top_scorers", []) or []
        return {
            "total_top_scorers": len(scorers),
            "shown_top_scorers": min(len(scorers), MAX_ATTRIBUTE_ITEMS),
            "top_scorers": _limited(scorers),
        }


class FootballHubTopAssistsSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "top_assists", "Top Assists")

    @property
    def native_value(self):
        return len(self.coordinator.data.get("top_assists", []) or [])

    @property
    def extra_state_attributes(self):
        assists = self.coordinator.data.get("top_assists", []) or []
        return {
            "total_top_assists": len(assists),
            "shown_top_assists": min(len(assists), MAX_ATTRIBUTE_ITEMS),
            "top_assists": _limited(assists),
        }
