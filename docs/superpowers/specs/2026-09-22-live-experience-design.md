# Live experience and navigation design

## Goal

Make Football Hub's Live page quick and predictable on ordinary Home Assistant installations while making it easier to follow the leagues, clubs, alerts and optional Watch links that matter to each user. Let every user tailor the Football Hub sidebar to the features they actually use.

This work remains on the existing `0.8.4` beta line. It does not alter LMS code, data, screens, links, emails or services.

## Scope

### Fast Live filters

- Keep country rows lightweight until the user chooses **Show leagues**.
- Keep filter choices in browser storage, not the Home Assistant configuration entry. This prevents a filter click from scheduling a coordinator refresh or redrawing the whole page repeatedly.
- Preserve the current men's/women's, country, competition and favourites choices after a normal Live-page redraw.
- Add a compact **My leagues** area above the full country catalogue. It contains only favourite competitions and can be used without opening the large catalogue.
- The full country catalogue remains available for discovery. An opened country's leagues use the page scroll, not a second trapped scrollbar.

### Alerts

- Keep existing alert types: kick-off, goal, yellow card, red card, half-time and full-time.
- Add an alert audience choice: favourite clubs, favourite competitions, or every currently selected competition.
- Store alert choices locally in the browser and evaluate them only against the current Live data. Alerts must not call a Home Assistant service or write configuration during normal use.
- A missing browser notification permission, unavailable audio, or no matching fixture must fail quietly and leave the Live page usable.

### Watch-link status

- Preserve the existing optional Sports Streams/Stremio integration and its safe exact-match policy.
- Each Live fixture receives a small status: **Watch available**, **No stream found**, or **Available when live**.
- Only an exact, safe `nuvio_watch_url` renders an external Watch button. A status must never expose a stream URL, proxy media, or fetch a new catalogue from the browser.
- The status is informational; scores, filters and alerts continue normally if Sports Streams is unset or unavailable.

### Custom sidebar

- Add a **Customise sidebar** section at the top of Football Hub Settings, with one on/off switch for each optional navigation tab.
- Keep **Overview** permanently visible as the safe home screen. Users may independently hide or show Live, My Club, Fixtures, Results, Table, Players, Cups, LMS, Acca League, News, TV Guide, Transfers and Supporters.
- Hidden means absent from the sidebar only. It must not delete a feature's settings, records, entries, emails, links or Home Assistant entities.
- Save the choice locally in the browser so it is immediate, does not trigger coordinator work, and does not need Home Assistant service calls. A reset-to-defaults action restores the standard sidebar.
- If a user hides the tab currently open, return them to Overview immediately.

## Components and data flow

1. The coordinator continues to supply matches and any exact `nuvio_watch_url` it already found.
2. The panel reads match data and local Live settings, then produces a filtered fixture view.
3. A small local preferences helper handles Live filters, favourites and alert audience choices. It performs no `football_hub.save_ui_preferences` call.
4. The Live page renders the My Leagues shortcuts first, then the lightweight country catalogue, alert controls, and match rows.
5. Browser notifications are emitted only after a selected fixture produces a selected event and the user has granted permission.
6. The sidebar reads local visibility choices before it renders its optional tabs. The active tab is validated against those choices on every panel render.

## Error handling and performance rules

- Do not call `save_ui_preferences` from a Live-page filter, alert, display, timezone, favourite or expand/collapse interaction.
- Do not use forced browser or Home Assistant scroll restoration.
- Do not rerender the full panel solely because an already-rendered country is opened or closed unless its lazy controls must be inserted or removed.
- Catalogue rows without matches remain cheap text/checkbox rows; competition controls are generated only for opened countries or My Leagues.
- A malformed local preference is ignored and replaced with defaults.
- A malformed sidebar visibility preference falls back to the full standard sidebar, with Overview visible.

## Testing

- Test a local gender selection survives stale shared preferences and panel redraws.
- Test My Leagues contains only favourite competitions and honours the active filter settings.
- Test each alert audience includes and excludes the correct fixtures without service calls.
- Test Watch status renders each of the three states and only the available state has an external link.
- Test each optional sidebar tab can be hidden and restored without changing its feature data; test that hiding the active tab opens Overview.
- Keep existing Live filter, flag, optional Watch-link and LMS tests passing. LMS tests confirm this work has not changed LMS behaviour.

## Release

- Ship test builds as successive `0.8.4-beta.*` releases.
- Promote to the next normal release only after the Live page is responsive in Home Assistant and filters, alerts and Watch statuses have been manually tested.
