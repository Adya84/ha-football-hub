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
