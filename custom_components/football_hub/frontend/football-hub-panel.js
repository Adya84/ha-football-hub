const PANEL_VERSION = "0.7.1-my-club-data";

class FootballHubPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    const savedTab = localStorage.getItem("football_hub_active_page") || "overview";
    this._activeTab = ["overview", "live", "fixtures", "results", "table", "players", "my-club", "supporters", "settings"].includes(savedTab)
      ? savedTab
      : "overview";
    this._selectedFixtureTeam = localStorage.getItem("football_hub_fixture_team") || "__all__";
    this._fixturePage = 0;
    this._selectedLiveMatch = localStorage.getItem("football_hub_live_match") || "";
    this._selectedLiveTeam = localStorage.getItem("football_hub_live_team") || "";
    this._selectedPrefix = localStorage.getItem("football_hub_selected_prefix") || "";
    this._selectedCountry = localStorage.getItem("football_hub_selected_country") || "";
    this._selectedClub = localStorage.getItem("football_hub_my_club") || "";
    this._pendingCompetition = "";
    this._supporters = [];
    this._supportersLoading = false;
    this._supportersLoaded = false;
  }

  set hass(hass) {
    this._hass = hass;
    this._ensureCompetition();
    if (this._pendingCompetition && this._statusInfo().competition_key === this._pendingCompetition) {
      this._pendingCompetition = "";
    }
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
    this._loadSupporters();
  }

  async _loadSupporters() {
    if (this._supportersLoading || this._supportersLoaded) return;

    this._supportersLoading = true;
    const cacheBust = Date.now();

    const fetchList = async (url, payloadKeys = []) => {
      try {
        const response = await fetch(`${url}?t=${cacheBust}`, {
          cache: "no-store",
        });

        if (!response.ok) return [];

        const raw = (await response.text()).trim();
        if (!raw) return [];

        const payload = JSON.parse(raw);

        if (Array.isArray(payload)) return payload;

        for (const key of payloadKeys) {
          if (Array.isArray(payload?.[key])) return payload[key];
        }
      } catch (_error) {
        return [];
      }

      return [];
    };

    const sortByDate = (items) =>
      [...items].sort((a, b) => {
        const aDate = new Date(a?.date || "1900-01-01").getTime();
        const bDate = new Date(b?.date || "1900-01-01").getTime();
        return bDate - aDate;
      });

    const [supporters, premiumSupporters] = await Promise.all([
      fetchList(
        "https://raw.githubusercontent.com/Adya84/ha-football-hub/main/supporters/supporters.json",
        ["supporters"]
      ),
      fetchList(
        "https://raw.githubusercontent.com/Adya84/ha-football-hub/main/supporters/premium_supporters.json",
        ["premiumSupporters", "supporters"]
      ),
    ]);

    this._supporters = sortByDate(supporters);
    this._premiumSupporters = sortByDate(premiumSupporters);
    this._supportersLoading = false;
    this._supportersLoaded = true;
    this._render();
  }

  _countryFlag(country, className = "supporter-flag-image") {
    const name = String(country || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const inlineFlags = {
      england: `
        <svg class="${className}" viewBox="0 0 60 36" role="img" aria-label="England flag">
          <rect width="60" height="36" fill="#ffffff"/>
          <rect x="25" width="10" height="36" fill="#ce1124"/>
          <rect y="13" width="60" height="10" fill="#ce1124"/>
        </svg>
      `,
      scotland: `
        <svg class="${className}" viewBox="0 0 60 36" role="img" aria-label="Scotland flag">
          <rect width="60" height="36" fill="#005eb8"/>
          <polygon points="0,0 7,0 60,29 60,36 53,36 0,7" fill="#ffffff"/>
          <polygon points="60,0 53,0 0,29 0,36 7,36 60,7" fill="#ffffff"/>
        </svg>
      `,
      wales: `
        <svg class="${className}" viewBox="0 0 60 36" role="img" aria-label="Wales flag">
          <rect width="60" height="18" fill="#ffffff"/>
          <rect y="18" width="60" height="18" fill="#00ab39"/>
          <path d="M14 24c5-7 8-11 15-11 4 0 7 1 10 3l4-4 1 6 6 1-5 4 2 7-7-3-4 5-3-6-8 2 2-6-6-3z" fill="#d30731"/>
        </svg>
      `,
      "northern ireland": `
        <svg class="${className}" viewBox="0 0 60 36" role="img" aria-label="Northern Ireland flag">
          <rect width="60" height="36" fill="#ffffff"/>
          <rect x="25" width="10" height="36" fill="#ce1124"/>
          <rect y="13" width="60" height="10" fill="#ce1124"/>
        </svg>
      `
    };

    if (inlineFlags[name]) return inlineFlags[name];

    const codes = {
      argentina:"ar", australia:"au", austria:"at", belgium:"be",
      brazil:"br", bulgaria:"bg", canada:"ca", chile:"cl",
      china:"cn", colombia:"co", croatia:"hr", cyprus:"cy",
      czechia:"cz", "czech republic":"cz", denmark:"dk",
      estonia:"ee", finland:"fi", france:"fr", germany:"de",
      greece:"gr", hungary:"hu", iceland:"is", india:"in",
      indonesia:"id", ireland:"ie", italy:"it", japan:"jp",
      latvia:"lv", lithuania:"lt", luxembourg:"lu", malaysia:"my",
      mexico:"mx", netherlands:"nl", holland:"nl", "new zealand":"nz",
      norway:"no", philippines:"ph", poland:"pl", portugal:"pt",
      romania:"ro", serbia:"rs", singapore:"sg", slovakia:"sk",
      slovenia:"si", "south africa":"za", "south korea":"kr",
      korea:"kr", spain:"es", sweden:"se", switzerland:"ch",
      thailand:"th", turkey:"tr", turkiye:"tr", ukraine:"ua",
      "united arab emirates":"ae", uae:"ae", "united kingdom":"gb",
      uk:"gb", "great britain":"gb", usa:"us", us:"us",
      "united states":"us", "united states of america":"us",
      vietnam:"vn"
    };

    const code = codes[name] || (/^[a-z]{2}$/.test(name) ? name : "");

    if (!code) return `<span class="supporter-flag-fallback">🏳️</span>`;

    return `<img class="${className}" src="https://flagcdn.com/w160/${code}.png" alt="${this._escape(country || code)} flag" loading="lazy">`;
  }

  _supporterCard(supporter) {
    const name = typeof supporter === "string" ? supporter : supporter?.name;
    const country = typeof supporter === "string" ? "" : supporter?.country;
    const date = typeof supporter === "string" ? "" : supporter?.date;
    const message = typeof supporter === "string" ? "" : supporter?.message;
    return `<article class="supporter-card"><div class="supporter-avatar">${this._countryFlag(country, "supporter-avatar-flag")}</div><div class="supporter-copy"><strong>${this._escape(name || "Anonymous Supporter")}</strong><div class="supporter-meta">${country ? `<span class="supporter-country">${this._escape(country)}</span>` : ""}${date ? `<span>${this._escape(date)}</span>` : ""}</div>${message ? `<p>${this._escape(message)}</p>` : ""}</div></article>`;
  }

  _supportersPage() {
    const supporters = this._supporters;
    const counts = supporters.reduce((out, item) => { const c = String(item?.country || "").trim(); if (c) out[c] = (out[c] || 0) + 1; return out; }, {});
    const countries = Object.entries(counts).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
    const latestDate = supporters[0]?.date || "";
    const latest = latestDate ? supporters.filter((s) => s?.date === latestDate) : supporters.slice(0,4);
    return `
      <section class="page-heading"><div><span class="eyebrow">COMMUNITY SUPPORT</span><h2>Supporters</h2></div><div class="count-badge">${supporters.length} supporters</div></section>
      <section class="support-hero page-card"><div><span class="support-kicker">🍺 HELP BUILD THE FUTURE</span><h2>Support Football Hub</h2><p>This project started as a personal Home Assistant football dashboard and has grown thanks to community feedback, testing, ideas and support.</p><div class="support-actions"><a class="support-button primary" href="https://ko-fi.com/supportkofi" target="_blank" rel="noopener noreferrer">☕ Support via Ko-fi</a><a class="support-button" href="https://paypal.me/graffidoodle" target="_blank" rel="noopener noreferrer">💳 Support via PayPal</a></div></div><div class="support-thanks"><strong>Thank you</strong><span>Every contribution helps</span></div></section>
      <section class="support-benefits"><article class="page-card"><ha-icon icon="mdi:database-clock-outline"></ha-icon><strong>Live data costs</strong><span>Helps cover reliable football data and matchday services.</span></article><article class="page-card"><ha-icon icon="mdi:tools"></ha-icon><strong>Fixes & improvements</strong><span>Supports testing, maintenance and regular updates.</span></article><article class="page-card"><ha-icon icon="mdi:rocket-launch-outline"></ha-icon><strong>Future features</strong><span>Helps build more competitions, statistics and dashboard tools.</span></article><article class="page-card"><ha-icon icon="mdi:account-group-outline"></ha-icon><strong>Community development</strong><span>Keeps the project community-led and available to Home Assistant users.</span></article></section>
      <section class="page-card premium-info"><div><span class="support-kicker">⭐ PREMIUM SUPPORTERS</span><h2>Extra recognition inside Football Hub</h2><p>Donate £10 / $10 / €10 or more to be featured with your name, country flag and an optional personal message.</p></div><div class="premium-features"><span>👑 Premium profile</span><span>🌍 Name & country flag</span><span>💬 Personal message</span></div></section>
      <section class="support-summary page-card"><div><strong>${supporters.length}</strong><span>Total supporters</span></div><div><strong>${countries.length}</strong><span>Countries supporting</span></div><div><strong>${this._escape(latestDate || "—")}</strong><span>Latest support date</span></div></section>
      ${countries.length ? `<section class="page-card country-support"><h2>Supporters around the world</h2><div class="country-support-grid">${countries.map(([country,count]) => `<span>${this._countryFlag(country)} ${this._escape(country)} <b>${count}</b></span>`).join("")}</div></section>` : ""}
      ${this._supportersLoading && !supporters.length ? `<section class="page-card centred"><div class="empty">Loading supporters…</div></section>` : supporters.length ? `<section class="section"><div class="section-title-row"><div><span class="eyebrow">LATEST THANK YOUS</span><h3>Latest supporters</h3></div><span>${this._escape(latestDate)}</span></div><div class="supporter-grid latest-grid">${latest.map((s) => this._supporterCard(s)).join("")}</div></section><section class="section"><div class="section-title-row"><div><span class="eyebrow">THE COMMUNITY</span><h3>All supporters</h3></div></div><div class="supporter-grid">${supporters.map((s) => this._supporterCard(s)).join("")}</div></section>` : `<section class="page-card centred"><ha-icon class="huge-icon" icon="mdi:heart-outline"></ha-icon><h2>No supporters loaded yet</h2><p>Support the project and have your name added here as a thank you.</p></section>`}
      <section class="page-card support-how"><strong>To be added as a supporter</strong><span>After donating, include your name, country and optional short message.</span></section>`;
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
    localStorage.setItem("football_hub_active_page", tab);
    this._render();
  }

  _setCountry(country) {
    this._selectedCountry = country;
    localStorage.setItem("football_hub_selected_country", country);

    const status = this._statusInfo();
    const catalogue = Array.isArray(status.available_competitions)
      ? status.available_competitions
      : [];
    const firstLeague = catalogue
      .filter((item) => item.country === country)
      .sort((a, b) => a.name.localeCompare(b.name))[0];

    if (firstLeague?.key) {
      this._setLeague(firstLeague.key);
    }
    this._render();
  }

  _setLeague(competition) {
    const status = this._statusInfo();
    this._pendingCompetition = competition;
    this._hass?.callService("football_hub", "select_competition", {
      competition,
      entry_id: status.config_entry_id || "",
    }).catch(() => {});
    localStorage.setItem("football_hub_selected_league", competition);
  }

  _setFixtureTeam(team) {
    this._selectedFixtureTeam = team;
    localStorage.setItem("football_hub_fixture_team", team);
    if (team && team !== "__all__") {
      this._selectedLiveTeam = team;
      localStorage.setItem("football_hub_live_team", team);
      this._hass?.callService("football_hub", "select_live_team", { team }).catch(() => {});
    }
    this._fixturePage = 0;
    this._render();
  }

  _setFixturePage(page) {
    this._fixturePage = Math.max(0, page);
    this._render();
    this.shadowRoot.querySelector(".page-heading")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  _setLiveMatch(matchId) {
    this._selectedLiveMatch = matchId;
    localStorage.setItem("football_hub_live_match", matchId);
    this._render();
  }

  _setLiveTeam(team) {
    this._selectedLiveTeam = team;
    localStorage.setItem("football_hub_live_team", team);
    this._hass?.callService("football_hub", "select_live_team", { team }).catch(() => {});
    const matches = this._attrs("live_matches").matches || [];
    const index = matches.findIndex((match) => match.home_team === team || match.away_team === team);
    if (index >= 0) {
      const match = matches[index];
      this._selectedLiveMatch = String(match.fixture_id ?? match.id ?? `${match.home_team}-${match.away_team}-${index}`);
      localStorage.setItem("football_hub_live_match", this._selectedLiveMatch);
    }
    this._render();
  }

  _setMyClub(team) {
    this._selectedClub = team;
    localStorage.setItem("football_hub_my_club", team);
    const status = this._statusInfo();
    this._hass?.callService("football_hub", "select_my_club", {
      team,
      entry_id: status.config_entry_id || "",
    }).catch(() => {});
    this._setLiveTeam(team);
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
    const catalogue = Array.isArray(status.available_competitions)
      ? status.available_competitions
      : [];
    const countries = [...new Set(catalogue.map((item) => item.country).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    if (!countries.includes(this._selectedCountry)) {
      this._selectedCountry = countries.includes(status.country) ? status.country : (countries[0] || "");
    }
    const countryLeagues = catalogue
      .filter((item) => item.country === this._selectedCountry)
      .sort((a, b) => a.name.localeCompare(b.name));
    const pendingLeague = catalogue.find((item) => item.key === this._pendingCompetition);
    const activeCompetition = pendingLeague || {
      name: status.competition,
      country: status.country,
      key: status.competition_key,
    };

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
          <p>${this._escape(activeCompetition.name || "Choose a competition")} · ${this._escape(
      status.season || ""
    )}</p>
        </div>
        <div class="hero-actions">
          ${catalogue.length ? `
            <div class="competition-picker">
              <label><span>Country</span><select id="country-select" aria-label="Country">
                ${countries.map((country) => `<option value="${this._escape(country)}" ${country === this._selectedCountry ? "selected" : ""}>${this._escape(country)}</option>`).join("")}
              </select></label>
              <label><span>League</span><select id="league-select" aria-label="League">
                ${countryLeagues.map((league) => `<option value="${this._escape(league.key)}" ${league.key === status.competition_key ? "selected" : ""}>${this._escape(league.name)}</option>`).join("")}
              </select></label>
            </div>
          ` : ""}
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
      ["my-club", "mdi:shield-star-outline", "My Club"],
      ["supporters", "mdi:heart-outline", "Supporters"],
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
          ${this._tableRows(table.slice(0, 5))}
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

  _eventRows(events) {
    if (!events.length) return `<div class="empty">No match events yet.</div>`;
    return `<div class="event-timeline">${events.map((event) => {
      const elapsed = event.time?.elapsed ?? event.elapsed ?? "";
      const extra = event.time?.extra ? `+${event.time.extra}` : "";
      const type = String(event.type || event.detail || "Event");
      const detail = String(event.detail || "");
      const icon = type.toLowerCase().includes("goal") ? "⚽" :
        type.toLowerCase().includes("card") ? (detail.toLowerCase().includes("red") ? "🟥" : "🟨") :
        type.toLowerCase().includes("subst") ? "🔄" : "●";
      return `<div class="event-row">
        <span class="event-minute">${this._escape(elapsed)}${this._escape(extra)}'</span>
        <span class="event-icon">${icon}</span>
        <span class="event-copy"><strong>${this._escape(event.player?.name || event.player || event.player_name || detail || type)}</strong><small>${this._escape(event.team?.name || event.team || event.team_name || type)}</small></span>
      </div>`;
    }).join("")}</div>`;
  }

  _statRows(statistics, live) {
    if (!statistics.length) return `<div class="empty">Statistics not available yet.</div>`;
    const teamName = (item) => item.team?.name || item.team || "";
    const home = statistics.find((item) => teamName(item) === live.home_team) || statistics[0] || {};
    const away = statistics.find((item) => teamName(item) === live.away_team) || statistics[1] || {};
    const toRows = (value) => Array.isArray(value) ? value : Object.entries(value || {}).map(([type, statValue]) => ({ type, value: statValue }));
    const homeStats = toRows(home.statistics || home.stats);
    const awayStats = toRows(away.statistics || away.stats);
    if (!homeStats.length) return `<div class="empty">Statistics not available yet.</div>`;
    return `<div class="live-stats">
      <div class="stats-team-head"><strong>${this._escape(live.home_team)}</strong><span>Match statistics</span><strong>${this._escape(live.away_team)}</strong></div>
      ${homeStats.map((stat, index) => {
        const awayStat = awayStats.find((item) => item.type === stat.type) || awayStats[index] || {};
        return `<div class="stat-comparison"><strong>${this._escape(stat.value ?? "–")}</strong><span>${this._escape(stat.type || "Statistic")}</span><strong>${this._escape(awayStat.value ?? "–")}</strong></div>`;
      }).join("")}
    </div>`;
  }

  _lineupCards(lineups) {
    if (!lineups.length) return `<div class="empty">Line-ups not available yet.</div>`;
    return `<div class="lineup-grid">${lineups.map((lineup) => {
      const starters = lineup.startXI || lineup.start_xi || lineup.starting_xi || [];
      const lineupTeam = lineup.team?.name || lineup.team || "Team";
      const lineupLogo = lineup.team?.logo || lineup.logo;
      return `<div class="team-sheet">
        <div class="team-sheet-head">${this._logo(lineupLogo, lineupTeam, "38")}<span><strong>${this._escape(lineupTeam)}</strong><small>${this._escape(lineup.formation || "Formation TBC")}</small></span></div>
        <div class="starting-xi">${starters.map((entry) => {
          const player = entry.player || entry;
          return `<div><span>${this._escape(player.number ?? "–")}</span><strong>${this._escape(player.name || "Player")}</strong><small>${this._escape(player.pos || player.position || "")}</small></div>`;
        }).join("")}</div>
      </div>`;
    }).join("")}</div>`;
  }

  _livePage() {
    const primary = this._attrs("live_match");
    const matches = this._attrs("live_matches").matches || [];
    const leagueTeams = [...new Set((this._attrs("standings").table || [])
      .map((row) => row.team || row.team_name)
      .filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const teamOptions = (selectedTeam = this._selectedLiveTeam) => `
      <div class="live-picker-control">
        <label for="live-team-select">Supported team</label>
        <select id="live-team-select" aria-label="Choose your supported team">
          <option value="">Choose a team</option>
          ${leagueTeams.map((team) => `<option value="${this._escape(team)}" ${team === selectedTeam ? "selected" : ""}>${this._escape(team)}</option>`).join("")}
        </select>
      </div>`;

    if (!primary.is_live) {
      return `
        <section class="page-card live-control-empty">
          <div><span class="live-kicker">⚽ MATCHDAY CONTROL ROOM</span><h2>Live Centre</h2><p>The feed updates automatically when a match begins.</p></div>
          <div class="live-count"><strong>0</strong><span>Live now</span></div>
        </section>
        <section class="live-picker page-card">
          ${teamOptions()}
          <p class="supported-team-note">${this._selectedLiveTeam ? `${this._escape(this._selectedLiveTeam)} will open here automatically when they play live.` : "Choose your team now and their match will open automatically when it goes live."}</p>
        </section>
        <section class="section">
          <h2>Current live feed</h2>
          <div class="match-list">${matches.length ? matches.map((m) => this._matchCard(m, "result")).join("") : ""}</div>
        </section>
      `;
    }

    const liveMatches = matches.length ? matches : [primary];
    const matchId = (match, index = 0) => String(match.fixture_id ?? match.id ?? `${match.home_team}-${match.away_team}-${index}`);
    const availableIds = liveMatches.map((match, index) => matchId(match, index));
    const selectedTeamMatchIndex = liveMatches.findIndex((match) =>
      match.home_team === this._selectedLiveTeam || match.away_team === this._selectedLiveTeam
    );
    if (selectedTeamMatchIndex >= 0) this._selectedLiveMatch = availableIds[selectedTeamMatchIndex];
    if (!availableIds.includes(this._selectedLiveMatch)) this._selectedLiveMatch = availableIds[0] || "";
    const selectedIndex = Math.max(0, availableIds.indexOf(this._selectedLiveMatch));
    const selectedBasic = liveMatches[selectedIndex] || primary;
    const primaryId = matchId(primary);
    const selectedIsPrimary = this._selectedLiveMatch === primaryId ||
      (selectedBasic.home_team === primary.home_team && selectedBasic.away_team === primary.away_team);
    const live = selectedIsPrimary ? { ...selectedBasic, ...primary } : selectedBasic;
    const events = selectedIsPrimary ? (primary.events || []) : (selectedBasic.events || []);
    const stats = selectedIsPrimary ? (primary.statistics || []) : (selectedBasic.statistics || []);
    const lineups = selectedIsPrimary ? (primary.lineups || []) : (selectedBasic.lineups || []);

    return `
      <section class="page-card live-control-hero">
        <div><span class="live-kicker">⚽ MATCHDAY CONTROL ROOM</span><h2>Live Centre <b>LIVE</b></h2><p>Scores, incidents, statistics and team sheets update automatically.</p></div>
        <div class="live-control-stats"><div><strong>${matches.length || 1}</strong><span>Live now</span></div><div><strong>${events.filter((event) => String(event.type || "").toLowerCase().includes("goal")).length}</strong><span>Goals</span></div><div><strong>${events.length}</strong><span>Events</span></div></div>
      </section>
      <section class="live-picker page-card">
        ${teamOptions(this._selectedLiveTeam || live.home_team)}
        <div class="live-score-strip">
          ${liveMatches.map((match, index) => `<div class="${matchId(match, index) === this._selectedLiveMatch ? "active" : ""}"><span>${this._escape(match.status_short || match.elapsed || "LIVE")}</span><strong>${this._escape(match.home_team)} ${this._score(match.home_goals)}–${this._score(match.away_goals)} ${this._escape(match.away_team)}</strong></div>`).join("")}
        </div>
      </section>
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

      <section class="live-detail-grid">
        <article class="page-card"><h2>Match timeline</h2>${this._eventRows(events)}</article>
        <article class="page-card"><h2>Statistics</h2>${this._statRows(stats, live)}</article>
        <article class="page-card lineup-panel"><h2>Starting line-ups</h2>${this._lineupCards(lineups)}</article>
      </section>
    `;
  }

  _fixturesPage() {
    const fixtures = this._attrs("fixtures");
    const today = this._attrs("matches_today").matches || [];
    const allFixtures = fixtures.fixtures || fixtures.next_5 || [];
    const standingsTeams = (this._attrs("standings").table || [])
      .map((row) => row.team || row.team_name)
      .filter(Boolean);
    const fixtureTeams = [...new Set(
      allFixtures.flatMap((match) => [match.home_team, match.away_team]).filter(Boolean)
    )];
    const teams = (fixtureTeams.length > 10 ? fixtureTeams : [...new Set([...fixtureTeams, ...standingsTeams])])
      .sort((a, b) => a.localeCompare(b));
    const normaliseTeam = (name) => String(name || "").trim().toLowerCase();
    const filteredFixtures = this._selectedFixtureTeam === "__all__"
      ? allFixtures
      : this._selectedFixtureTeam
      ? allFixtures.filter((match) =>
          normaliseTeam(match.home_team) === normaliseTeam(this._selectedFixtureTeam) ||
          normaliseTeam(match.away_team) === normaliseTeam(this._selectedFixtureTeam)
        )
      : allFixtures.slice(0, 6);
    const pageSize = 20;
    const totalPages = Math.max(1, Math.ceil(filteredFixtures.length / pageSize));
    const currentPage = Math.min(this._fixturePage, totalPages - 1);
    const visibleFixtures = filteredFixtures.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

    return `
      <section class="page-heading">
        <div><span class="eyebrow">MATCH SCHEDULE</span><h2>Fixtures</h2></div>
        <div class="count-badge">${this._escape(fixtures.total_fixtures || 0)} matches</div>
      </section>
      <div class="fixture-filter">
        <label for="fixture-team-select">Show fixtures for</label>
        <select id="fixture-team-select" aria-label="Choose a team">
          <option value="__all__" ${this._selectedFixtureTeam === "__all__" ? "selected" : ""}>All fixtures (${this._escape(allFixtures.length)})</option>
          <option value="">Next 6 fixtures</option>
          ${teams.map((team) => {
            const gameCount = allFixtures.filter((match) =>
              normaliseTeam(match.home_team) === normaliseTeam(team) ||
              normaliseTeam(match.away_team) === normaliseTeam(team)
            ).length;
            return `<option value="${this._escape(team)}" ${team === this._selectedFixtureTeam ? "selected" : ""}>${this._escape(team)} (${gameCount} games)</option>`;
          }).join("")}
        </select>
      </div>
      ${
        today.length
          ? `<section class="section"><h3>Today</h3><div class="match-list">${today
              .map((m) => this._matchCard(m))
              .join("")}</div></section>`
          : ""
      }
      <section class="section">
        <h3>${this._selectedFixtureTeam === "__all__" ? "All fixtures" : this._selectedFixtureTeam ? `${this._escape(this._selectedFixtureTeam)} fixtures` : "Next fixtures"}</h3>
        <div class="match-list">${visibleFixtures.length ? visibleFixtures.map((m) => this._matchCard(m)).join("") : `<div class="empty">No fixtures available.</div>`}</div>
        ${filteredFixtures.length > pageSize ? `
          <div class="fixture-pagination">
            <button data-fixture-page="${currentPage - 1}" ${currentPage === 0 ? "disabled" : ""}>
              <ha-icon icon="mdi:chevron-left"></ha-icon> Previous
            </button>
            <span>Page ${currentPage + 1} of ${totalPages} · ${filteredFixtures.length} matches</span>
            <button data-fixture-page="${currentPage + 1}" ${currentPage >= totalPages - 1 ? "disabled" : ""}>
              Next <ha-icon icon="mdi:chevron-right"></ha-icon>
            </button>
          </div>
        ` : ""}
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
          <div class="table-row ${(row.team || row.team_name) === this._selectedClub ? "selected-club" : ""}">
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

  _myClubPage() {
    const club = this._selectedClub;
    const fixtures = this._attrs("fixtures").fixtures || [];
    const resultsAttrs = this._attrs("results");
    const results = resultsAttrs.latest_5 || [];
    const table = this._attrs("standings").table || [];
    const scorers = this._attrs("top_scorers").top_scorers || [];
    const assists = this._attrs("top_assists").top_assists || [];
    const dataset = (key) => this._attrs(key).data ?? [];
    const profileRows = dataset("my_club_profile");
    const profileRecord = Array.isArray(profileRows) ? (profileRows[0] || {}) : profileRows;
    const clubProfile = profileRecord.team || {};
    const venue = profileRecord.venue || {};
    const clubStats = dataset("my_club_statistics") || {};
    const squadRows = dataset("my_club_squad");
    const squadRecord = Array.isArray(squadRows) ? (squadRows[0] || {}) : {};
    const squad = squadRecord.players || [];
    const clubPlayerStats = Array.isArray(dataset("my_club_player_statistics"))
      ? dataset("my_club_player_statistics")
      : [];
    const coaches = Array.isArray(dataset("my_club_coach")) ? dataset("my_club_coach") : [];
    const coach = coaches.find((item) => (item.career || []).some((job) =>
      job.team?.name === club && !job.end
    )) || coaches.sort((a, b) => {
      const latest = (item) => Math.max(0, ...(item.career || []).map((job) => Date.parse(job.start || 0) || 0));
      return latest(b) - latest(a);
    })[0] || {};
    const injuries = Array.isArray(dataset("my_club_injuries")) ? dataset("my_club_injuries") : [];
    const transferPlayers = Array.isArray(dataset("my_club_transfers")) ? dataset("my_club_transfers") : [];
    const transfers = transferPlayers.flatMap((record) => record.transfers
      ? record.transfers.map((movement) => ({
          ...movement,
          player: record.player || {},
          date: movement.date || record.update || "",
        }))
      : [record]
    ).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    const predictions = Array.isArray(dataset("my_club_prediction")) ? dataset("my_club_prediction") : [];
    const prediction = predictions[0] || {};
    const headToHead = Array.isArray(dataset("my_club_head_to_head")) ? dataset("my_club_head_to_head") : [];
    const playerTrophies = Array.isArray(dataset("my_club_player_trophies")) ? dataset("my_club_player_trophies") : [];
    const coachTrophies = Array.isArray(dataset("my_club_coach_trophies")) ? dataset("my_club_coach_trophies") : [];
    const sidelined = Array.isArray(dataset("my_club_sidelined")) ? dataset("my_club_sidelined") : [];
    const teams = [...new Set([
      ...table.map((row) => row.team || row.team_name),
      ...fixtures.flatMap((match) => [match.home_team, match.away_team]),
    ].filter(Boolean))].sort((a, b) => a.localeCompare(b));

    if (this._selectedClub && !teams.includes(this._selectedClub)) {
      this._selectedClub = "";
    }

    const clubFixtures = fixtures.filter((match) => match.home_team === club || match.away_team === club);
    const clubResults = results.filter((match) => match.home_team === club || match.away_team === club);
    const standing = table.find((row) => (row.team || row.team_name) === club);
    const clubPlayers = (items) => items.filter((item) =>
      item.statistics?.some((stats) => stats.team?.name === club)
    );
    const playerStatValue = (item, key) => {
      const stats = (item.statistics || []).find((entry) => entry.team?.name === club) || item.statistics?.[0] || {};
      return key === "assists" ? (stats.goals?.assists || 0) : (stats.goals?.total || 0);
    };
    const clubScorers = [...clubPlayerStats].sort((a, b) => playerStatValue(b, "goals") - playerStatValue(a, "goals"));
    const clubAssists = [...clubPlayerStats].sort((a, b) => playerStatValue(b, "assists") - playerStatValue(a, "assists"));

    return `
      <section class="page-heading">
        <div><span class="eyebrow">YOUR TEAM CENTRE</span><h2>My Club</h2></div>
        ${club ? `<div class="count-badge">${this._escape(club)}</div>` : ""}
      </section>
      <section class="page-card live-picker">
        <div class="live-picker-control">
          <label for="my-club-select">Choose your club</label>
          <select id="my-club-select" aria-label="Choose your club">
            <option value="">Select a team</option>
            ${teams.map((team) => `<option value="${this._escape(team)}" ${team === club ? "selected" : ""}>${this._escape(team)}</option>`).join("")}
          </select>
        </div>
      </section>
      ${!club ? `<section class="page-card centred"><ha-icon class="huge-icon" icon="mdi:shield-star-outline"></ha-icon><h2>Choose your club</h2><p>Your fixtures, results, league position and players will appear here.</p></section>` : `
        <section class="two-column">
          <article class="page-card club-profile-card">
            <div class="club-profile-head">${this._logo(clubProfile.logo || standing?.team_logo, club, "86")}<div><span class="eyebrow">CLUB PROFILE</span><h2>${this._escape(clubProfile.name || club)}</h2><p>${this._escape(clubProfile.country || this._statusInfo().country || "")} ${clubProfile.founded ? `· Founded ${this._escape(clubProfile.founded)}` : ""}</p></div></div>
            <div class="settings-list"><div><span>Club code</span><strong>${this._escape(clubProfile.code || "—")}</strong></div><div><span>Founded</span><strong>${this._escape(clubProfile.founded || "—")}</strong></div><div><span>Country</span><strong>${this._escape(clubProfile.country || "—")}</strong></div></div>
          </article>
          <article class="page-card venue-card">
            <span class="eyebrow">HOME GROUND</span><h2>${this._escape(venue.name || "Stadium information")}</h2>
            ${venue.image ? `<img class="venue-image" src="${this._escape(venue.image)}" alt="${this._escape(venue.name || "Stadium")}">` : ""}
            <div class="settings-list"><div><span>City</span><strong>${this._escape(venue.city || "—")}</strong></div><div><span>Capacity</span><strong>${this._escape(venue.capacity || "—")}</strong></div><div><span>Surface</span><strong>${this._escape(venue.surface || "—")}</strong></div></div>
          </article>
        </section>
        <section class="two-column">
          <article class="page-card"><span class="eyebrow">LEAGUE POSITION</span><h2>${standing ? `${this._escape(standing.rank)} · ${this._escape(club)}` : this._escape(club)}</h2>${standing ? `<div class="settings-list"><div><span>Played</span><strong>${this._escape(standing.played ?? standing.all?.played ?? 0)}</strong></div><div><span>Goal difference</span><strong>${this._escape(standing.goals_diff ?? standing.goal_difference ?? 0)}</strong></div><div><span>Points</span><strong>${this._escape(standing.points ?? 0)}</strong></div></div>` : `<div class="empty">League position is not available yet.</div>`}</article>
          <article class="page-card"><span class="eyebrow">NEXT MATCH</span>${clubFixtures.length ? this._matchCard(clubFixtures[0]) : `<div class="empty">No upcoming fixture available.</div>`}</article>
        </section>
        <section class="two-column">
          <article class="page-card"><span class="eyebrow">SEASON RECORD</span><h2>Club statistics</h2><div class="settings-list"><div><span>Played</span><strong>${this._escape(clubStats.fixtures?.played?.total ?? standing?.played ?? 0)}</strong></div><div><span>Wins</span><strong>${this._escape(clubStats.fixtures?.wins?.total ?? 0)}</strong></div><div><span>Draws</span><strong>${this._escape(clubStats.fixtures?.draws?.total ?? 0)}</strong></div><div><span>Defeats</span><strong>${this._escape(clubStats.fixtures?.loses?.total ?? 0)}</strong></div><div><span>Goals scored</span><strong>${this._escape(clubStats.goals?.for?.total?.total ?? 0)}</strong></div><div><span>Clean sheets</span><strong>${this._escape(clubStats.clean_sheet?.total ?? 0)}</strong></div></div></article>
          <article class="page-card"><span class="eyebrow">MANAGER</span><div class="club-profile-head">${this._logo(coach.photo, coach.name, "72")}<div><h2>${this._escape(coach.name || "Manager unavailable")}</h2><p>${this._escape(coach.nationality || "")}</p></div></div><div class="settings-list"><div><span>Age</span><strong>${this._escape(coach.age || "—")}</strong></div><div><span>Career appointments</span><strong>${this._escape(coach.career?.length || 0)}</strong></div><div><span>Recorded trophies</span><strong>${this._escape(coachTrophies.length)}</strong></div></div></article>
        </section>
        <section class="section"><div class="section-title-row"><div><span class="eyebrow">MATCH SCHEDULE</span><h3>Upcoming fixtures</h3></div><span>${clubFixtures.length} matches</span></div><div class="match-list">${clubFixtures.length ? clubFixtures.map((match) => this._matchCard(match)).join("") : `<div class="empty">No fixtures available.</div>`}</div></section>
        <section class="section"><div class="section-title-row"><div><span class="eyebrow">LATEST SCORES</span><h3>Recent results</h3></div></div><div class="match-list">${clubResults.length ? clubResults.map((match) => this._matchCard(match, "result")).join("") : `<div class="empty">No recent results available.</div>`}</div></section>
        <section class="two-column">
          <article class="page-card"><h2>Club top scorers</h2>${this._playerRows(clubScorers.length ? clubScorers : clubPlayers(scorers), "goals")}</article>
          <article class="page-card"><h2>Club top assists</h2>${this._playerRows(clubAssists.length ? clubAssists : clubPlayers(assists), "assists")}</article>
        </section>
        <section class="section"><div class="section-title-row"><div><span class="eyebrow">FIRST TEAM</span><h3>Current squad</h3></div><span>${squad.length} players</span></div><div class="squad-grid">${squad.length ? squad.map((player) => `<article class="page-card squad-player">${this._logo(player.photo, player.name, "54")}<div><strong>${this._escape(player.name || "Player")}</strong><small>${this._escape([player.number ? `#${player.number}` : "", player.position].filter(Boolean).join(" · "))}</small></div></article>`).join("") : `<div class="empty">Squad information is not available yet.</div>`}</div></section>
        <section class="two-column">
          <article class="page-card"><span class="eyebrow">AVAILABILITY</span><h2>Injuries & suspensions</h2><div class="player-list">${injuries.length ? injuries.map((item) => `<div class="player-row">${this._logo(item.player?.photo, item.player?.name, "40")}<span class="player-name"><strong>${this._escape(item.player?.name || "Player")}</strong><small>${this._escape(item.player?.reason || item.type || "Unavailable")}</small></span><strong>${this._escape(item.fixture?.date?.slice?.(0, 10) || "")}</strong></div>`).join("") : `<div class="empty">No current injuries supplied.</div>`}${sidelined.length ? `<p class="notice">${sidelined.length} additional historical sidelined records available.</p>` : ""}</div></article>
          <article class="page-card"><span class="eyebrow">TRANSFER CENTRE</span><h2>Recent transfers</h2><div class="player-list">${transfers.length ? transfers.slice(0, 10).map((item) => `<div class="transfer-row">${this._logo(item.player?.photo, item.player?.name, "40")}<span class="player-name"><strong>${this._escape(item.player?.name || "Player")}</strong><small>${this._escape(`${item.teams?.out?.name || "Unknown"} → ${item.teams?.in?.name || "Unknown"}`)}</small><em>${this._escape(item.type || "Fee undisclosed")}</em></span><time>${this._escape(item.date || "")}</time></div>`).join("") : `<div class="empty">No transfer data available.</div>`}</div></article>
        </section>
        <section class="two-column">
          <article class="page-card"><span class="eyebrow">NEXT MATCH</span><h2>Prediction</h2><div class="settings-list"><div><span>Advice</span><strong>${this._escape(prediction.predictions?.advice || "Not available")}</strong></div><div><span>Home chance</span><strong>${this._escape(prediction.predictions?.percent?.home || "—")}</strong></div><div><span>Draw chance</span><strong>${this._escape(prediction.predictions?.percent?.draw || "—")}</strong></div><div><span>Away chance</span><strong>${this._escape(prediction.predictions?.percent?.away || "—")}</strong></div></div></article>
          <article class="page-card"><span class="eyebrow">CLUB HISTORY</span><h2>Records</h2><div class="settings-list"><div><span>Head-to-head matches</span><strong>${this._escape(headToHead.length)}</strong></div><div><span>Player trophies</span><strong>${this._escape(playerTrophies.length)}</strong></div><div><span>Manager trophies</span><strong>${this._escape(coachTrophies.length)}</strong></div></div></article>
        </section>
      `}
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
      case "my-club":
        return this._myClubPage();
      case "supporters":
        return this._supportersPage();
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

    this.shadowRoot.querySelector("#fixture-team-select")?.addEventListener("change", (event) => {
      this._setFixtureTeam(event.target.value);
    });

    this.shadowRoot.querySelectorAll("[data-fixture-page]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!button.disabled) this._setFixturePage(Number(button.dataset.fixturePage));
      });
    });

    this.shadowRoot.querySelector("#live-team-select")?.addEventListener("change", (event) => {
      this._setLiveTeam(event.target.value);
    });

    this.shadowRoot.querySelector("#my-club-select")?.addEventListener("change", (event) => {
      this._setMyClub(event.target.value);
    });

    this.shadowRoot.querySelector("#competition-select")?.addEventListener("change", (event) => {
      this._setCompetition(event.target.value);
    });

    this.shadowRoot.querySelector("#country-select")?.addEventListener("change", (event) => {
      this._setCountry(event.target.value);
    });

    this.shadowRoot.querySelector("#league-select")?.addEventListener("change", (event) => {
      this._setLeague(event.target.value);
    });
  }

  _styles() {
    return `
      :host {
        display: block;
        height: 100vh;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-width: thin;
        scrollbar-color: #31e981 rgba(2, 12, 23, .82);
        color: #ffffff;
        --primary-text-color: #ffffff;
        --secondary-text-color: rgba(226, 240, 255, .78);
        --fh-purple: #071a14;
        --fh-purple-2: #0b4d36;
        --fh-cyan: #31e981;
        --fh-pink: #ff4d4d;
        --fh-surface: rgba(255,255,255,0.08);
        --fh-surface-strong: rgba(255,255,255,0.10);
        --fh-border: rgba(255,255,255,0.14);
        font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif);
      }
      .club-profile-head { display:flex; align-items:center; gap:18px; margin-bottom:18px; }
      .club-profile-head h2 { margin:4px 0; }
      .club-profile-head p { margin:0; color:var(--muted); }
      .venue-image { width:100%; height:170px; object-fit:cover; border-radius:14px; margin:12px 0 16px; border:1px solid var(--line); }
      .squad-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:12px; }
      .squad-player { display:flex; align-items:center; gap:12px; padding:14px; }
      .squad-player div { display:flex; flex-direction:column; gap:4px; }
      .squad-player small { color:var(--muted); }
      .transfer-row { display:grid; grid-template-columns:44px minmax(0,1fr) auto; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid var(--line); }
      .transfer-row:last-child { border-bottom:0; }
      .transfer-row .player-name { min-width:0; display:flex; flex-direction:column; gap:4px; }
      .transfer-row .player-name strong, .transfer-row .player-name small { overflow-wrap:anywhere; }
      .transfer-row .player-name small { color:var(--muted); }
      .transfer-row .player-name em { color:var(--accent); font-size:12px; font-style:normal; font-weight:800; }
      .transfer-row time { white-space:nowrap; font-weight:800; color:var(--text); }
      .table-row.selected-club { border:2px solid var(--accent); border-radius:12px; background:rgba(42, 245, 152, .12); box-shadow:0 0 0 1px rgba(42, 245, 152, .18), 0 0 20px rgba(42, 245, 152, .10); }

      * { box-sizing: border-box; }

      :host::-webkit-scrollbar {
        width: 13px;
      }

      :host::-webkit-scrollbar-track {
        background: rgba(2, 12, 23, .88);
        border-left: 1px solid rgba(255,255,255,.08);
      }

      :host::-webkit-scrollbar-thumb {
        min-height: 54px;
        border: 3px solid rgba(2, 12, 23, .88);
        border-radius: 999px;
        background: linear-gradient(180deg, #46f596, #13bd68);
        box-shadow: 0 0 12px rgba(49,233,129,.28);
      }

      :host::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(180deg, #72ffb3, #25df7d);
      }

      h1, h2, h3, strong, .big-stat, .match-score, .score-board {
        color: #ffffff;
      }

      h1, h2, h3, .big-stat, .match-score, .score-board strong {
        text-shadow: 0 2px 12px rgba(0,0,0,.55);
      }

      button, select { font: inherit; }

      .app-shell {
        min-height: 100vh;
        background:
          linear-gradient(180deg, rgba(2, 10, 20, .18) 0%, rgba(2, 10, 20, .38) 42%, rgba(2, 10, 20, .56) 100%),
          url("/football_hub/football-hub-background.png?v=0.2.3") center top / cover fixed no-repeat,
          #020b14;
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
          linear-gradient(105deg, rgba(2, 11, 22, .36), rgba(2, 11, 22, .7)),
          transparent;
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

      .competition-picker {
        display: flex;
        align-items: end;
        gap: 9px;
        padding: 7px;
        border: 1px solid rgba(255,255,255,.15);
        border-radius: 15px;
        background: rgba(0,0,0,.2);
      }

      .competition-picker label {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .competition-picker label > span {
        padding-left: 4px;
        color: rgba(235,245,255,.68);
        font-size: .58rem;
        font-weight: 900;
        letter-spacing: .1em;
        text-transform: uppercase;
      }

      .competition-picker select {
        min-width: 150px;
        max-width: 220px;
        padding-block: 8px;
        color-scheme: dark;
      }

      select {
        border: 1px solid rgba(255,255,255,.18);
        color: white;
        background: rgba(0,0,0,.22);
        border-radius: 12px;
        padding: 10px 34px 10px 12px;
      }

      select option {
        color: #f4f9ff;
        background: #0b1724;
      }

      select option:checked {
        color: #04130c;
        background: #31e981;
        font-weight: 900;
      }

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
        color: rgba(235,245,255,.82);
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
        background: rgba(255,255,255,0.08) !important;
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 22px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.20);
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
        color: rgba(226, 240, 255, .86);
        text-shadow: 0 1px 5px rgba(0,0,0,.65);
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
        color: #42f58d;
        cursor: pointer;
        font-weight: 800;
        text-shadow: 0 1px 6px rgba(0,0,0,.7);
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

      .fixture-filter {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        padding: 7px 8px 7px 14px;
        margin: 0 0 24px;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 14px;
        background: rgba(1,10,20,.34);
      }

      .fixture-filter label {
        color: rgba(235,245,255,.78);
        font-size: .78rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: .06em;
      }

      .fixture-filter select {
        min-width: 220px;
        border-color: rgba(255,255,255,.16);
        background: rgba(2,15,27,.82);
        color: #fff;
        font-weight: 800;
        color-scheme: dark;
        scrollbar-width: thin;
        scrollbar-color: #31e981 #0b1724;
      }

      .fixture-filter select::-webkit-scrollbar {
        width: 12px;
      }

      .fixture-filter select::-webkit-scrollbar-track {
        background: #0b1724;
      }

      .fixture-filter select::-webkit-scrollbar-thumb {
        border: 3px solid #0b1724;
        border-radius: 999px;
        background: #31e981;
      }

      .fixture-filter select::-webkit-scrollbar-thumb:hover {
        background: #72ffb3;
      }

      .fixture-pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
        padding: 14px;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 16px;
        background: rgba(1,10,20,.38);
      }

      .fixture-pagination button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 10px;
        padding: 9px 13px;
        color: #fff;
        background: rgba(255,255,255,.1);
        cursor: pointer;
        font-weight: 800;
      }

      .fixture-pagination button:disabled {
        opacity: .35;
        cursor: default;
      }

      .fixture-pagination span {
        color: rgba(235,245,255,.8);
        font-size: .82rem;
        font-weight: 700;
      }

      .match-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 15px;
      }

      .match-card {
        background: rgba(255,255,255,0.08) !important;
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 22px;
        padding: 17px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.20);
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

      .live-picker { margin-bottom: 18px; }
      .live-picker-control { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
      .live-picker-control label { color: #86efac; font-size: .76rem; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
      .live-picker-control select { min-width: min(460px, 70vw); color-scheme: dark; background: rgba(2,15,27,.9); color: #fff; }
      .supported-team-note { margin: 4px 0 0; color: var(--secondary-text-color); }
      .live-score-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 9px; }
      .live-score-strip > div { display: flex; flex-direction: column; align-items: flex-start; gap: 5px; border: 1px solid rgba(255,255,255,.14); border-radius: 12px; padding: 11px; color: #fff; background: rgba(255,255,255,.06); text-align: left; }
      .live-score-strip > div span { color: #86efac; font-size: .68rem; font-weight: 900; }
      .live-score-strip > div strong { font-size: .82rem; }
      .live-score-strip > div.active { border-color: rgba(74,222,128,.72); background: rgba(34,197,94,.16); box-shadow: 0 0 14px rgba(34,197,94,.2); }

      .live-control-hero, .live-control-empty {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 22px;
        margin-bottom: 18px;
        background:
          radial-gradient(circle at 12% 0%, rgba(34,197,94,.28), transparent 35%),
          radial-gradient(circle at 88% 8%, rgba(16,185,129,.22), transparent 32%),
          linear-gradient(135deg, rgba(6,24,20,.9), rgba(6,11,25,.82)) !important;
        border-color: rgba(74,222,128,.34);
        box-shadow: 0 0 22px rgba(34,197,94,.18), inset 0 0 0 1px rgba(255,255,255,.035);
      }

      .live-control-hero h2, .live-control-empty h2 { margin: 5px 0; }
      .live-control-hero p, .live-control-empty p { margin: 5px 0 0; color: var(--secondary-text-color); }

      .live-kicker {
        color: #86efac;
        font-size: .76rem;
        font-weight: 1000;
        letter-spacing: .14em;
      }

      .live-control-hero h2 b {
        display: inline-block;
        margin-left: 8px;
        padding: 6px 10px;
        border: 1px solid rgba(134,239,172,.78);
        border-radius: 999px;
        color: #ecfdf5;
        background: linear-gradient(135deg, rgba(34,197,94,.92), rgba(16,185,129,.62));
        box-shadow: 0 0 12px rgba(34,197,94,.58), 0 0 26px rgba(34,197,94,.24);
        font-size: .7rem;
        vertical-align: middle;
        animation: wcLivePulse 1.6s ease-in-out infinite;
      }

      @keyframes wcLivePulse {
        0%, 100% { transform: scale(1); box-shadow: 0 0 12px rgba(34,197,94,.48), 0 0 24px rgba(34,197,94,.2); }
        50% { transform: scale(1.04); box-shadow: 0 0 18px rgba(34,197,94,.72), 0 0 34px rgba(34,197,94,.32); }
      }

      .live-control-stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(74px, 1fr));
        gap: 9px;
      }

      .live-control-stats > div, .live-count {
        min-width: 80px;
        padding: 12px;
        border: 1px solid rgba(134,239,172,.2);
        border-radius: 14px;
        background: rgba(255,255,255,.06);
        text-align: center;
      }

      .live-control-stats strong, .live-count strong { display: block; color: #86efac; font-size: 1.7rem; }
      .live-control-stats span, .live-count span { color: var(--secondary-text-color); font-size: .68rem; text-transform: uppercase; }

      .live-detail-grid {
        display: grid;
        grid-template-columns: .8fr 1.2fr;
        gap: 18px;
        margin-top: 18px;
      }

      .lineup-panel { grid-column: 1 / -1; }

      .event-timeline { display: flex; flex-direction: column; }
      .event-row { display: grid; grid-template-columns: 42px 30px 1fr; align-items: center; gap: 9px; padding: 12px 0; border-top: 1px solid var(--fh-border); }
      .event-row:first-child { border-top: 0; }
      .event-minute { color: #86efac; font-weight: 900; }
      .event-icon { font-size: 1.05rem; text-align: center; }
      .event-copy { display: flex; flex-direction: column; }
      .event-copy small { color: var(--secondary-text-color); }

      .stats-team-head, .stat-comparison { display: grid; grid-template-columns: 1fr 1.3fr 1fr; align-items: center; gap: 10px; text-align: center; }
      .stats-team-head { padding-bottom: 12px; color: var(--secondary-text-color); }
      .stat-comparison { min-height: 46px; border-top: 1px solid var(--fh-border); }
      .stat-comparison strong:first-child { text-align: left; }
      .stat-comparison strong:last-child { text-align: right; }
      .stat-comparison span { color: var(--secondary-text-color); font-size: .78rem; }

      .lineup-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; }
      .team-sheet { border: 1px solid var(--fh-border); border-radius: 16px; padding: 15px; background: rgba(255,255,255,.045); }
      .team-sheet-head { display: flex; align-items: center; gap: 11px; margin-bottom: 10px; }
      .team-sheet-head span { display: flex; flex-direction: column; }
      .team-sheet-head small { color: #86efac; }
      .starting-xi > div { display: grid; grid-template-columns: 30px 1fr 35px; gap: 8px; align-items: center; min-height: 38px; border-top: 1px solid var(--fh-border); }
      .starting-xi > div > span { color: #86efac; font-weight: 900; }
      .starting-xi > div > small { color: var(--secondary-text-color); text-align: right; }

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
        color: rgba(235, 245, 255, .84);
        padding: 18px 0;
        text-shadow: 0 1px 5px rgba(0,0,0,.7);
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

      .support-hero {display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:28px;margin-bottom:18px;background:radial-gradient(circle at 10% 0%,rgba(49,233,129,.24),transparent 34%),radial-gradient(circle at 95% 10%,rgba(255,215,0,.18),transparent 32%),linear-gradient(135deg,rgba(5,30,22,.92),rgba(4,12,24,.84)) !important;border-color:rgba(49,233,129,.34)}
      .support-hero h2{margin:7px 0 10px;font-size:clamp(2rem,4vw,3.4rem);letter-spacing:-.04em}.support-hero p,.premium-info p{max-width:760px;color:var(--secondary-text-color);line-height:1.65}.support-kicker{color:#86efac;font-size:.75rem;font-weight:1000;letter-spacing:.14em}.support-actions{display:flex;flex-wrap:wrap;gap:11px;margin-top:20px}.support-button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:11px 16px;border:1px solid rgba(255,255,255,.2);border-radius:12px;color:#fff;background:rgba(255,255,255,.08);text-decoration:none;font-weight:900}.support-button.primary{color:#04130c;border-color:#31e981;background:linear-gradient(135deg,#52f59c,#24cf76);box-shadow:0 0 20px rgba(49,233,129,.22)}
      .support-thanks{width:190px;min-height:190px;display:grid;place-items:center;align-content:center;text-align:center;border:1px solid rgba(255,215,0,.4);border-radius:50%;background:radial-gradient(circle,rgba(255,215,0,.18),rgba(255,255,255,.045) 60%,transparent 62%);box-shadow:0 0 40px rgba(255,215,0,.12)}.support-thanks strong{color:#ffe27a;font-size:1.45rem}.support-thanks span{width:120px;margin-top:5px;color:var(--secondary-text-color);font-size:.72rem}
      .support-benefits{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:18px}.support-benefits article{display:flex;flex-direction:column;gap:9px}.support-benefits ha-icon{--mdc-icon-size:31px;color:var(--fh-cyan)}.support-benefits span{color:var(--secondary-text-color);font-size:.82rem;line-height:1.45}.premium-info{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:24px;border-color:rgba(255,215,0,.34);background:linear-gradient(135deg,rgba(255,215,0,.11),rgba(255,255,255,.06)) !important}.premium-info h2{margin:6px 0}.premium-features{display:grid;gap:9px;min-width:250px}.premium-features span{padding:10px 12px;border:1px solid rgba(255,215,0,.24);border-radius:11px;background:rgba(0,0,0,.14);font-weight:800}
      .support-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:18px}.support-summary>div{padding:18px;border:1px solid var(--fh-border);border-radius:16px;background:rgba(255,255,255,.045);text-align:center}.support-summary strong{display:block;color:#86efac;font-size:clamp(1.45rem,3vw,2.35rem)}.support-summary span{color:var(--secondary-text-color);font-size:.72rem;text-transform:uppercase;letter-spacing:.07em}.country-support{margin-bottom:24px}.country-support-grid{display:flex;flex-wrap:wrap;gap:9px}.country-support-grid span{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid var(--fh-border);border-radius:999px;background:rgba(255,255,255,.05);color:var(--secondary-text-color);font-size:.8rem}.country-support-grid b{color:#fff}.supporter-flag-image{display:inline-block;width:24px;height:16px;flex:0 0 24px;object-fit:cover;border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,.18)}.supporter-avatar-flag{display:block;width:46px;height:28px;object-fit:cover;border-radius:4px}.supporter-country{display:inline-flex;align-items:center}
      .section-title-row{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:14px}.section-title-row h3{margin:3px 0 0}.section-title-row>span{color:var(--secondary-text-color);font-size:.8rem}.supporter-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.latest-grid{grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}.supporter-card{display:grid;grid-template-columns:48px minmax(0,1fr);gap:12px;min-height:112px;padding:16px;border:1px solid rgba(255,255,255,.14);border-radius:17px;background:rgba(255,255,255,.075);box-shadow:0 16px 36px rgba(0,0,0,.16)}.supporter-avatar{width:48px;height:48px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.15);border-radius:50%;background:rgba(0,0,0,.18);font-size:1.45rem}.supporter-copy{min-width:0}.supporter-copy>strong{display:block;overflow-wrap:anywhere;font-size:.98rem}.supporter-meta{display:flex;flex-wrap:wrap;gap:6px 11px;margin-top:5px;color:var(--secondary-text-color);font-size:.72rem}.supporter-copy p{margin:10px 0 0;color:rgba(235,245,255,.86);font-size:.78rem;line-height:1.45}.support-how{display:flex;align-items:center;justify-content:center;gap:10px 18px;margin-top:20px;text-align:center}.support-how span{color:var(--secondary-text-color)}
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
        .support-benefits { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .supporter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .live-detail-grid { grid-template-columns: 1fr; }
        .lineup-panel { grid-column: auto; }
      }

      @media (max-width: 700px) {
        .hero {
          min-height: 160px;
          padding: 26px 18px 22px;
          align-items: flex-start;
          flex-direction: column;
        }

        .hero-actions { justify-content: flex-start; }
        .competition-picker { width: 100%; align-items: stretch; flex-direction: column; }
        .competition-picker select { width: 100%; max-width: none; }

        .tabs button { padding-inline: 13px; }
        .tabs button span { display: none; }

        main { padding: 14px; }

        .fixture-filter {
          display: flex;
          align-items: stretch;
          flex-direction: column;
        }

        .fixture-filter select { min-width: 0; width: 100%; }

        .fixture-pagination { gap: 8px; }
        .fixture-pagination span { font-size: .7rem; text-align: center; }
        .fixture-pagination button { padding: 8px; font-size: .75rem; }

        .stat-card { grid-column: span 12; }
        .feature-match { grid-template-columns: 1fr 95px 1fr; gap: 8px; }
        .feature-team strong { font-size: .85rem; }
        .feature-centre strong { font-size: .78rem; }
        .feature-centre small { display: none; }

        .match-list { grid-template-columns: 1fr; }
        .two-column { grid-template-columns: 1fr; }
        .support-hero { grid-template-columns: 1fr; }
        .support-thanks { width:150px;min-height:150px;margin:0 auto; }
        .support-benefits, .supporter-grid, .support-summary { grid-template-columns: 1fr; }
        .premium-info { align-items:stretch;flex-direction:column; }
        .premium-features { min-width:0; }
        .support-how { align-items:flex-start;flex-direction:column;text-align:left; }

        .live-matchup { grid-template-columns: 1fr 90px 1fr; gap: 8px; }
        .live-team h2 { font-size: .9rem; }
        .score-board strong { font-size: 2.65rem; }

        .live-control-hero, .live-control-empty { align-items: stretch; flex-direction: column; }
        .live-control-stats { width: 100%; }
        .lineup-grid { grid-template-columns: 1fr; }
        .live-picker-control { align-items: stretch; flex-direction: column; }
        .live-picker-control select { min-width: 0; width: 100%; }

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
