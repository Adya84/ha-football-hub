import "/football_hub/football-hub-panel.js?v=0.20.0-acca-league";

const FootballHubPanel = customElements.get("football-hub-panel");

if (FootballHubPanel && !FootballHubPanel.prototype.__lmsLiveSharePatched) {
  const fixtureKey = (panel, fixture, index = 0) => String(
    fixture?.fixture_id ??
    fixture?.id ??
    `${fixture?.home_team || ""}-${fixture?.away_team || ""}-${panel._lmsFixtureTimestamp(fixture) || index}`
  );

  const fixtureSignature = (panel, fixtures = []) => JSON.stringify(
    fixtures.map((fixture, index) => [
      fixtureKey(panel, fixture, index),
      fixture?.home_goals ?? null,
      fixture?.away_goals ?? null,
      String(fixture?.status_short ?? fixture?.status ?? ""),
      fixture?.elapsed ?? null,
    ])
  );

  FootballHubPanel.prototype._captureLmsLeagueData = function () {
    const competition = this._lmsCompetition;
    const status = this._statusInfo();
    if (!competition?.leagues?.some((league) => league.key === status.competition_key)) return;

    const teams = this._lmsTeams();
    if (!teams.length) return;

    const leagueTeams = new Set(teams);
    const belongsToLeague = (fixture) =>
      leagueTeams.has(fixture?.home_team) || leagueTeams.has(fixture?.away_team);

    const sourceFixtures = [
      ...(this._attrs("fixtures").fixtures || []),
      ...(this._attrs("results").latest_5 || []).filter(belongsToLeague),
      ...(this._attrs("live_matches").matches || []).filter(belongsToLeague),
    ];

    const merged = new Map();
    sourceFixtures.forEach((fixture, index) => {
      const key = fixtureKey(this, fixture, index);
      const previous = merged.get(key);
      merged.set(key, previous ? { ...previous, ...fixture } : fixture);
    });

    const fixtures = [...merged.values()].sort(
      (left, right) => this._lmsFixtureTimestamp(left) - this._lmsFixtureTimestamp(right)
    );

    const previousFixtures = this._lmsLeagueCache?.[status.competition_key]?.fixtures || [];
    const previousSignature = fixtureSignature(this, previousFixtures);
    const nextSignature = fixtureSignature(this, fixtures);

    this._lmsLeagueCache[status.competition_key] = {
      teams,
      fixtures,
      updated: Date.now(),
    };
    localStorage.setItem("football_hub_lms_league_cache", JSON.stringify(this._lmsLeagueCache));

    this._ensureLmsDeadline();
    queueMicrotask(() => this._maybeAutoSettleLmsRound());

    // Push score/status/minute changes into the existing public competition.
    // This updates the same shareId; it never creates or replaces the public URL.
    if (competition.shareId && previousSignature !== nextSignature) {
      this._queueLmsShareSync();
    }
  };

  FootballHubPanel.prototype.__lmsLiveSharePatched = true;
}
