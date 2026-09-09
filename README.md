# ⚽ Home Assistant Football Hub

[![License](https://img.shields.io/badge/license-Personal%20Use-red.svg)](LICENSE)
![Version](https://img.shields.io/badge/version-v0.7.10-green)
![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024.1%2B-blue)
![HACS](https://img.shields.io/badge/HACS-Custom-orange)
![Cloud Polling](https://img.shields.io/badge/IoT--Class-Cloud%20Polling-blue)

A dedicated multi-country football application, live match portal and Last Man Standing competition manager for Home Assistant.

Follow fixtures, live scores, results, league tables, match events, statistics, line-ups, players, clubs, cups, football news, regional TV listings and transfers from one responsive football-themed dashboard.

Create private Last Man Standing competitions with secure player links, hidden picks, automatic deadlines, results, standings, prize tracking and email notifications.

Football Hub remembers the country, competition, favourite clubs and last-opened page you select.

---

## Latest release — 0.7.10

- Fixed Acca League Champions League results so **Check results** retrieves completed European matches.
- Champions League, Europa League and Conference League picks are matched only against their selected competition, preventing domestic results from being used.
- Acca fixture loading now respects each round's selected dates and competitions.
- Paid-round corrections and the selected payer remain saved instead of being recalculated when the page refreshes.
- Acca fixture and selection sections remember whether they were expanded or collapsed.
- The external Acca data now includes the actual fixture associated with every selected team.
- LMS scoring and round logic are unchanged.

## Quick start and installation

1. In **HACS → Integrations → Custom repositories**, add `https://github.com/Adya84/ha-football-hub` as an **Integration** repository.
2. Install **Football Hub**, restart Home Assistant, then add it from **Settings → Devices & Services**.
3. Open Football Hub from the sidebar and choose your country, league and favourite clubs.

For manual installation, download the latest [release](https://github.com/Adya84/ha-football-hub/releases), copy `custom_components/football_hub` to `config/custom_components/football_hub`, restart Home Assistant, then add the integration.

Update through HACS, restart Home Assistant, then press **Ctrl+F5** in the browser.

## Support Football Hub

Football Hub is independently developed by Adrian Apel. Support future improvements via [Ko-fi](https://ko-fi.com/ady1984) or [PayPal](https://paypal.me/graffidoodle). Please also star the repository and report issues through the [issue tracker](https://github.com/Adya84/ha-football-hub/issues).

## Previous release — 0.7.4

- Added a **Match details** button throughout the main Football Hub: Fixtures, Results, My Club and Cups. It opens the score, timeline, statistics, line-ups and available venue information for that fixture.
- Transfer dates now use a clear local date and time rather than raw API timestamps.
- Live alerts are colour-coded: green goal alerts, yellow-card yellow, red-card red, half-time purple, full-time cyan and kick-off blue.
- Goal alerts flash green before settling into a slow glow so they remain easy to read.
- Added optional alert sounds: a whistle for kick-off, crowd cheer for goals, boo for red cards and three whistles at full-time. Tick **Alert sounds** once on Live to enable them in the browser.
- Added individual yellow-card and red-card notification choices.
- LMS and Acca League scoring and round logic are unchanged.

## Previous release — 0.7.3

- Added an Alerts on/off control to every match on the Live page.
- Match alerts are enabled by default. Turning one off silences only that fixture and is remembered on that device.
- Added Select all and Deselect all controls for today's match alerts.
- The existing alert-type and selected-club filters continue to apply.
- Fixed the Overview top-scorer card for the provider's flattened player format, matching the working Players page.
- Includes all fixes from 0.7.2.

## Previous release — 0.7.2

- Fixed Live competition grouping so identically named leagues are kept under their real country. For example, Egyptian, Russian and Canadian Premier League matches no longer appear under England.
- Added reliable on-page alerts for kick-off, goals, half-time and full-time. These work when Home Assistant is opened over ordinary local HTTP, where Chrome blocks native browser notifications.
- Added an alert status message and Test alert button. Native system notifications continue to work when Home Assistant is opened securely over HTTPS and browser permission is granted.
- Removed exact duplicate entries from the My Club injuries and suspensions list.
- Uses only `frontend/football-hub-panel.js`.
- No changes to LMS or Acca scoring/round logic.

### Updating

Update through HACS, restart Home Assistant, and hard-refresh your browser (Ctrl+F5). On Live, enable the alert types you want and use Test alert to confirm the on-page notification appears.

## Previous release — 0.7.1

- Fixed My Club top scorers, assists and recent club results.
- Added Football Hub statistical predictions and restart-safe My Club caching.
- Saved predictions are reused until their input data changes.
- Removed the obsolete panel-entry registration.

# Previous release — v0.5.1

Football Hub 0.5.1 expands the **Last Man Standing (LMS)** system with Global competitions, automatic email reminders and improved private competition controls.

### New and improved

* Added the official Football Hub Global LMS competition.
* Global competitions can only be created and managed by the Football Hub developer.
* Added secure developer authentication for Global competition administration.
* Players can join an open Global competition from its public page.
* Added Global entry fees, prize-fund tracking and a 10% maintenance contribution.
* Added controls for opening and closing Global competition entries.
* Removed the ability for users to create unofficial Global competitions.
* Added automatic pick reminders approximately 24 hours before the deadline.
* Added a final reminder a few hours before the first match begins.
* Private reminders are only sent to players marked as paid.
* Unpaid players are excluded from bulk outstanding-pick reminders.
* Players who have submitted their current-round pick are not reminded.
* Each automatic reminder is sent only once per player and round.
* Initial invitation and pick-link emails can still be sent before payment is recorded.
* Improved local-time deadline countdowns and public LMS synchronisation.
* Improved developer-key validation, sanitising and private administration protection.
* Prevented browser password prompts from clearing competition details.
* Current-round picks remain hidden until the deadline.
* Multiple favourite clubs can be followed across different leagues at the same time.
* Restart-safe caching reduces unnecessary data requests.
* Live-match polling remains separate from slower-changing football data.

Live detail availability—including timers, events, line-ups, venue information and statistics—depends on coverage for the individual match.

---

# 🌟 Features

## 🧭 Dedicated Football Hub application

Navigate between:

* Overview
* Live Centre
* My Club
* Fixtures
* Results
* League Table
* Players
* Cups
* News
* TV Guide
* Transfers
* Supporters
* Settings

The interface supports desktop, tablet, mobile, touchscreens and wall-mounted Home Assistant dashboards.

---

## 🔴 Live Match Centre

Available live information can include:

* Scores and match timers
* Goals and assists
* Yellow and red cards
* Substitutions
* Match timeline
* Team statistics
* Starting line-ups
* Venue, referee and weather details
* Multiple simultaneous matches
* Favourite-club priority
* UEFA, international and supported domestic matches

Live matches refresh more frequently while slower data uses longer, staggered cache periods.

---

## 📅 Fixtures, friendlies and results

* Full competition fixture lists
* Team filtering
* Upcoming fixtures and completed results
* Kick-off dates and times
* Home and away club badges
* Match status and final scores
* Club friendlies included for supported teams
* Completed friendlies retained in restart-safe storage
* Persistent fixture filter selection

---

## 📊 Tables and player data

League tables can include position, played, wins, draws, losses, goals, goal difference, points, yellow cards and red cards.

Player pages can include top scorers, assists, appearances, minutes, ratings, yellow cards and red cards when that information is available.

---

## 🏟️ My Club and multiple favourites

Follow up to five permanent favourite clubs across different countries and leagues without replacing the previous selection.

Club information can include:

* Club profile and badge
* League position
* Next fixture and recent results
* Current squad and player photos
* Manager and venue details
* Injuries and suspensions
* Recent transfers and reported fees
* Club records and trophies
* Live-match priority and table highlighting

---

## 🌍 Supported leagues

### England

Premier League, Championship, League One, League Two and National League.

### Scotland

Scottish Premiership, Championship, League One, League Two and Highland/Lowland coverage.

### Wales

Cymru Premier, Cymru North and Cymru South.

### Ireland

Northern Ireland Premiership and League of Ireland Premier Division.

### Europe

La Liga, Bundesliga, Serie A, Ligue 1, Eredivisie, Primeira Liga, Jupiler Pro League and Süper Lig.

### United States

MLS, USL Championship, USL League One, MLS Next Pro, NISA and NWSL.

Coverage varies by competition and by the information made available for each match.

---

## 🏆 Cups

The independent Cups area includes domestic cups and super cups for supported countries, plus:

* UEFA Champions League
* UEFA Europa League
* UEFA Conference League
* FA Cup and EFL Cup
* Scottish Cup and League Cup
* Welsh Cup
* US Open Cup and supported US cups

Cup fixtures, results, tables and player information remain separate from the selected domestic league.

---

## 📰 Football portal

* Current football news with images and source links
* Country-aware television listings
* Latest and top transfer-market views
* Transfer fees, dates and movement details where available
* Community Supporters page with countries, flags and messages
* Language and desktop/tablet/mobile view selectors

---

## 💾 Persistent selections and efficient polling

Football Hub remembers:

* Last-opened page
* Selected language and view mode
* Country and league
* Favourite clubs
* Fixture team filter
* Selected live match
* Cup competition and cup view
* Transfer-market view

Long-lived club, league and portal data is cached across restarts. Live scores use a short refresh cycle only when needed.

---

# 📦 Installation

## Option 1: HACS

1. Open **HACS** in Home Assistant.
2. Add `https://github.com/Adya84/ha-football-hub` as a custom **Integration** repository.
3. Search for **Football Hub** and install it.
4. Restart Home Assistant.
5. Go to **Settings → Devices & Services → Add Integration**.
6. Search for **Football Hub** and complete setup.

## Option 2: Manual installation

1. Download this repository.
2. Copy `custom_components/football_hub` into `config/custom_components/football_hub`.
3. Restart Home Assistant.
4. Add Football Hub from **Settings → Devices & Services**.

The country, league and club selections are made inside the Football Hub frontend.

---

# 🔒 Licensing

Copyright (C) 2026 Adrian Apel

This software is provided for personal, private and non-commercial use only. Redistribution, resale, rebranding, commercial use and publication of modified versions are prohibited without prior written permission.

See the [LICENSE](LICENSE) file for the full licence terms.

---

# 👨‍💻 Author and support

Created and maintained by Adrian Apel.

* [Official repository](https://github.com/Adya84/ha-football-hub)
* [Issue tracker](https://github.com/Adya84/ha-football-hub/issues)
* [Ko-fi](https://ko-fi.com/ady1984)
* [Buy me a beer](https://paypal.me/graffidoodle)

---

# ⚠️ Disclaimer

Football Hub is an independent Home Assistant integration. It is not affiliated with, endorsed by, sponsored by or officially connected to Home Assistant, HACS, FIFA, UEFA, any data provider, football association, competition organiser, club, venue or broadcaster.

All trademarks, competition names, club names, team names and logos remain the property of their respective owners.

