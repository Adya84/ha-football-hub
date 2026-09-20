# Nuvio Watch Links design

## Goal

Add an optional **Watch in Nuvio** button to a Football Hub live fixture when the user's configured Nuvio add-on exposes a matching event. Football Hub must not embed, proxy, scrape, store, or resolve media streams.

## Scope

- Disabled by default.
- The user supplies a configured Nuvio/Stremio-compatible add-on manifest URL.
- The Home Assistant backend reads public add-on metadata only and caches a short-lived event index.
- Match on normalised home team, away team and a kick-off-time tolerance; competition is used as an additional confidence check when supplied.
- The frontend displays a link only for one unambiguous match.
- No match, ambiguous match, inaccessible manifest/catalogue, invalid URL, or failed request means no Watch button and no Live Centre error.

## Data flow

1. The options UI stores the opt-in manifest URL with existing Football Hub preferences.
2. The coordinator validates HTTPS, retrieves the manifest and supported catalogue metadata, then fetches only the catalogue data needed to build event candidates.
3. The coordinator adds a `nuvio_watch_url` only to an exact live-fixture match. It never adds stream URLs to Home Assistant state.
4. The Live Centre renders **Watch in Nuvio** as an external, safe new-tab link on that fixture.

## Safety and privacy

- Only HTTPS manifest URLs are accepted.
- No credentials, Nuvio account data, media URL or stream payload is requested, persisted or sent to the frontend.
- The external link uses `noopener noreferrer`.
- The feature is opt-in and uses no network requests when not configured.

## Error handling

- A request failure is logged at debug level and expires the short cache; normal Football Hub score refresh continues.
- Ambiguous or incomplete provider metadata produces no button.
- Existing live scores, filters, alerts, LMS and Acca features do not depend on this feature.

## Testing

- Unit tests cover URL validation, exact fixture matching, tolerance boundaries, team-name normalisation, ambiguous candidates and disabled configuration.
- Frontend tests cover rendering a Watch button only when `nuvio_watch_url` exists.
- Manual test: configure a final add-on manifest URL, select a live football event available in both systems, and confirm the link opens the same event in Nuvio.
