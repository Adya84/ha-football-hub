"""Automation-friendly kickoff details for a favourite club fixture."""

import importlib.util
from pathlib import Path
import unittest


MODULE_PATH = Path(__file__).parents[1] / "custom_components" / "football_hub" / "engine" / "helpers.py"
SPEC = importlib.util.spec_from_file_location("football_hub_helpers", MODULE_PATH)
HELPERS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(HELPERS)


class FavouriteFixtureKickoffTests(unittest.TestCase):
    def test_exposes_kickoff_date_and_timestamp_for_automations(self):
        match = {
            "fixture": {
                "date": "2026-10-09T19:00:00+00:00",
                "timestamp": 1791572400,
            }
        }

        self.assertEqual(
            HELPERS.favourite_fixture_kickoff_attributes(match),
            {"kickoff": "2026-10-09T19:00:00+00:00", "kickoff_timestamp": 1791572400},
        )

    def test_missing_fixture_has_empty_kickoff_attributes(self):
        self.assertEqual(
            HELPERS.favourite_fixture_kickoff_attributes(None),
            {"kickoff": None, "kickoff_timestamp": None},
        )


if __name__ == "__main__":
    unittest.main()
