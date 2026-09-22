"""Tests for the optional Nuvio event matching helpers."""

import importlib.util
from pathlib import Path
import unittest


MODULE_PATH = Path(__file__).parents[1] / "custom_components" / "football_hub" / "engine" / "nuvio.py"
SPEC = importlib.util.spec_from_file_location("football_hub_nuvio", MODULE_PATH)
NUVIO = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(NUVIO)
match_nuvio_event = NUVIO.match_nuvio_event
nuvio_deep_link = NUVIO.nuvio_deep_link


class NuvioMatchingTests(unittest.TestCase):
    def test_unique_home_and_away_match_returns_a_nuvio_link(self):
        event = match_nuvio_event(
            "Manchester United",
            "Fulham",
            [{"id": "streamed:fulham-vs-manchester-united", "name": "Fulham vs Manchester United"}],
        )

        self.assertEqual(event, {"id": "streamed:fulham-vs-manchester-united", "name": "Fulham vs Manchester United"})
        self.assertEqual(
            nuvio_deep_link(event["id"]),
            "https://web.stremio.com/#/detail/sport/streamed%3Afulham-vs-manchester-united/"
            "streamed%3Afulham-vs-manchester-united?autoPlay=false",
        )

    def test_reversed_fixture_sides_are_supported(self):
        event = match_nuvio_event(
            "Fulham",
            "Manchester United",
            [{"id": "streamed:fulham-vs-manchester-united", "name": "Manchester United vs Fulham"}],
        )

        self.assertIsNotNone(event)

    def test_common_club_suffix_differences_still_match(self):
        event = match_nuvio_event(
            "Querétaro FC",
            "León",
            [{"id": "streamed:queretaro-vs-club-leon", "name": "Queretaro vs Club Leon"}],
        )

        self.assertIsNotNone(event)

    def test_ambiguous_or_incomplete_catalogue_never_returns_a_link(self):
        events = [
            {"id": "streamed:one", "name": "Fulham vs Manchester United"},
            {"id": "streamed:two", "name": "Manchester United vs Fulham"},
        ]

        self.assertIsNone(match_nuvio_event("Manchester United", "Fulham", events))
        self.assertIsNone(match_nuvio_event("Manchester United", "Fulham", [{"id": "x", "name": "Manchester United"}]))


if __name__ == "__main__":
    unittest.main()
