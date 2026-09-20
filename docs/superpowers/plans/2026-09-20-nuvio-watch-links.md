# Nuvio Watch Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in Watch in Nuvio button only when a configured Nuvio catalogue has one unambiguous matching live fixture.

**Architecture:** Store the manifest URL in existing shared UI preferences. A small, isolated matcher normalises fixture metadata and returns a Nuvio deep link only for an exact team-and-time match. The coordinator exposes only that safe external event link; the panel renders it with the current live match-card flow.

**Tech Stack:** Home Assistant Python integration, aiohttp, JavaScript Web Component, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-20-nuvio-watch-links-design.md`

## Global Constraints

- Accept HTTPS manifest URLs only; never persist credentials, stream URLs or media payloads.
- Disabled configuration must make no Nuvio request.
- A failed, ambiguous or incomplete result must leave the live fixture unmodified.
- Open external event links with `noopener noreferrer`.

## Review Focus

- A manifest URL containing credentials, HTTP, a non-URL, or an internal network host must be rejected without a request.
- Near-identical clubs must not create a Watch button for the wrong fixture.
- Kick-off times outside the configured tolerance must not match.
- Multiple equally valid candidates must produce no button.
- A normal score refresh must succeed when the Nuvio provider is slow or offline.

---

### Task 1: Nuvio event matcher

**Files:**
- Create: `custom_components/football_hub/engine/nuvio.py`
- Create: `tests/nuvio-watch-links.test.cjs`

**Interfaces:**
- Produces: `normalise_team(value: str) -> str`, `match_nuvio_event(fixture: dict, events: list[dict], tolerance_seconds: int = 900) -> str | None`.
- Consumes: Football Hub clean fixtures with `home_team`, `away_team`, `timestamp`, `league` and `country` keys.

- [ ] **Step 1: Write the failing matcher tests**

```javascript
assert.equal(matchNuvioEvent(fixture, [sameTeamsAndTime]), "nuvio://meta/football/event-1");
assert.equal(matchNuvioEvent(fixture, [reversedTeams]), null);
assert.equal(matchNuvioEvent(fixture, [outsideTolerance]), null);
assert.equal(matchNuvioEvent(fixture, [sameTeamsAndTime, sameTeamsAndTime]), null);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/nuvio-watch-links.test.cjs`

Expected: FAIL because the matcher module does not exist.

- [ ] **Step 3: Implement normalisation and exact matching**

```python
def match_nuvio_event(fixture, events, tolerance_seconds=900):
    candidates = [event for event in events if _same_teams(fixture, event) and abs(event["timestamp"] - fixture["timestamp"]) <= tolerance_seconds]
    return candidates[0]["nuvio_url"] if len(candidates) == 1 else None
```

- [ ] **Step 4: Run matcher tests**

Run: `node --test tests/nuvio-watch-links.test.cjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add custom_components/football_hub/engine/nuvio.py tests/nuvio-watch-links.test.cjs
git commit -m "Add Nuvio event matcher"
```

### Task 2: Opt-in catalogue retrieval and coordinator enrichment

**Files:**
- Modify: `custom_components/football_hub/api/coordinator.py:54-104, 545-842`
- Modify: `custom_components/football_hub/__init__.py:90-150`
- Modify: `custom_components/football_hub/services.yaml`
- Test: `tests/nuvio-watch-links.test.cjs`

**Interfaces:**
- Consumes: `ui_preferences.nuvio_manifest_url` and `match_nuvio_event` from Task 1.
- Produces: a `nuvio_watch_url` field on an enriched live fixture only after successful matching.

- [ ] **Step 1: Add failing disabled, invalid URL and offline-provider tests**

```javascript
assert.equal(await enrichLiveFixture(fixture, { nuvio_manifest_url: "" }), fixture);
await assert.rejects(() => fetchNuvioEvents("http://example.test/manifest.json"));
assert.equal((await enrichLiveFixture(fixture, validPrefs, failingClient)).nuvio_watch_url, undefined);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/nuvio-watch-links.test.cjs`

Expected: FAIL because no Nuvio preference or enrichment path exists.

- [ ] **Step 3: Add the opt-in service and bounded backend fetch**

```python
async def async_set_nuvio_manifest_url(self, url: str) -> None:
    preferences = {**self.ui_preferences, "nuvio_manifest_url": _validate_nuvio_manifest_url(url)}
    await self.async_set_ui_preferences(preferences)
```

Use the Home Assistant session, a short timeout and a 60-second cache. Parse metadata only and never request a stream endpoint.

- [ ] **Step 4: Enrich a copy of live fixtures**

```python
enriched = copy.deepcopy(raw_live)
for fixture in enriched:
    if url := match_nuvio_event(clean_fixture(fixture), events):
        fixture["nuvio_watch_url"] = url
```

- [ ] **Step 5: Run Nuvio and existing tests**

Run: `node --test tests/*.test.cjs && python -m compileall -q custom_components/football_hub`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add custom_components/football_hub/api/coordinator.py custom_components/football_hub/__init__.py custom_components/football_hub/services.yaml tests/nuvio-watch-links.test.cjs
git commit -m "Add optional Nuvio catalogue matching"
```

### Task 3: Live Centre configuration and Watch button

**Files:**
- Modify: `custom_components/football_hub/frontend/football-hub-panel.js:67-93, 2731-2755, 3779-3940, 4570-4830, 6120-6160`
- Test: `tests/nuvio-watch-links.test.cjs`

**Interfaces:**
- Consumes: `ui_preferences.nuvio_manifest_url`, fixture `nuvio_watch_url` from Task 2.
- Produces: a saved configuration field and an external `Watch in Nuvio` anchor only for matching events.

- [ ] **Step 1: Add failing rendering tests**

```javascript
assert.match(renderMatch(withWatchUrl), /Watch in Nuvio/);
assert.doesNotMatch(renderMatch(withoutWatchUrl), /Watch in Nuvio/);
assert.match(renderMatch(withWatchUrl), /rel="noopener noreferrer"/);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/nuvio-watch-links.test.cjs`

Expected: FAIL because neither configuration nor button markup exists.

- [ ] **Step 3: Add an optional URL field in Live settings**

```javascript
<input id="nuvio-manifest-url" type="url" placeholder="https://…/manifest.json">
<button id="save-nuvio-manifest">Save Nuvio link</button>
```

Save through the existing shared-preference service. Display an explanation that the link is optional and Football Hub never plays the stream.

- [ ] **Step 4: Render the safe external watch link**

```javascript
const watch = match.nuvio_watch_url
  ? `<a class="button-link nuvio-watch" href="${this._escape(match.nuvio_watch_url)}" target="_blank" rel="noopener noreferrer">Watch in Nuvio</a>`
  : "";
```

Place it in the existing match-card action area without changing selection, alert or score interactions.

- [ ] **Step 5: Run full verification**

Run: `node --test tests/*.test.cjs && python -m compileall -q custom_components/football_hub`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add custom_components/football_hub/frontend/football-hub-panel.js tests/nuvio-watch-links.test.cjs
git commit -m "Add Nuvio watch links to Live Centre"
```

### Task 4: Beta release documentation and validation

**Files:**
- Modify: `README.md`
- Modify: `manifest.json` or version metadata location used by the repository

**Interfaces:**
- Consumes: completed feature from Tasks 1-3.
- Produces: version `0.8.2-beta1` with beta-only setup and testing instructions.

- [ ] **Step 1: Add beta release notes**

```markdown
## 0.8.2-beta1

- Adds optional Nuvio Watch in Nuvio links for unambiguous live-fixture matches.
- Requires the user's configured Nuvio add-on manifest URL.
- Does not embed, proxy or provide streams.
```

- [ ] **Step 2: Run final verification**

Run: `node --test tests/*.test.cjs && python -m compileall -q custom_components/football_hub && git diff --check`

Expected: PASS with no whitespace errors.

- [ ] **Step 3: Commit, tag and publish a pre-release**

```bash
git add README.md custom_components/football_hub/manifest.json
git commit -m "Release 0.8.2-beta1"
git tag -a 0.8.2-beta1 -m "Football Hub 0.8.2-beta1"
git push origin HEAD:main --follow-tags
```

Create the GitHub release with **Set as a pre-release** selected. Do not mark it as the latest release.

## Self-review

- Spec coverage: Tasks 1-3 cover opt-in matching, safe links, error handling, caching and unchanged Live Centre behavior; Task 4 covers the requested beta release.
- Placeholder scan: no unresolved implementation placeholders.
- Type consistency: the backend publishes `nuvio_watch_url`, and the frontend consumes precisely that property.
- Review focus coverage: URL validation and offline behavior are Task 2 tests; team, time and ambiguity are Task 1 tests; absent/present safe link markup is Task 3 tests.
