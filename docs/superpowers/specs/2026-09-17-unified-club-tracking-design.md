# Unified Club Tracking Design

## Goal

Allow one saved club to follow its domestic league and relevant cup competitions without using a separate favourite-club slot for every competition.

## Current behaviour

Football Hub stores favourites as `{team, competition, league_id, country}`. The same club in the Premier League, FA Cup and UEFA Champions League therefore occupies three of the five favourite slots. The active My Club data is also fetched only from the selected competition.

## Design

Keep a single favourite record for each club name. The record retains its original domestic competition as `home_competition`, and stores the competitions in which the club should be followed in `competitions`.

```json
{
  "team": "Arsenal",
  "home_competition": "premier_league",
  "competitions": ["premier_league", "fa_cup", "efl_cup", "champions_league"],
  "country": "England"
}
```

When a user selects a club in another competition, Football Hub finds the existing record by normalised club name and adds that competition to `competitions`. It does not consume a new favourite slot. Selecting a brand-new club still consumes one slot, with the existing limit of five unique clubs.

On startup, Football Hub migrates legacy competition-specific favourite records into one record per normalised club name. It preserves all existing competition keys, chooses the first domestic league as `home_competition` where present, and keeps the original display name and country.

## Data flow

The active My Club selection resolves to the unified favourite record. The coordinator fetches fixtures and results for every saved competition in that record, filters those matches to the selected club, de-duplicates them by fixture ID, and publishes one sorted club fixture/result feed. Every match retains its source competition name and key so the UI can display its competition badge.

Club profile, squad, injuries, transfers and statistics use the home competition and the club team ID from that competition. Cup competitions contribute fixtures and results only; this avoids extra low-priority API requests and keeps profile data stable.

## UI

The My Club page continues to use one selector entry per saved club. Its fixture and result cards show the competition for every match. Selecting the same club while another competition is active adds that competition to the existing club record. Removing a club removes its single unified record and all linked competitions.

## Error handling

Unavailable cup feeds leave other competition data visible. A failed competition request is skipped for that refresh and does not delete cached club matches. Existing users whose legacy data has no recognised competition retain their original record unchanged.

## Tests

Add coordinator tests for legacy migration, de-duplicated additions and the five-unique-club limit. Add frontend tests confirming that a unified favourite appears once and that competition labels are rendered for cup fixtures.
