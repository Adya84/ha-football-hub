# Unified Club Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store each favourite club once and combine its domestic-league and cup fixtures/results on the My Club page.

**Architecture:** The coordinator will migrate legacy `favourite_clubs` records into a club-name keyed record with a `competitions` list. Selecting an existing club in a new competition extends that list instead of consuming another slot. The coordinator will merge club matches across linked competition feeds while retaining the competition metadata needed by the frontend.

**Tech Stack:** Home Assistant custom integration, Python, JavaScript Web Component, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-17-unified-club-tracking-design.md`

## Global Constraints

- Keep the five-favourite limit for unique club names only.
- Preserve legacy selections by migrating them on coordinator startup.
- Use domestic competition data for club profile and statistics; cups add fixtures and results.
- Do not replace cached club matches when one linked competition cannot be fetched.

---

### Task 1: Model and migrate unified favourites

**Files:**
- Modify: `custom_components/football_hub/api/coordinator.py`
- Test: `tests/test_unified_club_tracking.py`

**Interfaces:**
- Produces `_normalise_favourite_clubs(records: list[dict]) -> list[dict]`.
- Produces favourite records with `team`, `home_competition`, `competitions`, and `country`.

- [ ] Write tests asserting that Arsenal records from `premier_league` and `champions_league` become one record with both keys, and that unrelated clubs remain separate.
- [ ] Run `pytest tests/test_unified_club_tracking.py -q` and confirm the helper is absent.
- [ ] Add `_normalise_favourite_clubs`, call it during coordinator construction, and write migrated options only when data changes.
- [ ] Re-run the focused test and commit the model and migration.

### Task 2: Extend an existing club instead of adding a duplicate

**Files:**
- Modify: `custom_components/football_hub/api/coordinator.py`
- Modify: `custom_components/football_hub/__init__.py`
- Test: `tests/test_unified_club_tracking.py`

**Interfaces:**
- `async_set_my_club(team: str)` adds `self.competition_key` to an existing record’s `competitions` list.
- `async_remove_favourite_club(team: str, competition_key: str = "")` removes one unified record when no explicit competition is supplied.

- [ ] Write a test proving the same team added under two competitions leaves one favourite and does not trigger the five-club limit.
- [ ] Run the focused test and confirm it fails.
- [ ] Update selection/removal logic and reload condition to count unique records.
- [ ] Re-run tests and commit.

### Task 3: Merge linked competition matches for My Club

**Files:**
- Modify: `custom_components/football_hub/api/coordinator.py`
- Modify: `custom_components/football_hub/sensors/sensor.py`
- Test: `tests/test_unified_club_tracking.py`

**Interfaces:**
- Produces `club_matches` with fixture ID de-duplication, chronological ordering, and `competition_name`/`competition_key` metadata.
- Domestic profile datasets remain attached to `home_competition`.

- [ ] Write a test with domestic and Champions League matches for one club and a duplicate fixture ID, expecting three unique match records with source labels.
- [ ] Run the focused test and confirm it fails.
- [ ] Fetch and merge linked competition fixtures/results using existing cached and API data paths; preserve already cached matches if a fetch fails.
- [ ] Publish merged fixtures/results through the My Club sensor attributes.
- [ ] Re-run tests and commit.

### Task 4: Show competition badges in My Club

**Files:**
- Modify: `custom_components/football_hub/frontend/football-hub-panel.js`
- Test: `tests/lms-results.test.cjs`

- [ ] Write a rendered-source regression test checking that My Club match cards render `competition_name` when present.
- [ ] Run `node --test tests/lms-results.test.cjs` and confirm it fails.
- [ ] Add an escaped competition badge to the My Club fixture and result card output without changing cards that lack source metadata.
- [ ] Re-run the JavaScript tests and commit.

### Task 5: Version, validate and publish

**Files:**
- Modify: `custom_components/football_hub/manifest.json`
- Modify: `custom_components/football_hub/__init__.py`
- Modify: `custom_components/football_hub/frontend/football-hub-panel.js`
- Modify: `README.md`

- [ ] Bump the integration and frontend version.
- [ ] Run the focused Python tests and `node --test tests/lms-results.test.cjs`.
- [ ] Review `git diff --check` and the complete diff.
- [ ] Commit, push to `main`, tag the version, and publish a GitHub release with HACS update instructions.
