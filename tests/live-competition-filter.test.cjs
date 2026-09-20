const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function makePanel({ primary, liveMatches, hiddenCompetitions, favouriteClubs = [] }) {
  let Panel;
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../custom_components/football_hub/frontend/football-hub-panel.js"), "utf8"),
    {
      HTMLElement: class {},
      customElements: { get: () => false, define: (_name, value) => { Panel = value; } },
      localStorage: { getItem: () => null, setItem() {} },
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
  panel._liveNotifications = {};
  panel._nuvioManifestUrl = "";
  panel._selectedLiveMatch = "";
  panel._selectedLiveTeam = "";
  panel._attrs = (name) => ({
    live_match: primary,
    live_matches: { matches: liveMatches },
    matches_today: { matches: [] },
    competition_catalogue: { competitions: [] },
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
