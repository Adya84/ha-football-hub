"""Football Hub sensors."""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from ..competitions import COMPETITIONS, SEASONS
from ..const import DOMAIN
from ..engine import (
    all_results,
    fixtures_today,
    last_result,
    latest,
    league_table,
    live_matches,
    next_fixture,
    primary_live_match,
    this_week,
    top_assists,
    top_scorers,
    upcoming,
)
from ..engine.helpers import limit_items

ATTRIBUTE_LIMIT = 5


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities):
    """Set up Football Hub sensors."""
    coordinator = hass.data[DOMAIN][entry.entry_id]["coordinator"]

    async_add_entities(
        [
            FootballHubStatusSensor(coordinator, entry),
            FootballHubLiveSensor(coordinator, entry),
            FootballHubNextFixtureSensor(coordinator, entry),
            FootballHubMatchesTodaySensor(coordinator, entry),
            FootballHubThisWeekSensor(coordinator, entry),
            FootballHubFixturesSensor(coordinator, entry),
            FootballHubLastResultSensor(coordinator, entry),
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

    @property
    def raw_fixtures(self):
        """Return raw fixtures."""
        return self.coordinator.data.get("fixtures", []) or []

    @property
    def raw_live(self):
        """Return raw live matches."""
        return self.coordinator.data.get("live", []) or []


class FootballHubStatusSensor(FootballHubBaseSensor):
    """Football Hub status sensor."""

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
        fixtures = upcoming(self.raw_fixtures)
        results = all_results(self.raw_fixtures)
        live = live_matches(self.raw_live)

        return {
            "competition": competition.get("name"),
            "country": competition.get("country"),
            "league_id": competition.get("league_id"),
            "season": SEASONS.get(season, season),
            "provider_mode": self.entry.data.get("provider_mode"),
            "live_count": len(live),
            "fixtures_count": len(fixtures),
            "results_count": len(results),
            "standings_count": len(league_table(self.coordinator.data.get("standings", []) or [])),
            "top_scorers_count": len(self.coordinator.data.get("top_scorers", []) or []),
            "top_assists_count": len(self.coordinator.data.get("top_assists", []) or []),
        }


class FootballHubLiveSensor(FootballHubBaseSensor):
    """Live matches sensor."""

    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "live_matches", "Live Matches")

    @property
    def native_value(self):
        return len(live_matches(self.raw_live))

    @property
    def extra_state_attributes(self):
        live = live_matches(self.raw_live)
        return {
            "total_live": len(live),
            "primary_live_match": primary_live_match(self.raw_live),
            "matches": limit_items(live, ATTRIBUTE_LIMIT),
        }


class FootballHubNextFixtureSensor(FootballHubBaseSensor):
    """Next fixture sensor."""

    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "next_fixture", "Next Fixture")

    @property
    def native_value(self):
        match = next_fixture(self.raw_fixtures)
        if not match:
            return None
        return f"{match.get('home_team')} vs {match.get('away_team')}"

    @property
    def extra_state_attributes(self):
        return next_fixture(self.raw_fixtures)


class FootballHubMatchesTodaySensor(FootballHubBaseSensor):
    """Today's fixtures sensor."""

    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "matches_today", "Matches Today")

    @property
    def native_value(self):
        return len(fixtures_today(self.raw_fixtures))

    @property
    def extra_state_attributes(self):
        matches = fixtures_today(self.raw_fixtures)
        return {
            "total_today": len(matches),
            "matches": limit_items(matches, ATTRIBUTE_LIMIT),
        }


class FootballHubThisWeekSensor(FootballHubBaseSensor):
    """Fixtures in the next seven days sensor."""

    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "matches_this_week", "Matches This Week")

    @property
    def native_value(self):
        return len(this_week(self.raw_fixtures))

    @property
    def extra_state_attributes(self):
        matches = this_week(self.raw_fixtures)
        return {
            "total_this_week": len(matches),
            "matches": limit_items(matches, ATTRIBUTE_LIMIT),
        }


class FootballHubFixturesSensor(FootballHubBaseSensor):
    """Upcoming fixtures sensor."""

    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "fixtures", "Fixtures")

    @property
    def native_value(self):
        return len(upcoming(self.raw_fixtures))

    @property
    def extra_state_attributes(self):
        fixtures = upcoming(self.raw_fixtures)
        today = fixtures_today(self.raw_fixtures)
        week = this_week(self.raw_fixtures)
        return {
            "total_fixtures": len(fixtures),
            "today_count": len(today),
            "this_week_count": len(week),
            "next_5": limit_items(fixtures, ATTRIBUTE_LIMIT),
        }


class FootballHubLastResultSensor(FootballHubBaseSensor):
    """Most recent completed fixture sensor."""

    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "last_result", "Last Result")

    @property
    def native_value(self):
        match = last_result(self.raw_fixtures)
        if not match:
            return None
        home = match.get("home_goals")
        away = match.get("away_goals")
        return f"{match.get('home_team')} {home}-{away} {match.get('away_team')}"

    @property
    def extra_state_attributes(self):
        return last_result(self.raw_fixtures)


class FootballHubResultsSensor(FootballHubBaseSensor):
    """Results sensor."""

    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "results", "Results")

    @property
    def native_value(self):
        return len(all_results(self.raw_fixtures))

    @property
    def extra_state_attributes(self):
        results = all_results(self.raw_fixtures)
        return {
            "total_results": len(results),
            "last_result": last_result(self.raw_fixtures),
            "latest_5": latest(self.raw_fixtures, ATTRIBUTE_LIMIT),
        }


class FootballHubStandingsSensor(FootballHubBaseSensor):
    """Standings sensor."""

    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "standings", "Standings")

    @property
    def native_value(self):
        return len(league_table(self.coordinator.data.get("standings", []) or []))

    @property
    def extra_state_attributes(self):
        table = league_table(self.coordinator.data.get("standings", []) or [])
        return {
            "total_teams": len(table),
            "table": limit_items(table, ATTRIBUTE_LIMIT),
        }


class FootballHubTopScorersSensor(FootballHubBaseSensor):
    """Top scorers sensor."""

    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "top_scorers", "Top Scorers")

    @property
    def native_value(self):
        scorers = top_scorers(self.coordinator.data.get("top_scorers", []) or [])
        return len(scorers)

    @property
    def extra_state_attributes(self):
        scorers = top_scorers(self.coordinator.data.get("top_scorers", []) or [])
        return {
            "total_top_scorers": len(scorers),
            "top_scorers": limit_items(scorers, ATTRIBUTE_LIMIT),
        }


class FootballHubTopAssistsSensor(FootballHubBaseSensor):
    """Top assists sensor."""

    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "top_assists", "Top Assists")

    @property
    def native_value(self):
        assists = top_assists(self.coordinator.data.get("top_assists", []) or [])
        return len(assists)

    @property
    def extra_state_attributes(self):
        assists = top_assists(self.coordinator.data.get("top_assists", []) or [])
        return {
            "total_top_assists": len(assists),
            "top_assists": limit_items(assists, ATTRIBUTE_LIMIT),
        }
