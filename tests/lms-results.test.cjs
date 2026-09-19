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
    window: { confirm: () => true, alert: (message) => { throw new Error(message); } },
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

test('sole survivor is shown as winner only after their final result completes the round', async () => {
  const { panel } = setup('private');
  const [survivor, eliminated] = panel._lmsCompetition.players;
  eliminated.picks['1'] = 'Sunderland';
  eliminated.alive = false;
  eliminated.results['1'] = 'eliminated';
  assert.equal(panel._isLmsWinner(survivor), false);
  await panel._settleLmsRound();
  assert.equal(panel._lmsCompetition.completed, true);
  assert.equal(panel._lmsCompetition.winnerId, survivor.id);
  assert.equal(panel._isLmsWinner(survivor), true);
  assert.equal(panel._isLmsWinner(eliminated), false);
  panel._lmsCompetition.completed = false;
  assert.equal(panel._isLmsWinner(survivor), false, 'reopening a competition removes the winner label');
});

test('Check results repairs completed Round 4 with a pending Arsenal winner', async () => {
  const { panel, requests } = setup('private');
  const competition = panel._lmsCompetition;
  competition.round = 4;
  competition.completed = true;
  competition.winnerId = 'a';
  competition.players[0].picks = { 4: 'Arsenal' };
  competition.players[1].alive = false;
  competition.players[1].results = { 4: 'eliminated' };
  assert.equal(panel._isLmsWinner(competition.players[0]), false);
  await panel._settleLmsRound();
  assert.equal(requests(), 1);
  assert.equal(competition.players[0].results['4'], 'survived');
  assert.equal(competition.completed, true);
  assert.equal(competition.winnerId, 'a');
  assert.equal(panel._isLmsWinner(competition.players[0]), true);
  await panel._settleLmsRound();
  assert.equal(requests(), 1, 'an already resolved completed competition remains unchanged');
});

test('premature completion is removed when the final pick is still unplayed', async () => {
  const { panel } = setup('private');
  const competition = panel._lmsCompetition;
  competition.completed = true;
  competition.winnerId = 'a';
  competition.players[1].alive = false;
  panel._refreshLmsRoundFixtures = async () => {
    panel._lmsLeagueCache.premier_league = { fixtures: [{ ...arsenal, status: 'NS', status_short: 'NS', home_goals: null, away_goals: null }] };
  };
  await panel._settleLmsRound();
  assert.equal(competition.completed, false);
  assert.equal(competition.winnerId, '');
  assert.equal(competition.players[0].results['1'], undefined);
  assert.equal(panel._isLmsWinner(competition.players[0]), false);
});

test('an early eliminated result is restored to live while the picked match is unfinished', async () => {
  const { panel } = setup('private');
  const competition = panel._lmsCompetition;
  const player = competition.players[0];
  player.alive = false;
  player.results['1'] = 'eliminated';
  panel._refreshLmsRoundFixtures = async () => {
    panel._lmsLeagueCache.premier_league = { fixtures: [{ ...arsenal, status: '1H', status_short: '1H', home_goals: 0, away_goals: 0 }] };
  };

  await panel._settleLmsRound();

  assert.equal(player.alive, true);
  assert.equal(player.results['1'], undefined);
});

test('an early survived result is restored to live while the picked match is unfinished', async () => {
  const { panel } = setup('private');
  const competition = panel._lmsCompetition;
  const player = competition.players[0];
  player.results['1'] = 'survived';
  panel._refreshLmsRoundFixtures = async () => {
    panel._lmsLeagueCache.premier_league = { fixtures: [{ ...arsenal, status: '2H', status_short: '2H', home_goals: 2, away_goals: 0 }] };
  };

  await panel._settleLmsRound();

  assert.equal(player.alive, true);
  assert.equal(player.results['1'], undefined);
});

test('rendering reopens stale results so unfinished picks stay in the standing group', () => {
  const { panel } = setup('private');
  const player = panel._lmsCompetition.players[0];
  player.alive = false;
  player.results['1'] = 'eliminated';
  panel._lmsLeagueCache = { premier_league: { teams: ['Arsenal'], fixtures: [{ ...arsenal, status: '2H', status_short: '2H' }] } };
  panel._lmsMode = 'private';
  panel._lmsPageView = 'standings';
  panel._lmsEmailServices = () => [];

  panel._lastManStandingPage();

  assert.equal(player.alive, true);
  assert.equal(player.results['1'], undefined);
});

test('restart retains players and links while archiving the winner and resetting the prize', async () => {
  const { panel } = setup('private');
  const competition = panel._lmsCompetition;
  competition.completed = true;
  competition.winnerId = 'a';
  competition.edition = 2;
  competition.entryFee = 5;
  competition.carriedPrize = 10;
  competition.players[0].results = { 1: 'survived' };
  competition.players[0].paid = true;
  competition.players[0].pickUrl = '/pick/existing';
  competition.players[1].alive = false;
  competition.players[1].paid = true;
  competition.players[1].buyBacks = 1;
  const ids = competition.players.map(player => player.id);
  await panel._restartLmsCompetition();
  assert.equal(competition.edition, 3);
  assert.equal(competition.round, 1);
  assert.equal(competition.completed, false);
  assert.equal(competition.archives[0].winnerName, 'Arsenal player');
  assert.equal(competition.archives[0].prizeFund, 25);
  assert.equal(competition.carriedPrize, 0);
  assert.deepEqual(Array.from(competition.players, player => player.id), ids);
  assert.equal(competition.players[0].pickUrl, '/pick/existing');
  assert.ok(competition.players.every(player => player.alive && !player.paid && !Object.keys(player.picks).length && !Object.keys(player.results).length));
});

test('rendering the actual LMS standings does not erase a confirmed Arsenal result from shared state', () => {
  const { panel } = setup('private');
  const competition = panel._lmsCompetition;
  competition.round = 4;
  competition.completed = true;
  competition.winnerId = 'a';
  competition.players[0].picks = { 4: 'Arsenal' };
  competition.players[0].results = { 4: 'survived' };
  competition.players[1].alive = false;
  panel._lmsLeagueCache = { premier_league: { teams: ['Arsenal'], fixtures: [pending] } };
  panel._lmsMode = 'private';
  panel._lmsPageView = 'standings';
  panel._lmsEmailServices = () => [];
  const html = panel._lastManStandingPage();
  assert.equal(competition.players[0].results['4'], 'survived');
  assert.match(html, /<b>Winner<\/b>/);
});

test('LMS player page separates paid players from payment due players', () => {
  const { panel } = setup('private');
  panel._lmsMode = 'private';
  panel._lmsPageView = 'picks';
  panel._lmsCompetition.players[0].paid = true;
  panel._lmsEmailServices = () => [];
  const html = panel._lastManStandingPage();
  assert.match(html, /Paid players/);
  assert.match(html, /Payment due/);
});

test('automatic LMS emails are paused while fixture scheduling is corrected', () => {
  const source = fs.readFileSync(path.join(__dirname, '../custom_components/football_hub/frontend/football-hub-panel.js'), 'utf8');
  assert.match(source, /const LMS_AUTOMATIC_EMAILS_ENABLED = false/);
  assert.match(source, /if \(!LMS_AUTOMATIC_EMAILS_ENABLED\) return;/);
});

test('the main competition picker includes cups for My Club', () => {
  const source = fs.readFileSync(path.join(__dirname, '../custom_components/football_hub/frontend/football-hub-panel.js'), 'utf8');
  assert.match(source, /const countryCompetitions = catalogue/);
  assert.doesNotMatch(source, /const countryLeagues = catalogue/);
  assert.match(source, /aria-label="Competition"/);
});

test('unified favourites store linked competitions once per club', () => {
  const source = fs.readFileSync(path.join(__dirname, '../custom_components/football_hub/api/coordinator.py'), 'utf8');
  assert.match(source, /def _normalise_favourite_clubs/);
  assert.match(source, /"competitions": self\._default_club_competitions\(self\.competition_key\)/);
  assert.match(source, /def club_matches/);
});

test('a domestic club automatically links national and European cup competitions', () => {
  const source = fs.readFileSync(path.join(__dirname, '../custom_components/football_hub/api/coordinator.py'), 'utf8');
  assert.match(source, /def _default_club_competitions/);
  assert.match(source, /competition\.get\("country"\) == home_country/);
  assert.match(source, /competition\.get\("country"\) == "Europe"/);
});

test('saved club sensors use the favourite home competition after migration', () => {
  const source = fs.readFileSync(path.join(__dirname, '../custom_components/football_hub/api/coordinator.py'), 'utf8');
  assert.match(source, /favourite\.get\("home_competition"\) or favourite\.get\("competition"\)/);
});

test('completed competitions with a literal pending result can be repaired', async () => {
  const { panel, requests } = setup('private');
  panel._lmsCompetition.completed = true;
  panel._lmsCompetition.winnerId = 'a';
  panel._lmsCompetition.players[0].results['1'] = 'pending';
  panel._lmsCompetition.players[1].alive = false;
  await panel._settleLmsRound();
  assert.equal(requests(), 1);
  assert.equal(panel._lmsCompetition.players[0].results['1'], 'survived');
  assert.equal(panel._isLmsWinner(panel._lmsCompetition.players[0]), true);
});

test('a new LMS round skips an isolated postponed fixture for the next full matchweek', () => {
  const { panel } = setup('private');
  panel._lmsLeagueCache.premier_league = { fixtures: [
    { id: 'postponed', home_team: 'Leeds', away_team: 'Newcastle', timestamp: 1789400000, round: '4', status: 'NS' },
    { id: 'next-1', home_team: 'Arsenal', away_team: 'Chelsea', timestamp: 1789650000, round: '5', status: 'NS' },
    { id: 'next-2', home_team: 'Liverpool', away_team: 'Everton', timestamp: 1789660000, round: '5', status: 'NS' },
  ] };
  const fixtures = panel._lmsRoundFixtureGroups()[0].roundFixtures;
  assert.deepEqual(Array.from(fixtures, (fixture) => fixture.id), ['next-1', 'next-2']);
});
