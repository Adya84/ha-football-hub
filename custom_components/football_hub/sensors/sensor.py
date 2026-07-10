"""Football Hub sensors backed by the shared engine."""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from ..competitions import COMPETITIONS, SEASONS
from ..const import DOMAIN
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
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_name = f"{entry.title} {name}"

    @property
    def engine(self):
        return self.coordinator.engine


class FootballHubStatusSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "status", "Status")

    @property
    def native_value(self):
        return "Online" if self.coordinator.last_update_success else "Error"

    @property
    def extra_state_attributes(self):
        competition = COMPETITIONS.get(self.entry.data.get("competition"), {})
        season = self.entry.data.get("season")
        return {
            "competition": competition.get("name"),
            "country": competition.get("country"),
            "league_id": competition.get("league_id"),
            "season": SEASONS.get(season, season),
            "provider_mode": self.entry.data.get("provider_mode"),
            "live_count": len(self.engine.live.matches()),
            "fixtures_count": len(self.engine.fixtures.all()),
            "results_count": len(self.engine.results.all()),
            "teams_count": len(self.engine.standings.table()),
        }


class FootballHubLiveSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "live_matches", "Live Matches")

    @property
    def native_value(self):
        return len(self.engine.live.matches())

    @property
    def extra_state_attributes(self):
        matches = self.engine.live.matches()
        return {
            "total_live": len(matches),
            "primary_live_match": self.engine.live.primary(),
            "matches": limit_items(matches, ATTRIBUTE_LIMIT),
        }


class FootballHubNextFixtureSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "next_fixture", "Next Fixture")

    @property
    def native_value(self):
        match = self.engine.fixtures.next()
        return f"{match.get('home_team')} vs {match.get('away_team')}" if match else None

    @property
    def extra_state_attributes(self):
        return self.engine.fixtures.next()


class FootballHubMatchesTodaySensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "matches_today", "Matches Today")

    @property
    def native_value(self):
        return len(self.engine.fixtures.today())

    @property
    def extra_state_attributes(self):
        matches = self.engine.fixtures.today()
        return {"total_today": len(matches), "matches": limit_items(matches, ATTRIBUTE_LIMIT)}


class FootballHubThisWeekSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "matches_this_week", "Matches This Week")

    @property
    def native_value(self):
        return len(self.engine.fixtures.this_week())

    @property
    def extra_state_attributes(self):
        matches = self.engine.fixtures.this_week()
        return {"total_this_week": len(matches), "matches": limit_items(matches, ATTRIBUTE_LIMIT)}


class FootballHubFixturesSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "fixtures", "Fixtures")

    @property
    def native_value(self):
        return len(self.engine.fixtures.all())

    @property
    def extra_state_attributes(self):
        fixtures = self.engine.fixtures.all()
        return {
            "total_fixtures": len(fixtures),
            "today_count": len(self.engine.fixtures.today()),
            "this_week_count": len(self.engine.fixtures.this_week()),
            "next_5": limit_items(fixtures, ATTRIBUTE_LIMIT),
        }


class FootballHubLastResultSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "last_result", "Last Result")

    @property
    def native_value(self):
        match = self.engine.results.last()
        if not match:
            return None
        return f"{match.get('home_team')} {match.get('home_goals')}-{match.get('away_goals')} {match.get('away_team')}"

    @property
    def extra_state_attributes(self):
        return self.engine.results.last()


class FootballHubResultsSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "results", "Results")

    @property
    def native_value(self):
        return len(self.engine.results.all())

    @property
    def extra_state_attributes(self):
        results = self.engine.results.all()
        return {
            "total_results": len(results),
            "last_result": self.engine.results.last(),
            "latest_5": self.engine.results.latest(ATTRIBUTE_LIMIT),
        }


class FootballHubStandingsSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "standings", "Standings")

    @property
    def native_value(self):
        return len(self.engine.standings.table())

    @property
    def extra_state_attributes(self):
        table = self.engine.standings.table()
        return {"total_teams": len(table), "table": limit_items(table, ATTRIBUTE_LIMIT)}


class FootballHubTopScorersSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "top_scorers", "Top Scorers")

    @property
    def native_value(self):
        return len(self.engine.top_scorers)

    @property
    def extra_state_attributes(self):
        return {
            "total_top_scorers": len(self.engine.top_scorers),
            "top_scorers": limit_items(self.engine.top_scorers, ATTRIBUTE_LIMIT),
        }


class FootballHubTopAssistsSensor(FootballHubBaseSensor):
    def __init__(self, coordinator, entry):
        super().__init__(coordinator, entry, "top_assists", "Top Assists")

    @property
    def native_value(self):
        return len(self.engine.top_assists)

    @property
    def extra_state_attributes(self):
        return {
            "total_top_assists": len(self.engine.top_assists),
            "top_assists": limit_items(self.engine.top_assists, ATTRIBUTE_LIMIT),
        }
