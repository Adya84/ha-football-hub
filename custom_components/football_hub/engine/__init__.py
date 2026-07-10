"""Football Hub engine."""

from __future__ import annotations

from .fixture_engine import FixtureEngine
from .live_engine import LiveEngine
from .player_engine import PlayerEngine
from .results_engine import ResultsEngine
from .standings_engine import StandingsEngine
from .statistics_engine import StatisticsEngine
from .team_engine import TeamEngine


class FootballHubEngine:
    """Single processed view of coordinator data."""

    def __init__(self, data: dict | None = None) -> None:
        self.update(data or {})

    def update(self, data: dict) -> None:
        """Rebuild processed datasets after a coordinator refresh."""
        raw_fixtures = data.get("fixtures", []) or []
        raw_live = data.get("live", []) or []
        self.fixtures = FixtureEngine(raw_fixtures)
        self.results = ResultsEngine(raw_fixtures)
        self.live = LiveEngine(raw_live)
        self.standings = StandingsEngine(data.get("standings", []) or [])
        self.players = PlayerEngine()
        fixture_rows = self.fixtures.all()
        result_rows = self.results.all()
        self.teams = TeamEngine(raw_fixtures, self.standings.table())
        self.statistics = StatisticsEngine(fixture_rows, result_rows)
        self.top_scorers = self.players.leaderboard(data.get("top_scorers", []) or [], "goals")
        self.top_assists = self.players.leaderboard(data.get("top_assists", []) or [], "assists")
