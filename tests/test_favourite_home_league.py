"""Regression checks for favourite clubs saved outside the active league."""

import ast
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock


ROOT = Path(__file__).parents[1]
SOURCE = (ROOT / "custom_components/football_hub/api/coordinator.py").read_text()
TREE = ast.parse(SOURCE)
CLASS = next(node for node in TREE.body if isinstance(node, ast.ClassDef) and node.name == "FootballHubCoordinator")
METHOD = next(node for node in CLASS.body if isinstance(node, ast.AsyncFunctionDef) and node.name == "async_set_my_club")
MODULE = ast.Module(body=[METHOD], type_ignores=[])
CODE = compile(ast.fix_missing_locations(MODULE), "coordinator.py", "exec")
NAMESPACE = {
    "COMPETITIONS": {
        "premier_league": {"type": "league", "country": "England"},
        "league_one": {"type": "league", "country": "England"},
    }
}
exec(CODE, NAMESPACE)


class FavouriteHomeLeagueTests(unittest.IsolatedAsyncioTestCase):
    async def test_existing_club_can_move_to_its_real_league(self):
        favourite = {"team": "Reading", "home_competition": "premier_league", "competitions": ["premier_league"], "country": "England"}
        coordinator = SimpleNamespace(
            competition_key="premier_league",
            my_club="Reading",
            my_clubs={"premier_league": "Reading"},
            favourite_clubs=[favourite],
            _cache={},
            _updated_at={},
            _club_page_restored=None,
            _default_club_competitions=lambda key: [key],
            entry=SimpleNamespace(options={}),
            hass=SimpleNamespace(config_entries=SimpleNamespace(async_update_entry=Mock())),
            async_set_competition=AsyncMock(),
            async_request_refresh=AsyncMock(),
        )

        await NAMESPACE["async_set_my_club"](coordinator, "Reading", "league_one")

        self.assertEqual(favourite["home_competition"], "league_one")
        self.assertEqual(favourite["competitions"], ["league_one"])
        self.assertEqual(coordinator.my_clubs, {"league_one": "Reading"})
        coordinator.async_set_competition.assert_awaited_once_with("league_one")

    async def test_cup_cannot_be_a_home_league(self):
        coordinator = SimpleNamespace(competition_key="premier_league", favourite_clubs=[])
        with self.assertRaises(ValueError):
            await NAMESPACE["async_set_my_club"](coordinator, "Reading", "missing_cup")


if __name__ == "__main__":
    unittest.main()
