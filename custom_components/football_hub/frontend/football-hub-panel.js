const PANEL_VERSION = "0.2.0-frontend-preview";

class FootballHubPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._activeTab = "overview";
    this._selectedPrefix = localStorage.getItem("football_hub_selected_prefix") || "";
  }

  set hass(hass) {
    this._hass = hass;
    this._ensureCompetition();
    this._render();
  }

  set panel(panel) {
    this._panel = panel;
  }

  set narrow(narrow) {
    this._narrow = narrow;
    this._render();
  }

  set route(route) {
    this._route = route;
  }

  connectedCallback() {
    this._render();
  }

  _allStates() {
    return this._hass?.states || {};
  }

  _competitionPrefixes() {
    const prefixes = [];

    for (const entityId of Object.keys(this._allStates())) {
      if (!entityId.startsWith("sensor.") || !entityId.endsWith("_status")) continue;
      if (!entityId.includes("football_hub")) continue;
      prefixes.push(entityId.slice(0, -"_status".length));
    }

    return [...new Set(prefixes)].sort();
  }

  _ensureCompetition() {
    const prefixes = this._competitionPrefixes();

    if (!prefixes.includes(this._selectedPrefix)) {
      this._selectedPrefix = prefixes[0] || "";
    }
  }

  _entity(suffix) {
    if (!this._selectedPrefix) return null;
    return this._allStates()[`${this._selectedPrefix}_${suffix}`] || null;
  }

  _attrs(suffix) {
    return this._entity(suffix)?.attributes || {};
  }

  _statusInfo() {
    const status = this._entity("status");
    return {
      state: status?.state || "Unavailable",
      ...status?.attributes,
    };
  }

  _setCompetition(prefix) {
    this._selectedPrefix = prefix;
    localStorage.setItem("football_hub_selected_prefix", prefix);
    this._render();
  }

  _setTab(tab) {
    this._activeTab = tab;
    this._render();
  }

  _escape(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  _formatDate(value, includeTime = true) {
    if (!value) return "To be confirmed";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    }).format(date);
  }

  _logo(url, name, size = "56") {
    if (!url) {
      return `<div class="logo-placeholder" style="width:${size}px;height:${size}px">${this._escape(
        (name || "?").slice(0, 2).toUpperCase()
      )}</div>`;
    }

    return `<img class="team-logo" style="width:${size}px;height:${size}px" src="${this._escape(
      url
    )}" alt="${this._escape(name || "Team")}" loading="lazy">`;
  }

  _score(value) {
    return value === null || value === undefined ? "–" : this._escape(value);
  }

  _matchCard(match, mode = "fixture") {
    if (!match) return `<div class="empty">No match data available.</div>`;

    const isResult = mode === "result";
    const score = isResult || match.status_short !== "NS"
      ? `<div class="match-score">${this._score(match.home_goals)} <span>–</span> ${this._score(match.away_goals)}</div>`
      : `<div class="match-time">${this._formatDate(match.kickoff)}</div>`;

    return `
      <article class="match-card">
        <div class="match-meta">
          <span>${this._escape(match.round || "Fixture")}</span>
          <span>${this._escape(match.status || match.status_short || "")}</span>
        </div>
        <div class="match-teams">
          <div class="team home">
            ${this._logo(match.home_logo, match.home_team, "46")}
            <strong>${this._escape(match.home_team || "Home")}</strong>
          </div>
          ${score}
          <div class="team away">
            ${this._logo(match.away_logo, match.away_team, "46")}
            <strong>${this._escape(match.away_team || "Away")}</strong>
          </div>
        </div>
        <div class="match-footer">
          <span>${this._escape(match.stadium || "Venue TBC")}</span>
          <span>${this._escape(match.city || "")}</span>
        </div>
      </article>
    `;
  }

  _hero() {
    const status = this._statusInfo();
    const prefixes = this._competitionPrefixes();

    const options = prefixes
      .map((prefix) => {
        const state = this._allStates()[`${prefix}_status`];
        const attrs = state?.attributes || {};
        const label = `${attrs.competition || "Football Hub"} ${attrs.season || ""}`.trim();
        return `<option value="${this._escape(prefix)}" ${
          prefix === this._selectedPrefix ? "selected" : ""
        }>${this._escape(label)}</option>`;
      })
      .join("");

    return `
      <header class="hero">
        <div>
          <div class="eyebrow">YOUR MATCHDAY STARTS HERE</div>
          <h1><span>Football</span> Hub</h1>
          <p>${this._escape(status.competition || "Choose a competition")} · ${this._escape(
      status.season || ""
    )}</p>
        </div>
        <div class="hero-actions">
          ${
            prefixes.length > 1
              ? `<select id="competition-select" aria-label="Competition">${options}</select>`
              : ""
          }
          <span class="connection ${String(status.state).toLowerCase() === "online" ? "online" : ""}">
            <span class="dot"></span>${this._escape(status.state)}
          </span>
        </div>
      </header>
    `;
  }

  _nav() {
    const tabs = [
      ["overview", "mdi:view-dashboard-outline", "Overview"],
      ["live", "mdi:access-point", "Live"],
      ["fixtures", "mdi:calendar-month-outline", "Fixtures"],
      ["results", "mdi:check-decagram-outline", "Results"],
      ["table", "mdi:table-large", "Table"],
      ["players", "mdi:account-star-outline", "Players"],
      ["settings", "mdi:cog-outline", "Settings"],
    ];

    return `
      <nav class="tabs">
        ${tabs
          .map(
            ([id, icon, label]) => `
              <button data-tab="${id}" class="${this._activeTab === id ? "active" : ""}">
                <ha-icon icon="${icon}"></ha-icon>
                <span>${label}</span>
              </button>`
          )
          .join("")}
      </nav>
    `;
  }

  _overview() {
    const next = this._attrs("next_fixture");
    const live = this._attrs("live_match");
    const last = this._attrs("last_result");
    const status = this._statusInfo();
    const table = this._attrs("standings").table || [];
    const scorers = this._attrs("top_scorers").top_scorers || [];
    const today = this._entity("matches_today")?.state || "0";

    return `
      <section class="dashboard-grid">
        <article class="feature-card next-card">
          <div class="card-heading">
            <span><ha-icon icon="mdi:calendar-clock"></ha-icon> Next fixture</span>
            <span class="pill">${this._escape(next.round || "Upcoming")}</span>
          </div>
          ${
            next.home_team
              ? `
            <div class="feature-match">
              <div class="feature-team">
                ${this._logo(next.home_logo, next.home_team, "76")}
                <strong>${this._escape(next.home_team)}</strong>
              </div>
              <div class="feature-centre">
                <span class="versus">VS</span>
                <strong>${this._formatDate(next.kickoff)}</strong>
                <small>${this._escape(next.stadium || "Venue TBC")}</small>
              </div>
              <div class="feature-team">
                ${this._logo(next.away_logo, next.away_team, "76")}
                <strong>${this._escape(next.away_team)}</strong>
              </div>
            </div>`
              : `<div class="empty large">No upcoming fixture found.</div>`
          }
        </article>

        <article class="stat-card live-summary ${live.is_live ? "is-live" : ""}">
          <div class="card-heading">
            <span><ha-icon icon="mdi:access-point"></ha-icon> Live centre</span>
            <span class="pill ${live.is_live ? "live-pill" : ""}">${live.is_live ? "LIVE" : "OFF AIR"}</span>
          </div>
          ${
            live.is_live
              ? `<div class="live-score">${this._escape(live.scoreline || "")}</div>
                 <div class="live-minute">${this._escape(this._entity("live_match")?.state || "")}</div>`
              : `<div class="empty">No live matches right now.</div>`
          }
        </article>

        <article class="stat-card">
          <div class="card-heading"><span><ha-icon icon="mdi:counter"></ha-icon> Season</span></div>
          <div class="big-stat">${this._escape(status.fixtures_count ?? "0")}</div>
          <div class="stat-label">Total fixtures</div>
          <div class="mini-stats">
            <span><b>${this._escape(status.results_count ?? "0")}</b> results</span>
            <span><b>${this._escape(today)}</b> today</span>
          </div>
        </article>

        <article class="stat-card">
          <div class="card-heading"><span><ha-icon icon="mdi:trophy-outline"></ha-icon> Latest result</span></div>
          ${
            last.home_team
              ? `<div class="latest-result">
                  <span>${this._escape(last.home_team)}</span>
                  <strong>${this._score(last.home_goals)} – ${this._score(last.away_goals)}</strong>
                  <span>${this._escape(last.away_team)}</span>
                </div>
                <small>${this._formatDate(last.kickoff)}</small>`
              : `<div class="empty">No results yet.</div>`
          }
        </article>

        <article class="list-card table-preview">
          <div class="card-heading">
            <span><ha-icon icon="mdi:table-large"></ha-icon> League table</span>
            <button class="text-button" data-tab="table">View table</button>
          </div>
          ${this._tableRows(table)}
        </article>

        <article class="list-card">
          <div class="card-heading">
            <span><ha-icon icon="mdi:soccer"></ha-icon> Top scorers</span>
            <button class="text-button" data-tab="players">View players</button>
          </div>
          ${this._playerRows(scorers, "goals")}
        </article>
      </section>
    `;
  }

  _livePage() {
    const live = this._attrs("live_match");
    const matches = this._attrs("live_matches").matches || [];

    if (!live.is_live) {
      return `
        <section class="page-card centred">
          <ha-icon class="huge-icon" icon="mdi:access-point-off"></ha-icon>
          <h2>No live matches</h2>
          <p>The Live Centre will update automatically when a match begins.</p>
        </section>
        <section class="section">
          <h2>Current live feed</h2>
          <div class="match-list">${matches.length ? matches.map((m) => this._matchCard(m, "result")).join("") : ""}</div>
        </section>
      `;
    }

    const events = live.events || [];
    const stats = live.statistics || [];
    const lineups = live.lineups || [];

    return `
      <section class="live-centre-card">
        <div class="live-banner"><span class="pulse"></span> LIVE · ${this._escape(
          this._entity("live_match")?.state || live.status_short || ""
        )}</div>
        <div class="live-matchup">
          <div class="live-team">
            ${this._logo(live.home_logo, live.home_team, "96")}
            <h2>${this._escape(live.home_team)}</h2>
          </div>
          <div class="score-board">
            <strong>${this._score(live.home_goals)} – ${this._score(live.away_goals)}</strong>
            <span>${this._escape(live.status || "")}</span>
          </div>
          <div class="live-team">
            ${this._logo(live.away_logo, live.away_team, "96")}
            <h2>${this._escape(live.away_team)}</h2>
          </div>
        </div>
        <div class="live-details">
          <span><ha-icon icon="mdi:stadium"></ha-icon>${this._escape(live.stadium || "Venue TBC")}</span>
          <span><ha-icon icon="mdi:account-whistle"></ha-icon>${this._escape(live.referee || "Referee TBC")}</span>
          <span><ha-icon icon="mdi:trophy-outline"></ha-icon>${this._escape(live.round || "")}</span>
        </div>
      </section>

      <section class="three-column">
        <article class="page-card">
          <h2>Timeline</h2>
          ${events.length ? `<pre>${this._escape(JSON.stringify(events, null, 2))}</pre>` : `<div class="empty">No match events yet.</div>`}
        </article>
        <article class="page-card">
          <h2>Statistics</h2>
          ${stats.length ? `<pre>${this._escape(JSON.stringify(stats, null, 2))}</pre>` : `<div class="empty">Statistics not available yet.</div>`}
        </article>
        <article class="page-card">
          <h2>Line-ups</h2>
          ${lineups.length ? `<pre>${this._escape(JSON.stringify(lineups, null, 2))}</pre>` : `<div class="empty">Line-ups not available yet.</div>`}
        </article>
      </section>
    `;
  }

  _fixturesPage() {
    const fixtures = this._attrs("fixtures");
    const today = this._attrs("matches_today").matches || [];
    const nextFive = fixtures.next_5 || [];

    return `
      <section class="page-heading">
        <div><span class="eyebrow">MATCH SCHEDULE</span><h2>Fixtures</h2></div>
        <div class="count-badge">${this._escape(fixtures.total_fixtures || 0)} matches</div>
      </section>
      ${
        today.length
          ? `<section class="section"><h3>Today</h3><div class="match-list">${today
              .map((m) => this._matchCard(m))
              .join("")}</div></section>`
          : ""
      }
      <section class="section">
        <h3>Next fixtures</h3>
        <div class="match-list">${nextFive.length ? nextFive.map((m) => this._matchCard(m)).join("") : `<div class="empty">No fixtures available.</div>`}</div>
      </section>
    `;
  }

  _resultsPage() {
    const attrs = this._attrs("results");
    const results = attrs.latest_5 || [];

    return `
      <section class="page-heading">
        <div><span class="eyebrow">COMPLETED MATCHES</span><h2>Results</h2></div>
        <div class="count-badge">${this._escape(attrs.total_results || 0)} played</div>
      </section>
      <div class="match-list">${results.length ? results.map((m) => this._matchCard(m, "result")).join("") : `<div class="empty">No results available yet.</div>`}</div>
    `;
  }

  _tableRows(table) {
    if (!table.length) return `<div class="empty">The league table is not available yet.</div>`;

    return `
      <div class="table">
        <div class="table-head"><span>#</span><span>Club</span><span>P</span><span>GD</span><span>Pts</span></div>
        ${table
          .map(
            (row, index) => `
          <div class="table-row">
            <span>${this._escape(row.rank ?? index + 1)}</span>
            <span class="club">${this._logo(row.team_logo || row.logo, row.team || row.team_name, "28")} ${this._escape(
              row.team || row.team_name || "Team"
            )}</span>
            <span>${this._escape(row.played ?? row.all?.played ?? 0)}</span>
            <span>${this._escape(row.goals_diff ?? row.goal_difference ?? 0)}</span>
            <strong>${this._escape(row.points ?? 0)}</strong>
          </div>`
          )
          .join("")}
      </div>
    `;
  }

  _tablePage() {
    const attrs = this._attrs("standings");
    const table = attrs.table || [];

    return `
      <section class="page-heading">
        <div><span class="eyebrow">CURRENT STANDINGS</span><h2>League table</h2></div>
        <div class="count-badge">${this._escape(attrs.total_teams || 0)} teams</div>
      </section>
      <section class="page-card">${this._tableRows(table)}</section>
      ${
        Number(attrs.total_teams || 0) > table.length
          ? `<p class="notice">The sensor currently exposes the first ${table.length} teams. The full table will be connected in the next backend update.</p>`
          : ""
      }
    `;
  }

  _playerRows(players, statKey) {
    if (!players.length) return `<div class="empty">Player data is not available yet.</div>`;

    return `
      <div class="player-list">
        ${players
          .map((item, index) => {
            const player = item.player || {};
            const stats = item.statistics?.[0] || {};
            const goals = stats.goals || {};
            const value = statKey === "assists" ? goals.assists : goals.total;
            return `
              <div class="player-row">
                <span class="rank">${index + 1}</span>
                ${this._logo(player.photo, player.name, "42")}
                <span class="player-name"><strong>${this._escape(player.name || "Player")}</strong><small>${this._escape(
              stats.team?.name || ""
            )}</small></span>
                <strong class="player-stat">${this._escape(value ?? 0)}</strong>
              </div>`;
          })
          .join("")}
      </div>
    `;
  }

  _playersPage() {
    const scorers = this._attrs("top_scorers").top_scorers || [];
    const assists = this._attrs("top_assists").top_assists || [];

    return `
      <section class="page-heading">
        <div><span class="eyebrow">PLAYER LEADERBOARDS</span><h2>Players</h2></div>
      </section>
      <section class="two-column">
        <article class="page-card"><h2>Top scorers</h2>${this._playerRows(scorers, "goals")}</article>
        <article class="page-card"><h2>Top assists</h2>${this._playerRows(assists, "assists")}</article>
      </section>
    `;
  }

  _settingsPage() {
    const status = this._statusInfo();
    const prefixes = this._competitionPrefixes();

    return `
      <section class="page-heading">
        <div><span class="eyebrow">FOOTBALL HUB</span><h2>Settings & diagnostics</h2></div>
      </section>
      <section class="two-column">
        <article class="page-card settings-list">
          <h2>Competition</h2>
          <div><span>Name</span><strong>${this._escape(status.competition || "Unknown")}</strong></div>
          <div><span>Season</span><strong>${this._escape(status.season || "Unknown")}</strong></div>
          <div><span>Country</span><strong>${this._escape(status.country || "Unknown")}</strong></div>
          <div><span>Provider mode</span><strong>${this._escape(status.provider_mode || "Unknown")}</strong></div>
        </article>
        <article class="page-card settings-list">
          <h2>Diagnostics</h2>
          <div><span>Integration</span><strong>${this._escape(status.state)}</strong></div>
          <div><span>Configured competitions</span><strong>${prefixes.length}</strong></div>
          <div><span>Panel build</span><strong>${PANEL_VERSION}</strong></div>
          <div><span>Entity prefix</span><strong class="mono">${this._escape(this._selectedPrefix || "None")}</strong></div>
        </article>
      </section>
    `;
  }

  _content() {
    if (!this._selectedPrefix) {
      return `
        <section class="page-card centred">
          <ha-icon class="huge-icon" icon="mdi:soccer"></ha-icon>
          <h2>Football Hub is ready</h2>
          <p>Add and configure the Football Hub integration to populate this panel.</p>
        </section>`;
    }

    switch (this._activeTab) {
      case "live":
        return this._livePage();
      case "fixtures":
        return this._fixturesPage();
      case "results":
        return this._resultsPage();
      case "table":
        return this._tablePage();
      case "players":
        return this._playersPage();
      case "settings":
        return this._settingsPage();
      default:
        return this._overview();
    }
  }

  _render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <div class="app-shell">
        ${this._hero()}
        ${this._nav()}
        <main>${this._content()}</main>
        <footer>Football Hub · Built for Home Assistant</footer>
      </div>
    `;

    this.shadowRoot.querySelectorAll("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => this._setTab(button.dataset.tab));
    });

    this.shadowRoot.querySelector("#competition-select")?.addEventListener("change", (event) => {
      this._setCompetition(event.target.value);
    });
  }

  _styles() {
    return `
      :host {
        display: block;
        min-height: 100vh;
        color: var(--primary-text-color);
        --fh-purple: #071a14;
        --fh-purple-2: #0b4d36;
        --fh-cyan: #31e981;
        --fh-pink: #ff4d4d;
        --fh-surface: color-mix(in srgb, var(--card-background-color) 90%, #0a2019 10%);
        --fh-border: color-mix(in srgb, var(--divider-color) 70%, transparent);
        font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif);
      }

      * { box-sizing: border-box; }

      button, select { font: inherit; }

      .app-shell {
        min-height: 100vh;
        background:
          radial-gradient(circle at 84% 2%, rgba(49, 233, 129, .13), transparent 30rem),
          linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px),
          var(--primary-background-color);
      }

      .hero {
        min-height: 190px;
        padding: 34px clamp(18px, 4vw, 56px) 28px;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        color: white;
        background:
          linear-gradient(105deg, rgba(3, 14, 11, .28), rgba(3, 14, 11, .72)),
          radial-gradient(circle at 76% 44%, rgba(49,233,129,.2), transparent 28%),
          linear-gradient(135deg, #061711, #0a3526 58%, #09221c);
        position: relative;
        overflow: hidden;
      }

      .hero::after {
        content: "";
        position: absolute;
        width: 390px;
        height: 390px;
        border: 2px solid rgba(255,255,255,.12);
        border-radius: 50%;
        box-shadow: inset 0 0 0 76px rgba(255,255,255,.025);
        right: -40px;
        top: -105px;
      }

      .hero > * { position: relative; z-index: 1; }

      .hero h1 {
        margin: 6px 0;
        font-size: clamp(2rem, 5vw, 4.2rem);
        line-height: .95;
        letter-spacing: -.055em;
        text-transform: uppercase;
      }

      .hero h1 span { color: var(--fh-cyan); }

      .hero p { margin: 10px 0 0; opacity: .78; }

      .eyebrow {
        font-size: .72rem;
        letter-spacing: .18em;
        font-weight: 800;
        opacity: .7;
      }

      .hero-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      select {
        border: 1px solid rgba(255,255,255,.18);
        color: white;
        background: rgba(0,0,0,.22);
        border-radius: 12px;
        padding: 10px 34px 10px 12px;
      }

      select option { color: #111; }

      .connection {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid rgba(255,255,255,.18);
        background: rgba(0,0,0,.18);
        border-radius: 999px;
        padding: 9px 13px;
        font-size: .82rem;
        font-weight: 700;
      }

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ff6b6b;
      }

      .connection.online .dot {
        background: var(--fh-cyan);
        box-shadow: 0 0 12px var(--fh-cyan);
      }

      .tabs {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        overflow-x: auto;
        padding: 0 clamp(10px, 3vw, 44px);
        background: color-mix(in srgb, #071a14 94%, transparent);
        backdrop-filter: blur(18px);
        border-bottom: 1px solid var(--fh-border);
        scrollbar-width: none;
      }

      .tabs::-webkit-scrollbar { display: none; }

      .tabs button {
        appearance: none;
        border: 0;
        background: transparent;
        color: rgba(255,255,255,.68);
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 17px 16px 14px;
        border-bottom: 3px solid transparent;
        cursor: pointer;
        white-space: nowrap;
        font-weight: 700;
      }

      .tabs button.active {
        color: white;
        border-bottom-color: var(--fh-cyan);
      }

      main {
        width: min(1500px, 100%);
        margin: 0 auto;
        padding: clamp(18px, 3vw, 40px);
      }

      .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        gap: 18px;
      }

      .feature-card, .stat-card, .list-card, .page-card, .live-centre-card {
        background: var(--fh-surface);
        border: 1px solid var(--fh-border);
        border-radius: 16px;
        box-shadow: 0 16px 42px rgba(0,0,0,.12);
      }

      .feature-card {
        grid-column: span 8;
        padding: clamp(20px, 3vw, 32px);
      }

      .stat-card {
        grid-column: span 4;
        padding: 22px;
        min-height: 180px;
      }

      .list-card {
        grid-column: span 6;
        padding: 22px;
      }

      .card-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 20px;
        font-size: .82rem;
        text-transform: uppercase;
        letter-spacing: .08em;
        font-weight: 800;
        color: var(--secondary-text-color);
      }

      .card-heading > span:first-child {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .pill, .count-badge {
        border-radius: 999px;
        padding: 7px 11px;
        background: color-mix(in srgb, var(--fh-purple) 12%, transparent);
        color: color-mix(in srgb, var(--primary-text-color) 86%, var(--fh-purple));
        font-size: .72rem;
        font-weight: 800;
      }

      .live-pill {
        background: rgba(255,61,129,.14);
        color: var(--fh-pink);
      }

      .feature-match {
        display: grid;
        grid-template-columns: 1fr minmax(150px, .8fr) 1fr;
        align-items: center;
        gap: 20px;
      }

      .feature-team, .live-team {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 10px;
      }

      .feature-team strong { font-size: clamp(1rem, 2vw, 1.35rem); }

      .feature-centre {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 6px;
      }

      .feature-centre strong { font-size: 1.05rem; }

      .feature-centre small, .stat-card small { color: var(--secondary-text-color); }

      .versus {
        font-size: .72rem;
        font-weight: 900;
        color: var(--fh-cyan);
        letter-spacing: .14em;
      }

      .team-logo {
        object-fit: contain;
        filter: drop-shadow(0 8px 8px rgba(0,0,0,.12));
      }

      .logo-placeholder {
        display: inline-grid;
        place-items: center;
        flex: 0 0 auto;
        border-radius: 50%;
        color: white;
        background: linear-gradient(135deg, var(--fh-purple), var(--fh-purple-2));
        font-weight: 900;
      }

      .big-stat {
        font-size: clamp(2.5rem, 5vw, 4rem);
        line-height: 1;
        font-weight: 900;
        letter-spacing: -.06em;
      }

      .stat-label { color: var(--secondary-text-color); margin-top: 7px; }

      .mini-stats {
        display: flex;
        gap: 16px;
        margin-top: 22px;
        color: var(--secondary-text-color);
        font-size: .82rem;
      }

      .mini-stats b { color: var(--primary-text-color); }

      .live-summary.is-live {
        border-color: color-mix(in srgb, var(--fh-pink) 50%, var(--fh-border));
        box-shadow: 0 0 0 1px rgba(255,61,129,.08), 0 16px 38px rgba(255,61,129,.09);
      }

      .live-score, .latest-result {
        font-size: 1.18rem;
        font-weight: 800;
      }

      .live-minute {
        margin-top: 10px;
        color: var(--fh-pink);
        font-size: 1.8rem;
        font-weight: 900;
      }

      .latest-result {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 12px;
        margin-bottom: 10px;
      }

      .latest-result span:last-child { text-align: right; }

      .table {
        display: flex;
        flex-direction: column;
      }

      .table-head, .table-row {
        display: grid;
        grid-template-columns: 38px minmax(150px, 1fr) 44px 50px 52px;
        align-items: center;
        gap: 8px;
        min-height: 48px;
      }

      .table-head {
        color: var(--secondary-text-color);
        font-size: .72rem;
        font-weight: 800;
        text-transform: uppercase;
      }

      .table-row {
        border-top: 1px solid var(--fh-border);
      }

      .table-row .club {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        font-weight: 700;
      }

      .text-button {
        border: 0;
        background: transparent;
        color: var(--fh-cyan);
        cursor: pointer;
        font-weight: 800;
      }

      .player-list { display: flex; flex-direction: column; }

      .player-row {
        display: grid;
        grid-template-columns: 28px 42px minmax(100px, 1fr) 44px;
        align-items: center;
        gap: 12px;
        min-height: 62px;
        border-top: 1px solid var(--fh-border);
      }

      .player-row:first-child { border-top: 0; }

      .rank { color: var(--secondary-text-color); font-weight: 800; }

      .player-name {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .player-name small { color: var(--secondary-text-color); }

      .player-stat {
        font-size: 1.2rem;
        text-align: right;
      }

      .page-heading {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 18px;
        margin-bottom: 22px;
      }

      .page-heading h2 { margin: 4px 0 0; font-size: clamp(2rem, 5vw, 3.4rem); letter-spacing: -.04em; }

      .page-card { padding: clamp(18px, 3vw, 28px); }

      .page-card h2 { margin: 0 0 18px; }

      .section { margin-bottom: 30px; }

      .section h3 { margin: 0 0 14px; font-size: 1.3rem; }

      .match-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 15px;
      }

      .match-card {
        background: var(--fh-surface);
        border: 1px solid var(--fh-border);
        border-radius: 14px;
        padding: 17px;
      }

      .match-meta, .match-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        color: var(--secondary-text-color);
        font-size: .76rem;
      }

      .match-teams {
        display: grid;
        grid-template-columns: 1fr minmax(70px, auto) 1fr;
        align-items: center;
        gap: 12px;
        margin: 18px 0;
      }

      .team {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .team.away { flex-direction: row-reverse; text-align: right; }

      .match-score {
        font-size: 1.45rem;
        font-weight: 900;
        white-space: nowrap;
      }

      .match-score span { color: var(--secondary-text-color); padding: 0 4px; }

      .match-time {
        color: var(--secondary-text-color);
        font-size: .78rem;
        font-weight: 700;
        text-align: center;
      }

      .live-centre-card { padding: clamp(22px, 4vw, 42px); }

      .live-banner {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 9px;
        color: var(--fh-pink);
        font-size: .78rem;
        font-weight: 900;
        letter-spacing: .14em;
      }

      .pulse {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--fh-pink);
        box-shadow: 0 0 0 0 rgba(255,61,129,.5);
        animation: pulse 1.5s infinite;
      }

      @keyframes pulse {
        70% { box-shadow: 0 0 0 10px rgba(255,61,129,0); }
        100% { box-shadow: 0 0 0 0 rgba(255,61,129,0); }
      }

      .live-matchup {
        display: grid;
        grid-template-columns: 1fr minmax(130px, .6fr) 1fr;
        align-items: center;
        gap: 20px;
        margin: 28px 0;
      }

      .live-team h2 { margin: 0; font-size: clamp(1.2rem, 3vw, 2rem); }

      .score-board { text-align: center; }

      .score-board strong {
        display: block;
        font-size: clamp(2.8rem, 8vw, 5.8rem);
        line-height: 1;
        letter-spacing: -.08em;
      }

      .score-board span { color: var(--secondary-text-color); }

      .live-details {
        display: flex;
        justify-content: center;
        gap: 24px;
        flex-wrap: wrap;
        color: var(--secondary-text-color);
        font-size: .82rem;
      }

      .live-details span { display: inline-flex; align-items: center; gap: 7px; }

      .two-column, .three-column {
        display: grid;
        gap: 18px;
        margin-top: 18px;
      }

      .two-column { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .three-column { grid-template-columns: repeat(3, minmax(0, 1fr)); }

      pre {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        max-height: 480px;
        overflow: auto;
        font-size: .72rem;
        color: var(--secondary-text-color);
      }

      .centred {
        min-height: 330px;
        display: grid;
        place-items: center;
        align-content: center;
        text-align: center;
      }

      .centred h2 { margin: 14px 0 6px; }
      .centred p { color: var(--secondary-text-color); max-width: 500px; }

      .huge-icon { --mdc-icon-size: 74px; color: var(--fh-purple-2); }

      .empty {
        color: var(--secondary-text-color);
        padding: 18px 0;
      }

      .empty.large { padding: 50px 0; text-align: center; }

      .settings-list > div {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        border-top: 1px solid var(--fh-border);
        padding: 15px 0;
      }

      .settings-list span { color: var(--secondary-text-color); }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .78rem; overflow-wrap: anywhere; }

      .notice {
        color: var(--secondary-text-color);
        text-align: center;
        font-size: .8rem;
      }

      footer {
        padding: 22px;
        text-align: center;
        color: var(--secondary-text-color);
        font-size: .72rem;
      }

      @media (max-width: 980px) {
        .feature-card { grid-column: span 12; }
        .stat-card { grid-column: span 6; }
        .list-card { grid-column: span 12; }
        .three-column { grid-template-columns: 1fr; }
      }

      @media (max-width: 700px) {
        .hero {
          min-height: 160px;
          padding: 26px 18px 22px;
          align-items: flex-start;
          flex-direction: column;
        }

        .hero-actions { justify-content: flex-start; }

        .tabs button { padding-inline: 13px; }
        .tabs button span { display: none; }

        main { padding: 14px; }

        .stat-card { grid-column: span 12; }
        .feature-match { grid-template-columns: 1fr 95px 1fr; gap: 8px; }
        .feature-team strong { font-size: .85rem; }
        .feature-centre strong { font-size: .78rem; }
        .feature-centre small { display: none; }

        .match-list { grid-template-columns: 1fr; }
        .two-column { grid-template-columns: 1fr; }

        .live-matchup { grid-template-columns: 1fr 90px 1fr; gap: 8px; }
        .live-team h2 { font-size: .9rem; }
        .score-board strong { font-size: 2.65rem; }

        .table-head, .table-row {
          grid-template-columns: 30px minmax(120px, 1fr) 34px 42px 42px;
          font-size: .78rem;
        }

        .match-teams {
          grid-template-columns: 1fr 74px 1fr;
        }

        .team {
          flex-direction: column;
          text-align: center;
          font-size: .8rem;
        }

        .team.away { flex-direction: column; text-align: center; }
        .match-footer { flex-direction: column; align-items: flex-start; }
      }
    `;
  }
}

if (!customElements.get("football-hub-panel")) {
  customElements.define("football-hub-panel", FootballHubPanel);
}

