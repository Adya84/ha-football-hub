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
