from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from ..competitions import COMPETITIONS, SEASONS
from ..const import DOMAIN
from ..engine import (
    fixtures_count,
    live_count,
    live_matches,
    next_fixture,
    results,
    results_count,
    standings,
    standings_count,
    top_assists,
    top_scorers,
    upcoming_fixtures,
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
        data = self.coordinator.data or {}

        return {
            "competition": competition.get("name"),
            "country": competition.get("country"),
            "league_id": competition.get("league_id"),
            "season": SEASONS.get(season, season),
            "provider_mode": self.entry.data.get("provider_mode"),
            "live_count": live_count(data),
            "fixtures_count": fixtures_count(data),
            "results_count": results_count(data),
            "standings_count": standings_count(data),
            "top_scorers_count": len(top_scorers(data)),
            "top_assists_count": len(top_assists(data)),
        }


class FootballHubLiveSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "live_matches", "Live Matches")

    @property
    def native_value(self):
        return live_count(self.coordinator.data or {})

    @property
    def extra_state_attributes(self):
        matches = live_matches(self.coordinator.data or {})
        return {
            "total_live": len(matches),
            "matches": matches,
        }


class FootballHubNextFixtureSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "next_fixture", "Next Fixture")

    @property
    def native_value(self):
        fixture = next_fixture(self.coordinator.data or {})
        if not fixture:
            return None
        return f"{fixture.get('home_team')} vs {fixture.get('away_team')}"

    @property
    def extra_state_attributes(self):
        return next_fixture(self.coordinator.data or {})


class FootballHubFixturesSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "fixtures", "Fixtures")

    @property
    def native_value(self):
        return fixtures_count(self.coordinator.data or {})

    @property
    def extra_state_attributes(self):
        fixtures = upcoming_fixtures(self.coordinator.data or {})
        return {
            "total_fixtures": len(fixtures),
            "fixtures": fixtures,
        }


class FootballHubResultsSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "results", "Results")

    @property
    def native_value(self):
        return results_count(self.coordinator.data or {})

    @property
    def extra_state_attributes(self):
        match_results = results(self.coordinator.data or {})
        return {
            "total_results": len(match_results),
            "results": match_results,
        }


class FootballHubStandingsSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "standings", "Standings")

    @property
    def native_value(self):
        return standings_count(self.coordinator.data or {})

    @property
    def extra_state_attributes(self):
        table = standings(self.coordinator.data or {})
        return {
            "total_standings": len(table),
            "standings": table,
        }


class FootballHubTopScorersSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "top_scorers", "Top Scorers")

    @property
    def native_value(self):
        return len(top_scorers(self.coordinator.data or {}))

    @property
    def extra_state_attributes(self):
        scorers = top_scorers(self.coordinator.data or {})
        return {
            "total_top_scorers": len(scorers),
            "top_scorers": scorers,
        }


class FootballHubTopAssistsSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "top_assists", "Top Assists")

    @property
    def native_value(self):
        return len(top_assists(self.coordinator.data or {}))

    @property
    def extra_state_attributes(self):
        assists = top_assists(self.coordinator.data or {})
        return {
            "total_top_assists": len(assists),
            "top_assists": assists,
        }
