const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function makePanel({ primary, liveMatches, hiddenCompetitions, favouriteClubs = [], providerCatalogue = [], openCountries = [], localValues = {} }) {
  let Panel;
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../custom_components/football_hub/frontend/football-hub-panel.js"), "utf8"),
    {
      HTMLElement: class {},
      customElements: { get: () => false, define: (_name, value) => { Panel = value; } },
      localStorage: { getItem: (key) => Object.hasOwn(localValues, key) ? localValues[key] : null, setItem() {} },
      queueMicrotask() {},
      console,
      window: { confirm: () => true, alert() {} },
      fetch: async () => ({ ok: true, json: async () => ({}) }),
    },
  );
  const panel = Object.create(Panel.prototype);
  panel._prefsHydrated = true;
  panel._hiddenLiveCompetitions = new Set(hiddenCompetitions);
  panel._hiddenLiveCountries = new Set();
  panel._hiddenLiveGenders = new Set();
  panel._favouriteLiveCompetitions = new Set();
  panel._liveStatusFilter = "all";
  panel._liveFilterSearch = "";
  panel._liveDisplayMode = "cards";
  panel._liveTimezone = "local";
  panel._liveFiltersOpen = false;
  panel._openLiveFilterCountries = new Set(openCountries);
  panel._liveNotifications = {};
  panel._nuvioManifestUrl = "";
  panel._selectedLiveMatch = "";
  panel._selectedLiveTeam = "";
  panel._attrs = (name) => ({
    live_match: primary,
    live_matches: { matches: liveMatches },
    matches_today: { matches: [] },
    competition_catalogue: { competitions: providerCatalogue },
    standings: { table: [] },
  }[name] || {});
  panel._statusInfo = () => ({ favourite_clubs: favouriteClubs, state: "Online", last_updated: Date.now() });
  return panel;
}

const blockedMatch = {
  id: "blocked", fixture_id: "blocked", is_live: true, status_short: "1H", status: "Live",
  country: "England", competition: "National League", home_team: "York", away_team: "Rochdale",
  home_goals: 0, away_goals: 0,
};

test("an unselected live competition is not restored as the primary match or favourite club card", () => {
  const panel = makePanel({
    primary: blockedMatch,
    liveMatches: [blockedMatch],
    hiddenCompetitions: ["England|||National League"],
    favouriteClubs: ["York"],
  });

  const markup = panel._livePage();

  assert.doesNotMatch(markup, /York v Rochdale/);
  assert.doesNotMatch(markup, /country-live-team home">York/);
  assert.doesNotMatch(markup, /live-control-hero/);
});

test("Live Centre fallback shows the number of visible live matches", () => {
  const panel = makePanel({
    primary: {},
    liveMatches: [blockedMatch],
    hiddenCompetitions: [],
  });
  panel._enabledLiveAlerts = new Set();
  panel._mutedLiveAlerts = new Set();

  const markup = panel._livePage();

  assert.match(markup, /<div class="live-count"><strong>1<\/strong><span>Live now<\/span><\/div>/);
});

test("live match cards show a glowing LIVE timer pill", () => {
  const source = fs.readFileSync(path.join(__dirname, "../custom_components/football_hub/frontend/football-hub-panel.js"), "utf8");

  assert.match(source, /class="live-match-pill"><i><\/i>LIVE/);
  assert.match(source, /HT: "HALF TIME", ET: "EXTRA TIME", BT: "EXTRA TIME BREAK", P: "PENALTIES", FT: "FULL TIME"/);
  assert.match(source, /class="match-state-pill/);
  assert.match(source, /@keyframes live-match-glow/);
  assert.match(source, /prefers-reduced-motion: reduce/);
});

test("closed countries defer their competition controls until opened", () => {
  const panel = makePanel({
    primary: {},
    liveMatches: [],
    hiddenCompetitions: [],
    openCountries: ["England"],
    providerCatalogue: [
      { country: "England", name: "English Test Division" },
      { country: "Denmark", name: "Danish Test Division" },
    ],
  });

  const markup = panel._livePage();

  assert.match(markup, /English Test Division/);
  assert.doesNotMatch(markup, /Danish Test Division/);
  assert.match(markup, /data-live-filter-open-country="Denmark"/);
  assert.doesNotMatch(markup, /<details class="country-filter-tree"/);
  assert.match(markup, /class="country-filter-row"/);
});

test("live rendering never forces the user back to a saved scroll position", () => {
  const source = fs.readFileSync(path.join(__dirname, "../custom_components/football_hub/frontend/football-hub-panel.js"), "utf8");

  assert.doesNotMatch(source, /liveScrollPositions/);
  assert.doesNotMatch(source, /scrollTop = top/);
});

test("a local women's filter is not overwritten by an old shared preference", () => {
  const panel = makePanel({
    primary: {}, liveMatches: [], hiddenCompetitions: [],
    localValues: { football_hub_hidden_live_genders: "[\"Women's\"]" },
  });
  panel._prefsHydrated = false;
  panel._hiddenLiveGenders = new Set(["Women's"]);
  panel._statusInfo = () => ({ ui_preferences: { hiddenGenders: [] } });

  panel._hydrateSharedPreferences();

  assert.deepEqual([...panel._hiddenLiveGenders], ["Women's"]);
});

test("live alert bulk actions enable and disable every alert option", () => {
  const panel = makePanel({ primary: {}, liveMatches: [], hiddenCompetitions: [] });
  panel._liveNotifications = {
    kickoff: false, goals: false, yellowCards: false, redCards: false,
    halftime: false, fulltime: false, sounds: false, selectedClubOnly: false,
  };
  let saves = 0;
  let renders = 0;
  panel._saveSharedPreferences = () => { saves += 1; };
  panel._render = () => { renders += 1; };

  panel._setAllLiveNotifications(true);
  assert.ok(Object.values(panel._liveNotifications).every(Boolean));

  panel._setAllLiveNotifications(false);
  assert.ok(Object.values(panel._liveNotifications).every((enabled) => !enabled));
  assert.equal(saves, 0);
  assert.equal(renders, 2);
});

test("favourite matches remain selected when all match alerts are deselected", () => {
  const favourite = { fixture_id: "favourite-match", home_team: "Arsenal", away_team: "Chelsea" };
  const otherMatch = { fixture_id: "other-match", home_team: "Everton", away_team: "Leeds" };
  const panel = makePanel({
    primary: {}, liveMatches: [favourite, otherMatch], hiddenCompetitions: [],
    favouriteClubs: [{ team: "Arsenal" }],
  });
  panel._enabledLiveAlerts = new Set();
  panel._mutedLiveAlerts = new Set();

  assert.equal(panel._isLiveMatchAlertEnabled(favourite), true);
  assert.equal(panel._isLiveMatchAlertEnabled(otherMatch), false);

  panel._setAllLiveMatchAlerts([favourite, otherMatch], true);
  assert.equal(panel._isLiveMatchAlertEnabled(otherMatch), true);

  panel._setAllLiveMatchAlerts([favourite, otherMatch], false);
  assert.equal(panel._isLiveMatchAlertEnabled(favourite), true);
  assert.equal(panel._isLiveMatchAlertEnabled(otherMatch), false);
});

test("Live Centre renders an alert checkbox for every live match", () => {
  const match = { ...blockedMatch, fixture_id: "live-checkbox", id: "live-checkbox" };
  const panel = makePanel({ primary: {}, liveMatches: [match], hiddenCompetitions: [] });
  panel._enabledLiveAlerts = new Set();
  panel._mutedLiveAlerts = new Set();

  const markup = panel._livePage();

  assert.match(markup, /data-live-match-alert="live-checkbox"/);
});

test("Live Centre keeps optional controls collapsed until the user opens them", () => {
  const panel = makePanel({ primary: {}, liveMatches: [], hiddenCompetitions: [] });
  panel._liveControlsOpen = false;
  panel._liveAlertsOpen = false;

  const markup = panel._livePage();

  assert.match(markup, /<details id="live-controls-panel" class="page-card live-controls-panel"\s*>/);
  assert.match(markup, /<details id="live-alert-panel" class="page-card live-alerts-compact"\s*>/);
  assert.match(markup, /<details id="live-diagnostics-panel" class="page-card live-diagnostics compact"\s*>/);
  assert.doesNotMatch(markup, /id="live-controls-panel" class="page-card live-controls-panel" open/);
  assert.doesNotMatch(markup, /id="live-alert-panel" class="page-card live-alerts-compact" open/);
});

test("Live Centre puts compact alerts and Sports Streams in the same utility row", () => {
  const source = fs.readFileSync(path.join(__dirname, "../custom_components/football_hub/frontend/football-hub-panel.js"), "utf8");

  assert.match(source, /liveUtilities && nuvioSettings\) liveUtilities\.append\(nuvioSettings\)/);
  assert.match(source, /\.live-utility-grid\.compact \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test("an enabled id-only match sends notifications using its selected alert setting", () => {
  const match = {
    id: "provider-only-id", status_short: "2H", home_team: "Everton", away_team: "Leeds",
    home_goals: 1, away_goals: 0, events: [],
  };
  const panel = makePanel({
    primary: {}, liveMatches: [match], hiddenCompetitions: [],
    localValues: {
      football_hub_notification_match_states: JSON.stringify({
        "provider-only-id": { status: "2H", home: 0, away: 0, cards: [] },
      }),
    },
  });
  panel._enabledLiveAlerts = new Set(["provider-only-id"]);
  panel._mutedLiveAlerts = new Set();
  panel._liveNotifications = { goals: true };
  const attrs = panel._attrs;
  panel._attrs = (name) => name === "matches_today" ? { matches: [match] } : attrs(name);
  panel._showLiveAlert = (...args) => { panel._observedAlert = args; };

  panel._processLiveNotifications();

  assert.deepEqual(panel._observedAlert, ["Goal update", "Everton 1–0 Leeds", "goal"]);
});

test("match filter bulk actions select and clear countries, competitions and genders together", () => {
  const panel = makePanel({ primary: {}, liveMatches: [], hiddenCompetitions: [] });
  panel._hiddenLiveCountries = new Set(["England"]);
  panel._hiddenLiveCompetitions = new Set(["England|||Premier League", "Old|||No longer listed"]);
  panel._hiddenLiveGenders = new Set(["Men's"]);
  const inputs = [
    { checked: false, dataset: { liveFilterKind: "country", liveFilterValue: "England" } },
    { checked: false, dataset: { liveFilterKind: "competition", liveFilterValue: "England|||Premier League" } },
    { checked: false, dataset: { liveFilterKind: "gender", liveFilterValue: "Men's" } },
  ];
  panel.shadowRoot = { querySelectorAll: () => inputs };
  panel._saveSharedPreferences = () => {};
  panel._render = () => {};

  panel._setAllLiveFilters(true);
  assert.deepEqual([...panel._hiddenLiveCountries], []);
  assert.deepEqual([...panel._hiddenLiveCompetitions], []);
  assert.deepEqual([...panel._hiddenLiveGenders], []);
  assert.ok(inputs.every((input) => input.checked));

  panel._setAllLiveFilters(false);
  assert.deepEqual([...panel._hiddenLiveCountries], ["England"]);
  assert.deepEqual([...panel._hiddenLiveCompetitions], ["England|||Premier League"]);
  assert.deepEqual([...panel._hiddenLiveGenders], ["Men's"]);
  assert.ok(inputs.every((input) => !input.checked));
});

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
  assert.equal(panel._isSidebarTabVisible("overview"), true);
});

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

test("hidden tabs cannot be opened through an overview shortcut", () => {
  const panel = makePanel({ primary: {}, liveMatches: [], hiddenCompetitions: [] });
  panel._visibleSidebarTabs = new Set(["live"]);
  panel._activeTab = "overview";
  panel._render = () => {};

  panel._setTab("table");

  assert.equal(panel._activeTab, "overview");
});

test("overview offers GitHub star and share actions", () => {
  const panel = makePanel({ primary: {}, liveMatches: [], hiddenCompetitions: [] });
  const markup = panel._overview();

  assert.match(markup, /href="https:\/\/github\.com\/Adya84\/ha-football-hub"/);
  assert.match(markup, /Star us on GitHub/);
  assert.match(markup, /id="share-football-hub"/);
  assert.match(markup, /Share with friends/);
  assert.ok(markup.indexOf("overview-community") < markup.indexOf("dashboard-grid"));
});

test("header beer link has a visible support label", () => {
  const source = fs.readFileSync(path.join(__dirname, "../custom_components/football_hub/frontend/football-hub-panel.js"), "utf8");

  assert.doesNotMatch(source, /class="beer-icon" aria-hidden="true">🍺<\/span>/);
  assert.match(source, /<small class="donation-kicker">Keep us in play<\/small>\s*<span class="beer-copy"><span class="beer-label"><b>SHOOT<\/b> us a donation<\/span><\/span>/);
});

test("Live Centre refreshes its update-age label between feed updates", () => {
  const source = fs.readFileSync(path.join(__dirname, "../custom_components/football_hub/frontend/football-hub-panel.js"), "utf8");

  assert.match(source, /this\._liveUpdatedAgeTimer = setInterval\(\(\) => this\._refreshLiveUpdatedAge\(\), 1000\)/);
  assert.match(source, /_refreshLiveUpdatedAge\(\) \{[\s\S]*hero-live-status small[\s\S]*_liveUpdatedAge\(this\._statusInfo\(\)\.last_updated\)/);
  assert.match(source, /clearInterval\(this\._liveUpdatedAgeTimer\);/);
});

test("Online connection dot is green", () => {
  const source = fs.readFileSync(path.join(__dirname, "../custom_components/football_hub/frontend/football-hub-panel.js"), "utf8");

  assert.match(source, /\.connection\.online \.dot \{\s*background: #86efac;/);
});

test("Live update bar owns the connection status while the beer link uses the header space", () => {
  const source = fs.readFileSync(path.join(__dirname, "../custom_components/football_hub/frontend/football-hub-panel.js"), "utf8");

  assert.match(source, /hero-live-status"><span class="connection/);
  assert.doesNotMatch(source, /<\/a>\s*<span class="connection/);
  assert.match(source, /<\/div><\/div>\s*<\/div>\s*<div class="hero-actions">[\s\S]*class="header-beer-link"/);
  assert.match(source, /\.header-beer-link \{[\s\S]*width: 112px;[\s\S]*height: 112px;[\s\S]*border-radius: 50%;/);
  assert.match(source, /\.header-beer-link \{[\s\S]*overflow: visible;[\s\S]*border: 0;[\s\S]*box-shadow: none;/);
  assert.match(source, /\.brand-ball \{ display:grid; width:190px; height:190px;/);
  assert.match(source, /\.brand-ball, \.header-beer-link \{ width:74px; height:74px; min-height:74px; \}/);
  assert.match(source, /background: url\("\/football_hub\/football-hub-logo\.png\?v=0\.4\.0"\) 50% 28%\/260% auto;/);
  assert.match(source, /\.donation-kicker \{ bottom:calc\(100% \+ 10px\);/);
  assert.match(source, /\.beer-copy \{ top:calc\(100% \+ 10px\); \}/);
  assert.match(source, /\.donation-kicker, \.beer-copy \{[^}]*border:0;[^}]*background:transparent;[^}]*font-family:var\(--paper-font-body1_-_font-family,system-ui,sans-serif\);[^}]*text-align:center;[^}]*text-shadow:none;/);
});

test("release identifiers use the current stable version", () => {
  const source = fs.readFileSync(path.join(__dirname, "../custom_components/football_hub/frontend/football-hub-panel.js"), "utf8");
  assert.match(source, /const PANEL_VERSION = "0\.8\.6-beta\.17"/);
});
