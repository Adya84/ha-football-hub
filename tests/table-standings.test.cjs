const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let Panel;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../custom_components/football_hub/frontend/football-hub-panel.js'), 'utf8'), {
  HTMLElement: class {},
  customElements: { get: () => false, define: (_name, value) => { Panel = value; } },
  console,
});

test('every league table includes wins, losses and draws from normalized and provider standings', () => {
  const panel = Object.create(Panel.prototype);
  panel._selectedClub = '';
  panel._logo = () => '';
  panel._attrs = () => ({ total_teams: 3, table: [
    { rank: 1, team: 'Arsenal', played: 10, won: 7, lost: 1, drawn: 2, goals_diff: 12, points: 23 },
    { rank: 2, team: 'Cardiff', all: { played: 10, win: 5, lose: 3, draw: 2 }, goalsDiff: 4, points: 17 },
    { rank: 3, team: 'Unknown', played: 0, points: 0 },
  ] });
  const html = panel._tablePage();
  assert.match(html, /title="Wins">W<\/span>.*title="Losses">L<\/span>.*title="Draws">D<\/span>/s);
  assert.match(html, /Arsenal.*?<span>10<\/span>.*?<span>7<\/span>.*?<span>1<\/span>.*?<span>2<\/span>.*?<span>12<\/span>.*?<strong>23<\/strong>/s);
  assert.match(html, /Cardiff.*?<span>10<\/span>.*?<span>5<\/span>.*?<span>3<\/span>.*?<span>2<\/span>/s);
  assert.match(html, /Unknown.*?<span>0<\/span>.*?<span>—<\/span>.*?<span>—<\/span>.*?<span>—<\/span>/s);
});

test('desktop ticker has its own full-width grid row above navigation and content', () => {
  const panel = Object.create(Panel.prototype);
  const styles = panel._styles();
  assert.match(styles, /\.app-shell\.view-desktop > \.league-live-ticker\s*\{[^}]*grid-column:1 \/ -1;[^}]*grid-row:2;/);
  assert.match(styles, /\.app-shell\.view-desktop \.tabs\s*\{[^}]*grid-row:3;/);
  assert.match(styles, /\.app-shell\.view-desktop main\s*\{[^}]*grid-row:3;/);
});

test('UK ticker shows England and Scotland without Wales, Northern Ireland or finished matches', () => {
  const panel = Object.create(Panel.prototype);
  panel._selectedCountry = 'England';
  panel._selectedPrefix = 'sensor.football_hub';
  panel._activeTab = 'overview';
  panel._viewMode = 'desktop';
  panel._language = 'en';
  panel._competitionPrefixes = () => [];
  panel._allStates = () => ({});
  panel._statusInfo = () => ({ state: 'Online', country: 'England', competition: 'Premier League', season: '2026/27', available_competitions: [{ country: 'England', name: 'Premier League', key: 'england-premier-league' }, { country: 'Northern Ireland', name: 'Premiership', key: 'northern-ireland-premiership' }] });
  panel._attrs = () => ({ matches: [
    { country_code: 'ENG', competition: 'League Two', status_short: '1H', home_team: 'Newport', away_team: 'Chesterfield', home_goals: 2, away_goals: 0, elapsed: 18 },
    { country_code: 'SCO', competition: 'Championship', status_short: '2H', home_team: 'Livingston', away_team: 'Stenhousemuir', home_goals: 1, away_goals: 0, elapsed: 61 },
    { country_code: 'WAL', competition: 'Cymru Premier', status_short: 'HT', home_team: 'Bala', away_team: 'TNS', home_goals: 0, away_goals: 0 },
    { country_code: 'NIR', competition: 'Premiership', status_short: 'LIVE', home_team: 'Linfield', away_team: 'Larne', home_goals: 0, away_goals: 1 },
    { country_code: 'IRL', competition: 'Premier Division', status_short: '1H', home_team: 'Shamrock', away_team: 'Derry', home_goals: 0, away_goals: 0 },
    { country_code: 'ENG', competition: 'Premier League', status_short: 'FT', home_team: 'Arsenal', away_team: 'Chelsea', home_goals: 1, away_goals: 0 },
  ] });
  panel._t = (key) => key;
  const html = panel._hero();
  assert.match(html, /UK LIVE/);
  for (const team of ['Newport', 'Livingston']) assert.match(html, new RegExp(team));
  for (const team of ['Bala', 'Linfield', 'Shamrock', 'Arsenal']) assert.doesNotMatch(html, new RegExp(`<b>${team}`));
  assert.match(html, /Championship<\/strong><small>.*Scotland<\/small>/s);
  assert.doesNotMatch(html, /<strong>Cymru Premier<\/strong>/);
  assert.match(html, /data-ticker-league="Wales\|\|\|Cymru Premier"/);
  assert.match(html, /data-ticker-league="Northern Ireland\|\|\|Premiership"/);
  assert.match(html, /League Two<\/strong><small>.*England<\/small>/s);
  assert.equal((html.match(/Newport/g) || []).length, 2);
  assert.equal((html.match(/Livingston/g) || []).length, 2);
  assert.match(html, /--ticker-delay:-\d+(?:\.\d+)?s/);
  panel._tickerLeagueChoices = { 'Wales|||Cymru Premier': true, 'Scotland|||Championship': false };
  const customized = panel._hero();
  assert.match(customized, /<b>Bala/);
  assert.doesNotMatch(customized, /Livingston/);
  panel._selectedCountry = 'Northern Ireland';
  assert.match(panel._hero(), /<b>Linfield/);
});
