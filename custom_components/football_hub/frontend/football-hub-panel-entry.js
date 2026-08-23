import "/football_hub/football-hub-panel.js?v=0.20.22-acca-score-refresh";

const FootballHubPanel = customElements.get("football-hub-panel");

if (FootballHubPanel && !FootballHubPanel.prototype.__lmsLiveSharePatched) {
  const fixtureKey = (panel, fixture, index = 0) => String(
    fixture?.fixture_id ??
    fixture?.id ??
    `${fixture?.home_team || ""}-${fixture?.away_team || ""}-${panel._lmsFixtureTimestamp(fixture) || index}`
  );

  const statusCode = (fixture) => String(
    fixture?.status_short ?? fixture?.status?.short ?? fixture?.status ?? ""
  ).trim().toUpperCase();

  const isPreMatch = (panel, fixture) => {
    const status = statusCode(fixture);
    if (["NS", "TBD", "SCHEDULED", "NOT STARTED"].includes(status)) return true;
    if (["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "FT", "AET", "PEN", "AWD", "WO"].includes(status)) return false;
    const kickoff = Number(panel._lmsFixtureTimestamp(fixture) || 0);
    return kickoff > Math.floor(Date.now() / 1000);
  };

  const isFinished = (fixture) => ["FT", "AET", "PEN", "AWD", "WO"].includes(statusCode(fixture));

  const matchEvents = (fixture) => {
    const candidates = [fixture?.events, fixture?.timeline, fixture?.incidents, fixture?.match_events];
    for (const value of candidates) {
      if (Array.isArray(value)) return value;
    }
    return [];
  };

  const normaliseFixtureForShare = (panel, fixture) => {
    const result = { ...fixture };
    if (isPreMatch(panel, result)) {
      result.home_goals = null;
      result.away_goals = null;
      if (result.goals && typeof result.goals === "object" && !Array.isArray(result.goals)) {
        result.goals = { ...result.goals, home: null, away: null };
      }
    }

    const events = matchEvents(result);
    if (events.length) result.events = events;

    result.status_short = statusCode(result) || result.status_short || "";
    result.elapsed = result.elapsed ?? result.status?.elapsed ?? null;
    return result;
  };

  const eventSignature = (fixture) => {
    const events = matchEvents(fixture);
    return events.map((event) => [
      event?.time?.elapsed ?? event?.elapsed ?? event?.minute ?? null,
      event?.time?.extra ?? event?.extra ?? null,
      event?.type ?? event?.event_type ?? "",
      event?.detail ?? event?.event_detail ?? "",
      event?.player?.name ?? event?.player ?? event?.scorer ?? "",
      event?.team?.name ?? event?.team ?? "",
    ]);
  };

  const fixtureSignature = (panel, fixtures = []) => JSON.stringify(
    fixtures.map((fixture, index) => [
      fixtureKey(panel, fixture, index),
      isPreMatch(panel, fixture) ? null : (fixture?.home_goals ?? fixture?.goals?.home ?? null),
      isPreMatch(panel, fixture) ? null : (fixture?.away_goals ?? fixture?.goals?.away ?? null),
      statusCode(fixture),
      fixture?.elapsed ?? fixture?.status?.elapsed ?? null,
      eventSignature(fixture),
    ])
  );

  const originalSharePayload = FootballHubPanel.prototype._lmsSharePayload;
  FootballHubPanel.prototype._lmsSharePayload = function () {
    const payload = originalSharePayload.call(this);
    if (!payload?.roundFixtures) return payload;

    payload.roundFixtures = payload.roundFixtures.map((group) => ({
      ...group,
      fixtures: (group.fixtures || []).map((fixture) => normaliseFixtureForShare(this, fixture)),
    }));
    return payload;
  };

  FootballHubPanel.prototype._captureLmsLeagueData = function () {
    const competition = this._lmsCompetition;
    const status = this._statusInfo();
    if (!competition?.leagues?.some((league) => league.key === status.competition_key)) return;

    const teams = this._lmsTeams();
    if (!teams.length) return;

    const leagueTeams = new Set(teams);
    const belongsToLeague = (fixture) =>
      leagueTeams.has(fixture?.home_team) || leagueTeams.has(fixture?.away_team);

    // Live Home Assistant data is authoritative for an active/just-finished match.
    // Put the scheduled fixtures in first and overlay results, then live matches,
    // so the freshest score/status wins when the same fixture appears in each sensor.
    const sourceGroups = [
      this._attrs("fixtures").fixtures || [],
      (this._attrs("results").latest_5 || []).filter(belongsToLeague),
      (this._attrs("live_matches").matches || []).filter(belongsToLeague),
    ];

    const merged = new Map();
    let sourceIndex = 0;
    for (const sourceFixtures of sourceGroups) {
      sourceFixtures.forEach((fixture) => {
        const key = fixtureKey(this, fixture, sourceIndex++);
        const previous = merged.get(key);
        merged.set(key, previous ? { ...previous, ...fixture } : fixture);
      });
    }

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

    if (competition.shareId && previousSignature !== nextSignature) {
      this._queueLmsShareSync();
    }
  };

  // Public player links can change picks while the organiser is viewing another
  // Football Hub tab. The 0.6.24 implementation only pulled those changes when
  // the LMS tab itself was open, which left automatic settlement using stale picks.
  const originalPullLmsSharePicks = FootballHubPanel.prototype._pullLmsSharePicks;
  FootballHubPanel.prototype._pullLmsSharePicks = async function (force = false) {
    const previousTab = this._activeTab;
    try {
      this._activeTab = "last-man-standing";
      return await originalPullLmsSharePicks.call(this, force);
    } finally {
      this._activeTab = previousTab;
    }
  };

  const settlementState = (panel, competition, fixtures) => {
    const roundKey = String(competition.round);
    const roundStarted = Number(competition.roundStarted || 0);
    const activePlayers = (competition.players || []).filter((player) => player.alive);
    const pickedTeams = new Set(activePlayers.map((player) => player.picks?.[roundKey]).filter(Boolean));

    const matchingFinishedFixture = (team) => fixtures.find((fixture) =>
      (fixture.home_team === team || fixture.away_team === team) &&
      panel._lmsFixtureTimestamp(fixture) >= roundStarted - 86400 &&
      isFinished(fixture)
    );

    const everyPickedTeamFinished = pickedTeams.size > 0 && [...pickedTeams].every((team) => Boolean(matchingFinishedFixture(team)));
    const hasFinishedUnresolvedPlayer = activePlayers.some((player) => {
      if (player.results?.[roundKey]) return false;
      const pick = player.picks?.[roundKey];
      return Boolean(pick && matchingFinishedFixture(pick));
    });
    const hasLockedNoPick = activePlayers.some((player) => !player.picks?.[roundKey] && !player.results?.[roundKey]);

    return { everyPickedTeamFinished, hasFinishedUnresolvedPlayer, hasLockedNoPick };
  };

  // Settlement now uses the current HA live/results sensors first. The separate
  // LMS football-data endpoint is only a fallback if HA has not yet supplied the
  // finished state for a picked match.
  FootballHubPanel.prototype._maybeAutoSettleLmsRound = async function () {
    const competition = this._lmsCompetition;
    if (!competition || competition.completed || this._lmsAutoCheckBusy || !this._lmsDeadlineState().locked) return;

    this._lmsAutoCheckBusy = true;
    try {
      await this._pullLmsSharePicks(true);

      // Refresh the LMS cache immediately from the live Home Assistant entities.
      this._captureLmsLeagueData();
      let fixtures = this._lmsRoundFixtureGroups().flatMap((league) => league.roundFixtures || []);
      let state = settlementState(this, competition, fixtures);

      // If HA has not yet exposed the FT result, try the server feed as fallback.
      if (!state.everyPickedTeamFinished && !state.hasFinishedUnresolvedPlayer) {
        await this._refreshLmsRoundFixtures();
        fixtures = this._lmsRoundFixtureGroups().flatMap((league) => league.roundFixtures || []);
        state = settlementState(this, competition, fixtures);
      }

      if (state.hasFinishedUnresolvedPlayer || state.hasLockedNoPick || state.everyPickedTeamFinished) {
        await this._settleLmsRound(true);
      }
    } finally {
      this._lmsAutoCheckBusy = false;
    }
  };

  // 0.6.24 advanced the round but based the next round start on the final fixture
  // in the whole matchweek. Use only fixtures involving a picked team so an
  // unpicked Sunday/Monday match cannot hold the LMS on the previous round.
  const originalSettleLmsRound = FootballHubPanel.prototype._settleLmsRound;
  FootballHubPanel.prototype._settleLmsRound = async function (automatic = false) {
    const competition = this._lmsCompetition;
    const previousRound = Number(competition?.round || 0);
    const roundKey = String(previousRound);
    const pickedTeams = new Set(
      (competition?.players || []).map((player) => player.picks?.[roundKey]).filter(Boolean)
    );
    const roundStarted = Number(competition?.roundStarted || 0);
    const pickedFixtures = this._lmsRoundFixtureGroups()
      .flatMap((league) => league.roundFixtures || [])
      .filter((fixture) =>
        (pickedTeams.has(fixture.home_team) || pickedTeams.has(fixture.away_team)) &&
        this._lmsFixtureTimestamp(fixture) >= roundStarted - 86400
      );

    const result = await originalSettleLmsRound.call(this, automatic);

    if (competition && Number(competition.round || 0) > previousRound) {
      const pickedTimes = pickedFixtures
        .filter(isFinished)
        .map((fixture) => Number(this._lmsFixtureTimestamp(fixture) || 0))
        .filter(Boolean);
      const now = Math.floor(Date.now() / 1000);
      const nextStart = pickedTimes.length ? Math.min(now, Math.max(...pickedTimes) + 300) : now;
      if (Number(competition.roundStarted || 0) !== nextStart) {
        competition.roundStarted = nextStart;
        this._ensureLmsDeadline();
        this._saveLms();
        if (competition.shareId) this._queueLmsShareSync();
      }
    }

    return result;
  };

  FootballHubPanel.prototype.__lmsLiveSharePatched = true;
}
