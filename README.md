# ⚽ Home Assistant Football Hub

[![License](https://img.shields.io/badge/license-Personal%20Use-red.svg)](LICENSE)
![Version](https://img.shields.io/badge/version-v0.4.12-green)
![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024.1%2B-blue)
![HACS](https://img.shields.io/badge/HACS-Custom-orange)
![Cloud Polling](https://img.shields.io/badge/IoT--Class-Cloud%20Polling-blue)

A dedicated multi-country football application and live match portal for Home Assistant.

Follow fixtures, live scores, results, league tables, match events, statistics, line-ups, players, clubs, cups, football news, regional TV listings and transfers from one responsive football-themed dashboard.

Football Hub remembers the country, competition, favourite clubs and last-opened page you select.

---

# 🚀 Latest Release — v0.4.12

Football Hub 0.4.12 expands Welsh football coverage and improves how club friendlies are retained.

### New and improved

* Added Cymru North and Cymru South.
* Added complete club lists for both Welsh divisions.
* Added Welsh fixtures, results and league-table support where supplied by the permitted source.
* Added safe fallback tables so Welsh club selectors do not become empty during a temporary source failure.
* Completed club friendlies are now stored and retained on the relevant teams' Results pages.
* Friendly results remain labelled by their friendly competition.
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
