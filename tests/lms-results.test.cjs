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

test('Round 5 recovery requires an empty Round 4 created by manual Through, not a real pick', () => {
  const { panel } = setup('private');
  panel._lmsCompetition.round = 5;
  panel._lmsCompetition.players = [{ alive: true, picks: { 3: 'Arsenal' }, results: { 3: 'survived', 4: 'survived-manual' }, manualAdvancement: { round: '4' } }];
  assert.equal(panel._needsLmsRoundFourRepair(), true);
  panel._lmsCompetition.players[0].picks[4] = 'Chelsea';
  assert.equal(panel._needsLmsRoundFourRepair(), false);
});

test('pulling the shared game restores Round 4 and adopts its clean player history', async () => {
  let Panel, repairCalls = 0;
  const old = { mode: 'private', round: 5, completed: false, leagues: [{ key: 'premier_league' }], players: [
    { id: 'a', name: 'Ady', alive: true, picks: { 3: 'Arsenal' }, results: { 3: 'survived', 4: 'survived-manual' }, manualAdvancement: { round: '4' } },
    { id: 'b', name: 'Dan', alive: false, picks: { 2: 'Leeds' }, results: { 2: 'eliminated' } },
  ] };
  const clean = { ...old, round: 4, roundStarted: 400, players: [
    { id: 'a', name: 'Ady', alive: true, picks: { 3: 'Arsenal' }, results: { 3: 'survived' } },
    old.players[1],
  ] };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../custom_components/football_hub/frontend/football-hub-panel.js'), 'utf8'), {
    HTMLElement: class {}, customElements: { get: () => false, define: (_name, value) => { Panel = value; } },
    localStorage: { setItem() {} }, queueMicrotask() {}, console,
    fetch: async (_url, options = {}) => {
      if (options.method === 'PATCH') {
        repairCalls++;
        assert.equal(JSON.parse(options.body).action, 'repair-premature-round-four');
        return { ok: true, json: async () => ({ competition: clean }) };
      }
      return { ok: true, json: async () => ({ competition: old, playerLinks: [] }) };
    },
  });
  const panel = Object.create(Panel.prototype);
  panel._lmsCompetition = { ...old, shareId: 'example', shareEditToken: 'test', adminPasswordHash: 'hash',
    players: old.players.map((player) => ({ ...player })) };
  panel._lmsMode = 'private';
  panel._activeTab = 'last-man-standing';
  panel._lmsAdminUnlocked = true;
  panel._lmsAdminPassword = 'password';
  panel._lmsShareBusy = false;
  panel._lmsShareSyncPending = false;
  panel._lmsShareLastPull = 0;
  panel._lmsActiveLeague = 'premier_league';
  panel._refreshLmsRoundFixtures = async () => {};
  panel._saveLms = () => {};
  panel._render = () => {};
  panel._restoreLmsBuyBacks = () => false;
  assert.equal(await panel._pullLmsSharePicks(true), true);
  assert.equal(repairCalls, 1);
  assert.equal(panel._lmsCompetition.round, 4);
  assert.equal(panel._lmsCompetition.players[0].manualAdvancement, undefined);
  assert.equal(panel._lmsCompetition.players[0].alive, true);
  assert.equal(panel._lmsCompetition.players[1].alive, false);
});

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
  competition.players[1].picks = { 4: 'Sunderland' };
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

test('a final winning pick restores a stale eliminated LMS player as through', async () => {
  const { panel } = setup('private');
  const player = panel._lmsCompetition.players[0];
  player.alive = false;
  player.results['1'] = 'eliminated';

  await panel._settleLmsRound();

  assert.equal(player.alive, true);
  assert.equal(player.results['1'], 'survived');
});

test('rendering restores a stale eliminated player whose final pick won', () => {
  const { panel } = setup('private');
  const player = panel._lmsCompetition.players[0];
  player.alive = false;
  player.results['1'] = 'eliminated';
  panel._lmsLeagueCache = { premier_league: { fixtures: [arsenal] } };

  assert.equal(panel._reopenLmsUnfinishedResults(), true);
  assert.equal(player.alive, true);
  assert.equal(player.results['1'], 'survived');
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

test('standings separate live, to-play and eliminated LMS players', () => {
  const { panel } = setup('private');
  const competition = panel._lmsCompetition;
  competition.players = [
    { id: 'live', name: 'Live player', alive: true, paid: true, picks: { 1: 'Arsenal' }, results: {} },
    { id: 'scheduled', name: 'Scheduled player', alive: true, paid: true, picks: { 1: 'Test Home' }, results: {} },
    { id: 'out', name: 'Eliminated player', alive: false, paid: true, picks: { 1: 'Tottenham Hotspur' }, results: { 1: 'eliminated' } },
  ];
  panel._lmsLeagueCache = { premier_league: { teams: ['Arsenal', 'Test Home', 'Tottenham Hotspur'], fixtures: [
    { ...arsenal, status: '2H', status_short: '2H', home_goals: 0, away_goals: 2, elapsed: 74 },
    pending,
    { id: 'tottenham-final', home_team: 'Tottenham Hotspur', away_team: 'Chelsea', timestamp: 1789239700, round: '4', status: 'FT', status_short: 'FT', home_goals: 0, away_goals: 1 },
  ] } };
  panel._captureLmsLeagueData = () => {};
  panel._lmsMode = 'private';
  panel._lmsPageView = 'standings';
  panel._lmsEmailServices = () => [];

  const html = panel._lastManStandingPage();

  assert.match(html, /Live now/);
  assert.match(html, /To play/);
  assert.match(html, /Eliminated/);
  assert.match(html, /Live player/);
  assert.match(html, /Scheduled player/);
  assert.match(html, /Eliminated player/);
});

test('a Round 1 buy-back remains active when results are checked again', async () => {
  const { panel } = setup('private');
  const competition = panel._lmsCompetition;
  const player = competition.players[0];
  player.picks['1'] = 'Sunderland';
  player.alive = false;
  player.results['1'] = 'eliminated';

  panel._buyBackLmsPlayer(player.id);
  await panel._settleLmsRound();

  assert.equal(player.alive, true);
  assert.equal(player.results['1'], 'bought-back');
  assert.equal(player.picks['1'], 'Sunderland');
});

test('a saved buy-back restores a player overwritten as eliminated by shared state', () => {
  const { panel } = setup('private');
  const player = panel._lmsCompetition.players[0];
  player.picks['1'] = 'Sunderland';
  player.buyBacks = 1;
  player.buyBackRounds = {};
  player.alive = false;
  player.results['1'] = 'eliminated';

  assert.equal(panel._restoreLmsBuyBacks(), true);
  assert.equal(player.alive, true);
  assert.equal(player.results['1'], 'bought-back');
  assert.equal(player.buyBackRounds['1'], true);
});

test('a Round 1 buy-back cannot revive a player eliminated in Round 2', () => {
  const { panel } = setup('private');
  const competition = panel._lmsCompetition;
  competition.round = 3;
  const player = competition.players[0];
  player.name = 'Nathan';
  player.buyBacks = 1;
  player.buyBackRounds = { 1: true };
  player.picks = { 1: 'Manchester United', 2: 'Newcastle United' };
  player.results = { 1: 'bought-back', 2: 'eliminated' };
  player.alive = true;

  assert.equal(panel._restoreLmsBuyBacks(), true);
  assert.equal(player.alive, false);
  assert.equal(player.results['1'], 'bought-back');
  assert.equal(player.results['2'], 'eliminated');
});

test('admin can mark a player out and undo without losing picks or payment history', () => {
  const { panel } = setup('private');
  const competition = panel._lmsCompetition;
  competition.round = 3;
  const player = competition.players[0];
  player.buyBacks = 1;
  player.buyBackRounds = { 1: true };
  player.paid = true;
  player.picks = { 1: 'Manchester United', 2: 'Arsenal' };
  player.results = { 1: 'bought-back', 2: 'survived' };

  panel._markLmsPlayerOut(player.id);
  assert.equal(player.alive, false);
  assert.equal(player.results['3'], 'eliminated-manual');
  assert.equal(player.picks['2'], 'Arsenal');
  assert.equal(player.paid, true);
  panel._restoreLmsBuyBacks();
  assert.equal(player.alive, false, 'buy-back recovery must not undo the manual decision');

  panel._undoLmsPlayerOut(player.id);
  assert.equal(player.alive, true);
  assert.equal(player.results['3'], undefined);
  assert.equal(player.results['1'], 'bought-back');
  assert.equal(player.paid, true);
});

test('only the unlocked admin sees Mark Out and Undo controls on player cards', () => {
  const { panel } = setup('private');
  panel._lmsMode = 'private';
  panel._lmsPageView = 'picks';
  panel._lmsEmailServices = () => [];
  panel._captureLmsLeagueData = () => {};
  const player = panel._lmsCompetition.players[0];

  let html = panel._lastManStandingPage();
  assert.match(html, /class="lms-mark-out" data-player-id="a"/);
  assert.doesNotMatch(html, /class="lms-undo-mark-out"/);

  panel._markLmsPlayerOut(player.id);
  html = panel._lastManStandingPage();
  assert.doesNotMatch(html, /class="lms-mark-out" data-player-id="a"/);
  assert.match(html, /class="lms-undo-mark-out" data-player-id="a"/);

  panel._isLmsAdmin = () => false;
  html = panel._lastManStandingPage();
  assert.doesNotMatch(html, /class="lms-mark-out"|class="lms-undo-mark-out"/);
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

test('LMS player page separates through, to-play and eliminated players', () => {
  const { panel } = setup('private');
  panel._lmsMode = 'private';
  panel._lmsPageView = 'picks';
  panel._lmsCompetition.players[0].paid = true;
  panel._lmsEmailServices = () => [];
  const html = panel._lastManStandingPage();
  assert.match(html, /To play/);
  assert.doesNotMatch(html, /<strong>Paid players<\/strong>/);
  assert.doesNotMatch(html, /<strong>Payment due<\/strong>/);
});

test('automatic LMS emails are paused while fixture scheduling is corrected', () => {
  const source = fs.readFileSync(path.join(__dirname, '../custom_components/football_hub/frontend/football-hub-panel.js'), 'utf8');
  assert.match(source, /const LMS_AUTOMATIC_EMAILS_ENABLED = false/);
  assert.match(source, /if \(!LMS_AUTOMATIC_EMAILS_ENABLED\) return;/);
});

test('the panel cache-busting version matches the integration release', () => {
  const source = fs.readFileSync(path.join(__dirname, '../custom_components/football_hub/__init__.py'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../custom_components/football_hub/manifest.json'), 'utf8'));
  assert.match(source, new RegExp(`PANEL_VERSION = "${manifest.version}"`));
});

test('Nuvio watch links are optional external actions and retain safe link attributes', () => {
  const source = fs.readFileSync(path.join(__dirname, '../custom_components/football_hub/frontend/football-hub-panel.js'), 'utf8');
  assert.match(source, /match\.nuvio_watch_url/);
  assert.match(source, /Watch in Stremio/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.match(source, /nuvio-manifest-url/);
});

test('favourite club sensors use the normalised home competition cache key', () => {
  const source = fs.readFileSync(path.join(__dirname, '../custom_components/football_hub/sensors/sensor.py'), 'utf8');
  assert.match(source, /favourite\.get\("home_competition"\) or favourite\.get\("competition"\)/);
});

test('favourite league position looks through the provider standings table', () => {
  const source = fs.readFileSync(path.join(__dirname, '../custom_components/football_hub/api/coordinator.py'), 'utf8');
  assert.match(source, /from \.\.engine\.standings import league_table/);
  assert.match(source, /standings = league_table\(/);
  assert.match(source, /row\.get\("team"\).*team\.casefold\(\)/);
});

test('live competition headers show a country flag and do not merge equal league names', () => {
  const source = fs.readFileSync(path.join(__dirname, '../custom_components/football_hub/frontend/football-hub-panel.js'), 'utf8');
  assert.match(source, /const country = match\.country \|\| match\.country_code \|\| ""/);
  assert.match(source, /const groupKey = this\._liveCompetitionKey\(country, competition\)/);
  assert.match(source, /this\._countryFlag\(country, "live-country-flag"\)/);
});

test('live provider ISO3 country codes render a real flag instead of the fallback', () => {
  const { panel } = setup('private');
  for (const code of ['ARG', 'AUT', 'BEL', 'CAN', 'COL', 'CRC', 'GUA', 'MDA', 'MEX', 'POR', 'UZB', 'VIE']) {
    assert.doesNotMatch(panel._countryFlag(code, 'live-country-flag'), /🏳️/, code);
  }
});

test('live country names used by the filter render a real flag instead of the fallback', () => {
  const { panel } = setup('private');
  for (const country of ['Albania', 'Algeria', 'Armenia', 'Azerbaijan', 'Israel', 'Kazakhstan', 'Kuwait', 'Moldova', 'Montenegro', 'Saudi Arabia', 'United Arab Emirates']) {
    assert.doesNotMatch(panel._countryFlag(country, 'live-country-flag'), /🏳️/, country);
  }
});

test('Faroe Islands and Europe use dedicated flags in Live filters', () => {
  const { panel } = setup('private');
  assert.match(panel._countryFlag('Faroe Islands', 'live-country-flag'), /flagcdn\.com\/w160\/fo\.png/);
  assert.match(panel._countryFlag('Europe', 'live-country-flag'), /<svg/);
});

test('Live Centre keeps pins country-specific and shows club cards with refresh age', () => {
  const source = fs.readFileSync(path.join(__dirname, '../custom_components/football_hub/frontend/football-hub-panel.js'), 'utf8');
  assert.match(source, /_liveCompetitionKey\(country, competition\)/);
  assert.match(source, /const competitionFilterKey = \(match\) => this\._liveCompetitionKey\(countryName\(match\), competitionName\(match\)\)/);
  assert.match(source, /_liveFavouriteClubsSection\(matches\)/);
  assert.match(source, /MY CLUBS LIVE/);
  assert.match(source, /_liveUpdatedAge\(timestamp\)/);
  assert.match(source, /this\._escape\(this\._liveUpdatedAge\(statusInfo\.last_updated\)\)/);
});

test('live flags convert provider country codes without broken images', () => {
  const source = fs.readFileSync(path.join(__dirname, '../custom_components/football_hub/frontend/football-hub-panel.js'), 'utf8');
  assert.match(source, /eng: "england"/);
  assert.match(source, /cze: "cz"/);
  assert.match(source, /cyp: "cy"/);
  assert.match(source, /if \(inlineFlags\[inlineName\]\) return inlineFlags\[inlineName\]/);
  assert.match(source, /this\._displayCountry\(country\)/);
});

test('startup removes favourite devices that are no longer saved favourites', () => {
  const source = fs.readFileSync(path.join(__dirname, '../custom_components/football_hub/__init__.py'), 'utf8');
  assert.match(source, /async_cleanup_obsolete_favourite_devices/);
  assert.match(source, /active_device_identifiers/);
  assert.match(source, /active_device_identifiers/);
  assert.match(source, /entity_registry\.async_remove\(entity\.entity_id\)/);
  assert.match(source, /device_registry\.async_remove_device\(device\.id\)/);
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
  assert.match(source, /"competitions": self\._default_club_competitions\(home_competition\)/);
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

test('an isolated early fixture cannot close the next full LMS matchweek or eliminate its unpicked players', () => {
  const { panel } = setup('private');
  const competition = panel._lmsCompetition;
  const now = Math.floor(Date.now() / 1000);
  competition.round = 4;
  competition.roundStarted = now - 86400;
  competition.deadlines = { 4: now - 3600 };
  competition.completed = false;
  const [survivor, alreadyOut] = competition.players;
  survivor.picks = { 1: 'Newcastle', 2: 'Arsenal', 3: 'Tottenham' };
  survivor.results = { 1: 'survived', 2: 'survived', 3: 'survived', 4: 'eliminated-no-pick' };
  survivor.alive = false;
  alreadyOut.picks = { 1: 'Leeds' };
  alreadyOut.results = { 1: 'eliminated' };
  alreadyOut.alive = false;
  panel._lmsLeagueCache.premier_league = { fixtures: [
    { id: 'stray', home_team: 'Leeds', away_team: 'Newcastle', timestamp: now - 3600, round: '6', status: 'FT', home_goals: 1, away_goals: 0 },
    { id: 'weekend-1', home_team: 'Arsenal', away_team: 'Chelsea', timestamp: now + 86400, round: '7', status: 'NS' },
    { id: 'weekend-2', home_team: 'Liverpool', away_team: 'Everton', timestamp: now + 90000, round: '7', status: 'NS' },
  ] };
  delete panel._ensureLmsDeadline;
  delete panel._lmsDeadlineState;

  assert.equal(panel._lmsDeadlineState().locked, false);
  assert.equal(competition.deadlines['4'], now + 86400);
  panel._reopenLmsUnfinishedResults();
  assert.equal(survivor.alive, true);
  assert.equal(survivor.results['4'], undefined);
  assert.equal(alreadyOut.alive, false);
  assert.equal(alreadyOut.results['1'], 'eliminated');
});

test('a premature all-out competition reopens when the real round deadline is still ahead', () => {
  const { panel } = setup('private');
  const competition = panel._lmsCompetition;
  const now = Math.floor(Date.now() / 1000);
  competition.round = 4;
  competition.roundStarted = now - 86400;
  competition.deadlines = { 4: now - 3600 };
  competition.completed = true;
  competition.winnerId = '';
  for (const player of competition.players) {
    player.picks = { 1: 'Arsenal', 2: 'Chelsea', 3: 'Liverpool' };
    player.results = { 1: 'survived', 2: 'survived', 3: 'survived', 4: 'eliminated-no-pick' };
    player.alive = false;
  }
  panel._lmsLeagueCache.premier_league = { fixtures: [
    { id: 'stray', home_team: 'Leeds', away_team: 'Newcastle', timestamp: now - 3600, round: '6', status: 'FT', home_goals: 1, away_goals: 0 },
    { id: 'weekend-1', home_team: 'Arsenal', away_team: 'Chelsea', timestamp: now + 86400, round: '7', status: 'NS' },
    { id: 'weekend-2', home_team: 'Liverpool', away_team: 'Everton', timestamp: now + 90000, round: '7', status: 'NS' },
  ] };
  delete panel._ensureLmsDeadline;
  delete panel._lmsDeadlineState;

  panel._reopenLmsUnfinishedResults();
  assert.equal(competition.completed, false);
  assert.equal(competition.players.every((player) => player.alive && !player.results['4']), true);
});

test('automatic result checks keep previous-round survivors in when they have no current pick', async () => {
  const { panel } = setup('private');
  const competition = panel._lmsCompetition;
  competition.round = 4;
  competition.players[0].picks = { 1: 'Newcastle', 2: 'Arsenal', 3: 'Tottenham' };
  competition.players[0].results = { 1: 'survived', 2: 'survived', 3: 'survived' };
  competition.players[1].alive = false;
  competition.players[1].results = { 1: 'eliminated' };
  panel._lmsLeagueCache.premier_league = { fixtures: [arsenal, pending] };
  await panel._settleLmsRound(true);
  assert.equal(competition.players[0].alive, true);
  assert.equal(competition.players[0].results['4'], undefined);
  assert.equal(competition.round, 4);
});

test('reload restores automatic current-round no-pick eliminations but not an admin-ended round', () => {
  const { panel } = setup('private');
  const competition = panel._lmsCompetition;
  competition.round = 4;
  competition.completed = true;
  competition.winnerId = '';
  competition.players[0].picks = { 1: 'Newcastle', 2: 'Arsenal', 3: 'Tottenham' };
  competition.players[0].results = { 1: 'survived', 2: 'survived', 3: 'survived', 4: 'eliminated-no-pick' };
  competition.players[0].alive = false;
  competition.players[1].alive = false;
  competition.players[1].results = { 1: 'eliminated' };
  panel._reopenLmsUnfinishedResults();
  assert.equal(competition.completed, false);
  assert.equal(competition.players[0].alive, true);
  assert.equal(competition.players[0].results['4'], undefined);
  assert.equal(competition.players[1].alive, false);

  competition.players[0].alive = false;
  competition.players[0].results['4'] = 'eliminated-no-pick';
  competition.lastManualEndSnapshot = { round: 4 };
  panel._reopenLmsUnfinishedResults();
  assert.equal(competition.players[0].alive, false);
});

test('admin can mark an Out player Through and the automatic check keeps that override', async () => {
  const { panel } = setup('private');
  const competition = panel._lmsCompetition;
  competition.round = 4;
  const player = competition.players[0];
  player.picks = { 1: 'Newcastle', 2: 'Arsenal', 3: 'Tottenham' };
  player.results = { 1: 'survived', 2: 'survived', 3: 'survived', 4: 'eliminated-no-pick' };
  player.alive = false;
  player.manualElimination = { round: '4', previousResult: null };
  panel._markLmsPlayerThrough(player.id);
  assert.equal(player.alive, true);
  assert.equal(player.results['3'], 'survived-manual');
  assert.equal(player.results['4'], undefined);
  assert.equal(player.manualElimination, undefined);
  panel._lmsPageView = 'picks';
  panel._lmsEmailServices = () => [];
  panel._captureLmsLeagueData = () => {};
  assert.match(panel._lastManStandingPage(), /class="lms-payment-group-title to-play"[\s\S]*?class="lms-undo-through" data-player-id="a"/);
  await panel._settleLmsRound(true);
  assert.equal(player.alive, true);
  assert.equal(player.results['3'], 'survived-manual');
  assert.equal(player.results['4'], undefined);
  panel._undoLmsPlayerThrough(player.id);
  assert.equal(player.alive, false);
  assert.equal(player.results['4'], 'eliminated-no-pick');
  assert.equal(player.manualElimination?.round, '4');
});

test('a manual Through decision survives later rounds for a bought-back player', () => {
  const { panel } = setup('private');
  const competition = panel._lmsCompetition;
  competition.round = 4;
  const player = competition.players[0];
  player.buyBacks = 1;
  player.buyBackRounds = { 1: true };
  player.results = { 1: 'bought-back', 2: 'eliminated' };
  player.alive = false;
  panel._markLmsPlayerThrough(player.id);
  competition.round = 5;
  panel._restoreLmsBuyBacks();
  assert.equal(player.alive, true);
  assert.equal(player.results['2'], 'eliminated');
  assert.equal(player.results['4'], 'survived-manual');
});

test('a saved manual Through decision repairs a stale shared Out status', () => {
  const { panel } = setup('private');
  const competition = panel._lmsCompetition;
  competition.round = 4;
  const player = competition.players[0];
  player.manualAdvancement = { round: '4', previousResult: 'eliminated-no-pick', previousAlive: false };
  player.results = { 3: 'survived', 4: 'eliminated-no-pick' };
  player.alive = false;
  assert.equal(panel._restoreLmsManualAdvancements(), true);
  assert.equal(player.alive, true);
  assert.equal(player.results['3'], 'survived-manual');
  assert.equal(player.results['4'], undefined);
});

test('Mark Through repairs Round 3 without closing the open Round 4 or reusing teams', () => {
  const { panel } = setup('private');
  const competition = panel._lmsCompetition;
  competition.round = 4;
  const player = competition.players[0];
  player.picks = { 1: 'Newcastle', 2: 'Arsenal', 3: 'Tottenham' };
  player.results = { 1: 'survived', 2: 'survived', 3: 'eliminated-no-pick', 4: 'eliminated-no-pick' };
  player.alive = false;
  panel._markLmsPlayerThrough(player.id);
  assert.equal(competition.round, 4);
  assert.equal(player.alive, true);
  assert.equal(player.results['3'], 'survived-manual');
  assert.equal(player.results['4'], undefined);
  assert.equal(player.manualAdvancement.round, '3');
  assert.equal(panel._lmsSharePayload().players[0].results['3'], 'survived-manual');
  assert.equal(panel._lmsSharePayload().players[0].results['4'], undefined);
  panel._setLmsPick(player.id, 'Arsenal');
  assert.equal(player.picks['4'], undefined, 'a team used in Round 2 cannot be picked again');
});

test('an already saved Round 4 Through override moves back to Round 3 on reload', () => {
  const { panel } = setup('private');
  const competition = panel._lmsCompetition;
  competition.round = 4;
  const player = competition.players[0];
  player.picks = { 1: 'Newcastle', 2: 'Arsenal', 3: 'Tottenham' };
  player.results = { 1: 'survived', 2: 'survived', 3: 'survived', 4: 'survived-manual' };
  player.manualAdvancement = { round: '4', previousResult: 'eliminated-no-pick', previousAlive: false };
  player.alive = true;
  assert.equal(panel._restoreLmsManualAdvancements(), true);
  assert.equal(player.manualAdvancement.round, '3');
  assert.equal(player.results['3'], 'survived-manual');
  assert.equal(player.results['4'], undefined);
  assert.equal(competition.round, 4);
});

test('a stale online Out record cannot undo the corrected Round 3 Through status', () => {
  const { panel } = setup('private');
  const competition = panel._lmsCompetition;
  competition.round = 4;
  const player = competition.players[0];
  player.picks = { 1: 'Newcastle', 2: 'Arsenal', 3: 'Tottenham' };
  player.results = { 3: 'survived', 4: 'eliminated-no-pick' };
  player.manualAdvancement = { round: '4', previousResult: 'eliminated-no-pick', previousAlive: false };
  player.alive = false;
  assert.equal(panel._restoreLmsManualAdvancements(), true);
  assert.equal(player.alive, true);
  assert.equal(player.manualAdvancement.round, '3');
  assert.equal(player.results['3'], 'survived-manual');
  assert.equal(player.results['4'], undefined);
  assert.equal(panel._lmsSharePayload().players[0].alive, true);
});

test('End Round 4 cannot eliminate everybody before anyone has made a Round 4 pick', () => {
  const { panel } = setup('private');
  const competition = panel._lmsCompetition;
  competition.round = 4;
  for (const player of competition.players) {
    player.picks = { 3: 'Arsenal' };
    player.results = { 3: 'survived' };
  }
  assert.throws(() => panel._endLmsRoundNow(), /No Round 4 picks/);
  assert.equal(competition.round, 4);
  assert.equal(competition.players.every((player) => player.alive && !player.results['4']), true);
});

test('only the unlocked admin sees a Through action on Out player cards', () => {
  const { panel } = setup('private');
  panel._lmsPageView = 'picks';
  panel._lmsEmailServices = () => [];
  panel._captureLmsLeagueData = () => {};
  panel._lmsCompetition.round = 4;
  const player = panel._lmsCompetition.players[0];
  player.alive = false;
  player.results = { 1: 'eliminated' };
  assert.match(panel._lastManStandingPage(), /class="lms-mark-through" data-player-id="a"/);
  panel._isLmsAdmin = () => false;
  assert.doesNotMatch(panel._lastManStandingPage(), /class="lms-mark-through"/);
});
