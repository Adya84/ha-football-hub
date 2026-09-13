const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
let Panel;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../custom_components/football_hub/frontend/football-hub-panel.js'), 'utf8'), {
  HTMLElement: class {},
  customElements: { get: () => false, define: (_name, value) => { Panel = value; } },
  localStorage: { setItem() {} },
});
const match = (id, home, away) => ({ id, home_team: home, away_team: away, timestamp: 1789212600 });
const championship = { key: 'championship', name: 'Championship' };
const leagueTwo = { key: 'league_two', name: 'League Two' };
function setup() {
  const panel = Object.create(Panel.prototype);
  panel._activeTab = 'double-pick-league';
  panel._doublePickGame = { competitions: [championship, leagueTwo] };
  panel._doublePickCache = {
    championship: { competitionKey: 'championship', fixtures: [match('5836836', 'West Bromwich Albion', 'Queens Park Rangers')] },
    league_two: { competitionKey: 'league_two', fixtures: [match('walsall-test', 'Walsall', 'Test opponent')] },
  };
  panel._doublePickRound = () => ({ startDate: '2026-09-12', endDate: '2026-09-12' });
  panel._doublePickRoundCompetitions = () => [championship, leagueTwo];
  return panel;
}
function capture(panel, competition, fixtures) {
  panel._statusInfo = () => ({ competition_key: competition });
  panel._attrs = (name) => name === 'fixtures' ? { fixtures } : {};
  panel._captureDoublePickData();
}
test('partial sensor updates retain West Brom and Walsall across competition switches and repeated renders', () => {
  const panel = setup();
  for (let i = 0; i < 3; i++) {
    capture(panel, 'championship', [match('other', 'Derby County', 'Birmingham City')]);
    capture(panel, 'league_two', []);
  }
  const fixtures = panel._doublePickRoundFixtures();
  assert.equal(fixtures.length, 3);
  assert.ok(fixtures.some(f => f.home_team === 'West Bromwich Albion'));
  assert.ok(fixtures.some(f => f.home_team === 'Walsall'));
  assert.equal(panel._doublePickCache.championship.fixtures.length, 2);
  assert.equal(panel._doublePickCache.league_two.fixtures.length, 1);
});
test('updated matches replace the same ID without duplicates', () => {
  const panel = setup();
  capture(panel, 'championship', [{ ...match('5836836', 'West Bromwich Albion', 'Queens Park Rangers'), home_goals: 1, away_goals: 1 }]);
  assert.equal(panel._doublePickCache.championship.fixtures.length, 1);
  assert.equal(panel._doublePickCache.championship.fixtures[0].home_goals, 1);
});
test('a cache belonging to another competition is not retained', () => {
  const panel = setup();
  panel._doublePickCache.championship.competitionKey = 'league_two';
  capture(panel, 'championship', []);
  assert.equal(panel._doublePickCache.championship.fixtures.length, 0);
});
