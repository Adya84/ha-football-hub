# ⚽ Home Assistant Football Hub

[![License](https://img.shields.io/badge/license-Personal%20Use-red.svg)](LICENSE)
![Version](https://img.shields.io/badge/version-v0.5.0-green)
![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024.1%2B-blue)
![HACS](https://img.shields.io/badge/HACS-Custom-orange)
![Cloud Polling](https://img.shields.io/badge/IoT--Class-Cloud%20Polling-blue)

A dedicated multi-country football application, live match portal and Last Man Standing competition manager for Home Assistant.

Follow fixtures, live scores, results, league tables, match events, statistics, line-ups, players, clubs, cups, football news, regional TV listings and transfers from one responsive football-themed dashboard.

Create private Last Man Standing competitions with secure player links, hidden picks, automatic deadlines, results, standings, prize tracking and email notifications.

Football Hub remembers the country, competition, favourite clubs and last-opened page you select.

---

# 🚀 Latest Release — v0.5.0

Football Hub 0.5.0 introduces the new **Last Man Standing (LMS)** competition system.

### New and improved

* Added a dedicated LMS section.
* Create private Last Man Standing competitions.
* Select one or more supported leagues for each competition.
* Add players with names and email addresses.
* Generate secure private team-selection links.
* Players can submit picks without accessing Home Assistant.
* Added administrator password protection.
* Added local-time pick deadlines and countdowns.
* Current-round picks remain hidden until the deadline.
* Added automatic player progression and elimination.
* Added standings, fixtures, results and team-pick history.
* Added payment and prize-fund tracking.
* Added first-round buy-back support.
* Added competition rollover support.
* Added Home Assistant SMTP email notifications.
* Email player pick links and outstanding-pick reminders.
* Player email addresses remain masked until administrator access is unlocked.
* Multiple favourite clubs can be followed across different leagues.
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
* LMS
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

League tables can include:

* Position
* Played
* Wins
* Draws
* Losses
* Goals scored and conceded
* Goal difference
* Points
* Yellow cards
* Red cards

Player pages can include:

* Top scorers
* Top assists
* Appearances
* Minutes played
* Player ratings
* Yellow cards
* Red cards
* Additional available player statistics

Availability depends on the information supplied for each competition and player.

---

## 🏟️ My Club and multiple favourites

Follow up to five permanent favourite clubs across different countries and leagues without replacing previous selections.

Club information can include:

* Club profile and badge
* League position
* Next fixture and recent results
* Current squad and player photos
* Manager and venue details
* Injuries and suspensions
* Recent transfers and reported fees
* Club records and trophies
* Live-match priority
* League-table highlighting

---

# 🏆 Last Man Standing

Football Hub includes a complete private Last Man Standing competition manager.

## Creating a competition

Administrators can:

* Create a named private competition
* Protect it with an administrator password
* Select one or more supported leagues
* Set an entry fee
* Add players with names and email addresses
* Mark entry payments as paid or unpaid
* Generate public and private player links
* Manage picks, results and player status

Only the administrator can change players, payments, picks or competition results.

---

## Player picks

Each player receives a unique private link where they can:

* View the competition name and current round
* View the pick deadline in their local time
* See a countdown in days, hours, minutes and seconds
* Select from the teams included in the competition
* Submit their team without accessing Home Assistant
* Change their initial selection once

After the permitted change has been used, further changes require administrator approval.

A team previously used by the player cannot be selected again.

---

## Pick privacy

* Players can see whether another player has submitted a pick.
* The status changes from **Awaiting pick** to **Picked**.
* The selected team remains hidden until the round deadline.
* Current-round picks are removed from the public data response while hidden.
* Private player links are separate from the public competition link.
* Player email addresses are masked until the administrator password is entered.

---

## Deadlines and rounds

* Picks close when the first match of the round begins.
* Deadlines are displayed using the viewer’s local time.
* The countdown shows days, hours, minutes and seconds.
* Players who survive can select their next-round team early.
* Results can be checked after individual matches finish.
* Unfinished and postponed matches remain pending.
* Standings show players who are through, awaiting results or eliminated.

---

## Buy-backs and prize fund

* Optional one-time buy-back after a Round 1 elimination.
* Buy-back is available only to eligible eliminated players.
* The administrator records whether the buy-back has been paid.
* Buy-back payments are included in the prize fund.
* The losing team remains used and cannot be selected again.
* Buy-back availability closes at the Round 2 deadline.
* Competition entry fees and paid entries calculate the prize fund automatically.
* Existing prize money can roll over into a new competition.

---

## Public competition pages

Each LMS competition can generate a public read-only page containing:

* Competition standings
* Players still standing
* Pick-submission status
* Round fixtures
* Match results
* Previous team selections
* Prize fund
* Entry totals
* Deadline countdown
* Competition rules

Current-round team selections remain securely hidden until the deadline.

Players receive separate private links for submitting their selections.

---

# ✉️ LMS email notifications

Football Hub can send private pick links and reminder emails through the Home Assistant SMTP integration.

Football Hub does not store your email account password.

## Recommended Gmail setup

### 1. Enable Google 2-Step Verification

Open your [Google Account Security](https://myaccount.google.com/security) page and enable **2-Step Verification**.

### 2. Create a Google app password

1. Open [Google App Passwords](https://myaccount.google.com/apppasswords).
2. Sign in to your Google account.
3. Enter `Home Assistant` as the app name.
4. Select **Create**.
5. Copy the generated 16-character password.

Use this app password instead of your normal Gmail password.

### 3. Add SMTP to Home Assistant

Go to:

**Settings → Devices & services → Add integration → SMTP**

Enter:

* **Sender email:** Your Gmail address
* **Sender name:** Football Hub
* **Host:** `smtp.gmail.com`
* **Port:** `587`
* **Connection security:** STARTTLS
* **Username:** Your full Gmail address
* **Password:** Your 16-character Google app password
* **Verify SSL certificate:** Enabled
* **Connection timeout:** 15 seconds

Add your first recipient email address when Home Assistant requests it.

### 4. Add player recipients

Home Assistant requires recipient addresses to be registered before emails can be sent.

Go to:

**Settings → Devices & services → SMTP → Add recipient**

Add each LMS player’s email address.

### 5. Select the email service in Football Hub

1. Restart Home Assistant.
2. Open **Football Hub → LMS**.
3. Enter the competition administrator password.
4. Locate the **Player emails** section.
5. Select the configured SMTP notification service.
6. Use **Email pick link** beside an individual player.
7. Use **Email outstanding picks** to remind every eligible player who has not submitted a selection.

If an email does not arrive, check the recipient’s spam folder and test the SMTP notification through **Developer Tools → Actions**.

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
* FA Cup
* EFL Cup
* Scottish Cup
* Scottish League Cup
* Welsh Cup
* US Open Cup
* Supported United States cups

Cup fixtures, results, tables and player information remain separate from the selected domestic league.

---

## 📰 Football portal

* Current football news with images and source links
* Country-aware television listings
* Latest and top transfer-market views
* Transfer fees, dates and movement details where available
* Community Supporters page with countries, flags and messages
* Language selector
* Desktop, tablet and mobile view selectors

---

## 💾 Persistent selections and efficient polling

Football Hub remembers:

* Last-opened page
* Selected language
* Selected view mode
* Country and league
* Favourite clubs
* Fixture team filter
* Selected live match
* Cup competition and cup view
* Transfer-market view
* LMS competitions
* LMS players and picks
* LMS payment records
* LMS round results
* LMS public links

Long-lived club, league and portal data is cached across restarts.

Live scores use a short refresh cycle only when required.

---

# 📦 Installation

## Option 1: HACS

1. Open **HACS** in Home Assistant.
2. Add `https://github.com/Adya84/ha-football-hub` as a custom **Integration** repository.
3. Search for **Football Hub** and install it.
4. Restart Home Assistant.
5. Go to **Settings → Devices & services → Add integration**.
6. Search for **Football Hub** and complete setup.

## Option 2: Manual installation

1. Download this repository.
2. Copy `custom_components/football_hub` into `config/custom_components/football_hub`.
3. Restart Home Assistant.
4. Add Football Hub from **Settings → Devices & services**.

Country, league, club and competition selections are made inside the Football Hub frontend.

---

# 🔒 Privacy and security

* Football Hub does not store SMTP email passwords.
* Email authentication remains inside Home Assistant.
* LMS administrator passwords are stored as secure hashes.
* Public competition links are read-only.
* Player pick links use separate private tokens.
* Current-round picks remain hidden until the deadline.
* Player email addresses are masked until administrator access is unlocked.
* Administrators should keep player pick links and passwords private.

---

# 🔒 Licensing

Copyright (C) 2026 Adrian Apel

This software is provided for personal, private and non-commercial use only.

Redistribution, resale, rebranding, commercial use and publication of modified versions are prohibited without prior written permission.

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

Football Hub is an independent Home Assistant integration.

It is not affiliated with, endorsed by, sponsored by or officially connected to Home Assistant, HACS, FIFA, UEFA, any data provider, football association, competition organiser, club, venue or broadcaster.

All trademarks, competition names, club names, team names and logos remain the property of their respective owners.
