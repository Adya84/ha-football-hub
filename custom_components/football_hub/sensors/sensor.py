"""Football Hub sensors."""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from ..competitions import COMPETITIONS, SEASONS
from ..const import DOMAIN
from ..engine import (
    fixture_summary,
    live_summary,
    next_fixture,
    results_summary,
    standings_summary,
    top_assists,
    top_scorers,
)


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

    @property
    def available(self):
        """Return sensor availability."""
        return self.coordinator.last_update_success and self.coordinator.data is not None


class FootballHubStatusSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "status", "Status")

    @property
    def native_value(self):
        return "Online"

    @property
    def extra_state_attributes(self):
        data = self.coordinator.data or {}
        competition_key = self.entry.data.get("competition")
        competition = COMPETITIONS.get(competition_key, {})
        season = self.entry.data.get("season")
        fixtures = fixture_summary(data)
        live = live_summary(data)
        results = results_summary(data)
        scorers = top_scorers(data)
        assists = top_assists(data)
        standings = standings_summary(data)

        return {
            "competition": competition.get("name"),
            "country": competition.get("country"),
            "league_id": competition.get("league_id"),
            "season": SEASONS.get(season, season),
            "provider_mode": self.entry.data.get("provider_mode"),
            "live_count": live["total_live"],
            "fixtures_count": fixtures["total_fixtures"],
            "results_count": results["total_results"],
            "standings_count": standings["total_standings"],
            "top_scorers_count": scorers["total_top_scorers"],
            "top_assists_count": assists["total_top_assists"],
        }


class FootballHubLiveSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "live_matches", "Live Matches")

    @property
    def native_value(self):
        return live_summary(self.coordinator.data or {})["total_live"]

    @property
    def extra_state_attributes(self):
        return live_summary(self.coordinator.data or {})


class FootballHubNextFixtureSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "next_fixture", "Next Fixture")

    @property
    def native_value(self):
        match = next_fixture(self.coordinator.data or {})
        if not match:
            return None
        return f"{match.get('home_team')} vs {match.get('away_team')}"

    @property
    def extra_state_attributes(self):
        return next_fixture(self.coordinator.data or {})


class FootballHubFixturesSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "fixtures", "Fixtures")

    @property
    def native_value(self):
        return fixture_summary(self.coordinator.data or {})["total_fixtures"]

    @property
    def extra_state_attributes(self):
        return fixture_summary(self.coordinator.data or {})


class FootballHubResultsSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "results", "Results")

    @property
    def native_value(self):
        return results_summary(self.coordinator.data or {})["total_results"]

    @property
    def extra_state_attributes(self):
        return results_summary(self.coordinator.data or {})


class FootballHubStandingsSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "standings", "Standings")

    @property
    def native_value(self):
        return standings_summary(self.coordinator.data or {})["total_standings"]

    @property
    def extra_state_attributes(self):
        return standings_summary(self.coordinator.data or {})


class FootballHubTopScorersSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "top_scorers", "Top Scorers")

    @property
    def native_value(self):
        return top_scorers(self.coordinator.data or {})["total_top_scorers"]

    @property
    def extra_state_attributes(self):
        return top_scorers(self.coordinator.data or {})


class FootballHubTopAssistsSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "top_assists", "Top Assists")

    @property
    def native_value(self):
        return top_assists(self.coordinator.data or {})["total_top_assists"]

    @property
    def extra_state_attributes(self):
        return top_assists(self.coordinator.data or {})
