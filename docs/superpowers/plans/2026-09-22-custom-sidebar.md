# Custom Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users independently show or hide optional Football Hub sidebar tabs without changing feature data or Home Assistant entities.

**Architecture:** Store a supported set of visible tab IDs in browser `localStorage`. `_nav()` filters its existing tab array through that set, and Settings renders the switches. Overview is permanently visible; hiding the active tab changes it to Overview before render.

**Tech Stack:** Home Assistant custom panel, JavaScript Web Components, browser `localStorage`, Node.js built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-22-live-experience-design.md`

## Global Constraints

- Stay on the `0.8.4` beta line.
- Overview remains visible.
- Independently support Live, My Club, Fixtures, Results, Table, Players, Cups, LMS, Acca League, News, TV Guide, Transfers and Supporters.
- Hiding only removes the navigation button; it must not delete settings, records, entities, emails, links or feature data.
- Use local browser storage only. Never call `football_hub.save_ui_preferences` or coordinator code for a visibility change.
- Do not alter LMS or Acca code, data, screens, links, emails or services.
- Malformed/empty saved preferences restore the complete standard sidebar.

## Review Focus

- Empty saved list restores every optional tab, rather than hiding everything.
- Unknown IDs stored by an older/newer panel are ignored safely.
- Hiding the open LMS or Acca tab returns to Overview without service calls.
- Re-enabling a hidden feature returns its original data unchanged.
- A browser reload preserves the saved selection and Overview remains reachable.

---

### Task 1: Local sidebar visibility model

**Files:**

- Modify: `custom_components/football_hub/frontend/football-hub-panel.js:1-80,3525-3565`
- Test: `tests/live-competition-filter.test.cjs`

**Interfaces:**

- Produces `OPTIONAL_SIDEBAR_TABS`, `SIDEBAR_TABS_STORAGE_KEY`, `_loadSidebarVisibility()`, `_isSidebarTabVisible(id)`, `_setSidebarTabVisible(id, visible)`, and `_resetSidebarTabs()`.

- [ ] **Step 1: Write failing storage tests**

```javascript
test("sidebar visibility accepts supported stored tabs and falls back safely", () => {
  const panel = makePanel({ primary: {}, liveMatches: [], hiddenCompetitions: [], localValues: {
    football_hub_visible_sidebar_tabs: JSON.stringify(["live", "last-man-standing", "not-a-tab"]),
  }});
  panel._loadSidebarVisibility();
  assert.equal(panel._isSidebarTabVisible("live"), true);
  assert.equal(panel._isSidebarTabVisible("last-man-standing"), true);
  assert.equal(panel._isSidebarTabVisible("fixtures"), false);
  assert.equal(panel._isSidebarTabVisible("overview"), true);
});

test("malformed or empty sidebar visibility restores all optional tabs", () => {
  const panel = makePanel({ primary: {}, liveMatches: [], hiddenCompetitions: [], localValues: {
    football_hub_visible_sidebar_tabs: "not-json",
  }});
  panel._loadSidebarVisibility();
  assert.equal(panel._isSidebarTabVisible("fixtures"), true);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node --test tests/live-competition-filter.test.cjs`

Expected: FAIL because the helper methods do not exist.

- [ ] **Step 3: Implement the local model**

```javascript
const OPTIONAL_SIDEBAR_TABS = new Set(["live", "my-club", "fixtures", "results", "table", "players", "cups", "last-man-standing", "double-pick-league", "news", "tv-guide", "transfers", "supporters"]);
const SIDEBAR_TABS_STORAGE_KEY = "football_hub_visible_sidebar_tabs";

_loadSidebarVisibility() {
  try {
    const saved = JSON.parse(localStorage.getItem(SIDEBAR_TABS_STORAGE_KEY) || "null");
    this._visibleSidebarTabs = Array.isArray(saved) ? new Set(saved.filter((id) => OPTIONAL_SIDEBAR_TABS.has(id))) : new Set(OPTIONAL_SIDEBAR_TABS);
    if (!this._visibleSidebarTabs.size) this._visibleSidebarTabs = new Set(OPTIONAL_SIDEBAR_TABS);
  } catch (_error) {
    this._visibleSidebarTabs = new Set(OPTIONAL_SIDEBAR_TABS);
  }
}

_isSidebarTabVisible(id) {
  return id === "overview" || id === "settings" || this._visibleSidebarTabs.has(id);
}
```

Call `_loadSidebarVisibility()` from the constructor. `_setSidebarTabVisible` saves only the supported visible IDs, changes a hidden active tab to `overview`, then renders. `_resetSidebarTabs` clears the storage key, restores every optional ID, then renders.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node --test tests/live-competition-filter.test.cjs`

Expected: PASS, including the new storage tests.

- [ ] **Step 5: Commit**

```bash
git add custom_components/football_hub/frontend/football-hub-panel.js tests/live-competition-filter.test.cjs
git commit -m "feat: store customizable sidebar tabs locally"
```

### Task 2: Filtered navigation and Settings controls

**Files:**

- Modify: `custom_components/football_hub/frontend/football-hub-panel.js:3525-3565,4557-4585,4630-4960,6100-6280`
- Test: `tests/live-competition-filter.test.cjs`

**Interfaces:**

- Consumes the helpers from Task 1.
- Produces `data-sidebar-tab-toggle` checkboxes, `#reset-sidebar-tabs`, filtered nav markup and local-only event handlers.

- [ ] **Step 1: Write failing navigation tests**

```javascript
test("nav omits hidden optional tabs but keeps overview and settings", () => {
  const panel = makePanel({ primary: {}, liveMatches: [], hiddenCompetitions: [] });
  panel._visibleSidebarTabs = new Set(["live"]);
  panel._activeTab = "overview";
  const markup = panel._nav();
  assert.match(markup, /data-tab="overview"/);
  assert.match(markup, /data-tab="live"/);
  assert.match(markup, /data-tab="settings"/);
  assert.doesNotMatch(markup, /data-tab="last-man-standing"/);
  assert.doesNotMatch(markup, /data-tab="double-pick-league"/);
});

test("hiding the active LMS tab returns to overview", () => {
  const panel = makePanel({ primary: {}, liveMatches: [], hiddenCompetitions: [] });
  panel._visibleSidebarTabs = new Set(["last-man-standing"]);
  panel._activeTab = "last-man-standing";
  let renders = 0;
  panel._render = () => { renders += 1; };
  panel._setSidebarTabVisible("last-man-standing", false);
  assert.equal(panel._activeTab, "overview");
  assert.equal(renders, 1);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node --test tests/live-competition-filter.test.cjs`

Expected: FAIL because `_nav()` maps every tab.

- [ ] **Step 3: Implement navigation filtering and controls**

Use `tabs.filter(([id]) => this._isSidebarTabVisible(id))` inside `_nav()`. In `_settingsPage()`, create a `Customise sidebar` card with one checked/unchecked label per optional tab and a `Show all tabs` reset button:

```html
<article class="page-card sidebar-customisation">
  <h2>Customise sidebar</h2>
  <p>Choose which features appear in the sidebar. Hiding one does not remove its data.</p>
  <div class="sidebar-tab-grid"><label><input type="checkbox" data-sidebar-tab-toggle="last-man-standing" checked> LMS</label></div>
  <button type="button" id="reset-sidebar-tabs">Show all tabs</button>
</article>
```

After render, bind checkbox changes to `_setSidebarTabVisible(id, checked)` and reset to `_resetSidebarTabs()`. Add responsive grid styles that reuse existing card/input/button styles. These handlers must not call Home Assistant services.

- [ ] **Step 4: Run navigation tests and confirm they pass**

Run: `node --test tests/live-competition-filter.test.cjs`

Expected: PASS, including LMS/Acca hidden markup and the active-tab fallback test.

- [ ] **Step 5: Run regression tests**

Run:

```bash
node --test tests/*.test.cjs
python -m unittest discover -s tests -p "test_*.py"
```

Expected: all tests pass; LMS and Acca fixture tests remain unchanged.

- [ ] **Step 6: Commit**

```bash
git add custom_components/football_hub/frontend/football-hub-panel.js tests/live-competition-filter.test.cjs
git commit -m "feat: let users customise sidebar tabs"
```

### Task 3: Beta release documentation

**Files:**

- Modify: `README.md`
- Modify: `custom_components/football_hub/manifest.json`
- Modify: `custom_components/football_hub/__init__.py`
- Modify: `custom_components/football_hub/frontend/football-hub-panel.js`

**Interfaces:**

- Consumes the finished sidebar functionality from Task 2.
- Produces matching `0.8.4-beta.5` version identifiers and a current-release README entry.

- [ ] **Step 1: Write a failing static version test**

```javascript
test("release identifiers use the custom-sidebar beta version", () => {
  const source = fs.readFileSync(path.join(__dirname, "../custom_components/football_hub/frontend/football-hub-panel.js"), "utf8");
  assert.match(source, /const PANEL_VERSION = "0\\.8\\.4-beta\\.5"/);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test tests/live-competition-filter.test.cjs`

Expected: FAIL because the version has not changed.

- [ ] **Step 3: Update metadata and README**

Set `manifest.json`, the Python integration version and `PANEL_VERSION` to `0.8.4-beta.5`. Keep only one current-release section in `README.md`, describing local sidebar choices, the safe Overview fallback, and that LMS/Acca data is untouched.

- [ ] **Step 4: Run release verification**

Run:

```bash
node --test tests/*.test.cjs
python -m unittest discover -s tests -p "test_*.py"
git diff --check
```

Expected: all tests pass and `git diff --check` has no errors.

- [ ] **Step 5: Commit**

```bash
git add README.md custom_components/football_hub/manifest.json custom_components/football_hub/__init__.py custom_components/football_hub/frontend/football-hub-panel.js tests/live-competition-filter.test.cjs
git commit -m "release: prepare 0.8.4-beta.5"
```
