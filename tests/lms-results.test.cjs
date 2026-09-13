const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const arsenal = { id: '5795453', home_team: 'Sunderland', away_team: 'Arsenal', timestamp: 1789239600, round: '4', status: 'FT', status_short: 'FT', home_goals: 0, away_goals: 2 };
const pending = { id: 'pending-test', home_team: 'Test Home', away_team: 'Test Away', timestamp: 1789300000, round: '4', status: 'NS', home_goals: null, away_goals: null };
function setup(mode) {
  let Panel, requests = 0;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../custom_components/football_hub/frontend/football-hub-panel.js'), 'utf8'), {
    HTMLElement: class {}, customElements: { get: () => false, define: (_name, value) => { Panel = value; } },
    localStorage: { setItem() {} }, queueMicrotask() {}, console,
    fetch: async (url) => {
      assert.ok(url.endsWith('league=premier_league&fresh=1'));
      requests++;
      return { ok: true, json: async () => ({ teams: ['Arsenal', 'Sunderland'], fixtures: [arsenal, pending] }) };
    },
  });
  const panel = Object.create(Panel.prototype);
  panel._lmsCompetition = { mode, round: 1, roundStarted: 1789171200, leagues: [{ key: 'premier_league', name: 'Premier League' }], players: [{ id: 'a', name: 'Arsenal player', alive: true, picks: { 1: 'Arsenal' }, results: {} }, { id: 'b', name: 'Pending player', alive: true, picks: { 1: 'Test Home' }, results: {} }] };
  panel._lmsLeagueCache = {};
  panel._statusInfo = () => ({ competition_key: 'premier_league' });
  panel._lmsTeams = () => ['Arsenal', 'Sunderland'];
  panel._attrs = () => ({ fixtures: [{ ...arsenal, status: 'NS', status_short: 'NS', home_goals: null, away_goals: null }] });
  panel._ensureLmsDeadline = () => 1789221600;
  panel._lmsDeadlineState = () => ({ locked: true });
  panel._isLmsAdmin = () => true;
  panel._saveLms = () => {};
  panel._render = () => panel._captureLmsLeagueData();
  return { panel, requests: () => requests };
}
for (const mode of ['private', 'global']) {
  test(`${mode} Check results fetches the late Arsenal result and survives stale sensor renders`, async () => {
    const { panel, requests } = setup(mode);
    await panel._settleLmsRound();
    assert.equal(requests(), 1);
    assert.equal(panel._lmsCompetition.players[0].results['1'], mode === 'global' ? '3' : 'survived');
    assert.equal(panel._lmsCompetition.round, 1, 'unplayed fixture keeps round open');
    const fixture = panel._lmsRoundFixtureGroups()[0].roundFixtures.find(f => f.id === arsenal.id);
    assert.equal(fixture.status_short, 'FT');
    assert.equal(fixture.away_goals, 2);
    assert.equal(panel._lmsLeagueCache.premier_league.fixtures.length, 2);
    await panel._settleLmsRound();
    if (mode === 'global') assert.equal(panel._lmsCompetition.players[0].points, 3, 'repeat checks do not award twice');
  });
}
