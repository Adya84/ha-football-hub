# ⚽ Home Assistant Football Hub

[![License](https://img.shields.io/badge/license-Personal%20Use-red.svg)](LICENSE)
![Version](https://img.shields.io/badge/version-v0.2.9-green)
![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024.1%2B-blue)
![HACS](https://img.shields.io/badge/HACS-Custom-orange)
![Provider](https://img.shields.io/badge/Data-API--Football-success)
![Cloud Polling](https://img.shields.io/badge/IoT-Class-Cloud%20Polling-blue)

A dedicated multi-competition football application for Home Assistant.

Track fixtures, live scores, results, league tables, match statistics, line-ups, player data and team information from one football-themed dashboard.

Football Hub supports multiple countries and competitions through built-in country and league selectors, with your selected competition, supported team and last-opened page restored automatically.

---

## 📸 Screenshots

Screenshots will be added as the Football Hub application continues to evolve.

Current sections include:

* Overview
* Live Centre
* Fixtures
* Results
* League Table
* Players
* Team Centre
* Supporters
* Settings

---

# 🚀 Latest Release - v0.2.9

Football Hub 0.2.9 simplifies the initial setup process and moves competition selection fully into the Football Hub frontend.

New installations now require only an API-Football key. Football Hub then starts automatically with the Premier League, the current configured football season and the main provider mode enabled.

---

## ⚙️ Simplified Initial Setup

New installations now ask only for:

* API-Football API Key

Football Hub automatically applies the following starting configuration:

* Country: England
* Competition: Premier League
* Current Configured Football Season
* Main Provider Mode

This removes duplicate setup questions and allows users to begin using Football Hub more quickly.

---

## 🌍 Frontend Competition Selection

Country and league selection is now handled entirely inside the Football Hub dashboard.

Features include:

* Built-In Country Selector
* Built-In League Selector
* Competition Switching Without Reinstallation
* Competition Switching Without Reconfiguration
* Persistent Competition Selection
* Automatic Restoration After Home Assistant Restarts
* Premier League Default For New Installations

Existing Football Hub installations remain compatible and are not changed automatically.

---

## ⚡ Setup & Usability Improvements

Version 0.2.9 includes:

* Fewer Setup Steps
* API-Key-Only Initial Configuration
* Automatic Premier League Selection
* Automatic Season Selection
* Automatic Main Provider Mode
* Removal Of Duplicate Country Questions
* Removal Of Duplicate League Questions
* Removal Of Duplicate Season Questions
* Removal Of Duplicate Provider Questions
* Existing Installation Compatibility

---

## 🔒 Licensing

Copyright (C) 2026 Adrian Apel

This software is provided for personal, private and non-commercial use only.

You may:

* Download and use the software for personal use.
* Install and run the software within your own Home Assistant environment.
* Fork the repository for personal testing, learning or development.
* Share links to the official GitHub repository.
* Submit bug reports, suggestions and pull requests.

You may not:

* Sell the software.
* Charge money for access to the software.
* Redistribute modified or unmodified copies.
* Publish modified versions.
* Rebrand, rename or claim ownership of the software.
* Include the software in a paid product, service, bundle or package.
* Use the software or its source code commercially.
* Remove copyright notices, author credits or attribution.
* Upload copies to other repositories or distribution platforms.
* Provide paid installation, hosting, support or managed services without permission.

All rights are reserved by Adrian Apel.

See the LICENSE file for full licence details.

---

## 📦 Installation

### Option 1: Install via HACS

1. Open Home Assistant.
2. Go to **HACS**.
3. Open the menu in the top-right corner and select **Custom repositories**.
4. Add this repository URL:

   `https://github.com/Adya84/ha-football-hub`

5. Select **Integration** as the category.
6. Click **Add**.
7. Search for **Football Hub** in HACS.
8. Download and install the integration.
9. Restart Home Assistant.

### Option 2: Manual Installation

1. Download or clone this repository.
2. Copy:

   `custom_components/football_hub`

   into:

   `config/custom_components/football_hub`

3. Restart Home Assistant.

---

## ⚙️ Configuration

1. Go to **Settings → Devices & Services**.
2. Click **Add Integration**.
3. Search for **Football Hub**.
4. Enter your API-Football API key.
5. Complete setup.
6. Open Football Hub from the Home Assistant sidebar.
7. Select your preferred country and league from the frontend dropdowns.
8. Choose the team you support.

Football Hub remembers your:

* Selected Country
* Selected Competition
* Supported Team
* Last-Opened Page

These selections are restored automatically after Home Assistant restarts.

---

## 🔑 API Key

Football Hub uses live football data from:

https://www.api-football.com/

A valid API-Football API key is required.

Competition availability, live information, fixtures, results, statistics, line-ups and player data depend on the coverage and limits included with your API plan.

---

# 🌟 Features

## 🧭 Dedicated Football Hub Application

Navigate instantly between:

* Overview
* Live Centre
* Fixtures
* Results
* League Table
* Players
* Team Centre
* Supporters
* Settings

Designed for desktop, tablet and mobile devices.

---

## 🌍 Country & Competition Selector

Football Hub supports multiple countries and football competitions from one shared integration.

Features include:

* Country Selection
* League Selection
* Frontend Competition Switching
* No Reinstallation Required
* No Integration Reconfiguration Required
* Persistent Competition Selection
* Automatic Competition Restoration
* Current Season Selection

---

## 🏴 English Football Pyramid

English competitions currently include:

* Premier League
* Championship
* League One
* League Two
* National League

Top-flight competitions from additional countries are available through the country and league selectors.

Competition availability depends on API-Football coverage and your API plan.

---

## 🔴 Live Match Centre

Track live football with:

* Live Scores
* Match Status
* Match Timer
* Goal Events
* Yellow Cards
* Red Cards
* Substitutions
* Match Statistics
* Team Line-Ups
* Multiple Live Matches
* Supported-Team Priority
* Live League Position Information

Choose the team you support and Football Hub will prioritise that team's fixture in the Live Centre while keeping other live matches visible.

Polling adjusts automatically around match times to provide faster live updates while reducing unnecessary API requests when no match is being played.

---

## 📅 Fixtures & Results

Features include:

* Upcoming Fixtures
* Completed Results
* Team Fixture Filtering
* Competition Fixture Lists
* Match Dates
* Kick-Off Times
* Home & Away Teams
* Match Status
* Final Scores
* Match Detail Access

---

## 📊 League Tables

Track competition standings with:

* League Position
* Matches Played
* Wins
* Draws
* Losses
* Goals For
* Goals Against
* Goal Difference
* Points
* Live Table Updates

---

## 📈 Match Statistics & Events

Available match information can include:

* Possession
* Shots
* Shots On Target
* Corners
* Fouls
* Offsides
* Goals
* Cards
* Substitutions
* Match Events
* Line-Ups

Data availability depends on the selected competition and API-Football coverage.

---

## 👥 Team Line-Ups

Supported fixtures can include:

* Starting Line-Ups
* Substitutes
* Formations
* Player Positions
* Managers
* Match Squads

---

## 🎯 Player Statistics

Track player information including:

* Top Scorers
* Goals
* Assists
* Appearances
* Player Rankings
* Competition Statistics

Available player data depends on the selected competition and API coverage.

---

## 🏟 Team Centre

The Team Centre brings club information together in one place.

Features can include:

* Team Overview
* Upcoming Fixtures
* Recent Results
* League Position
* Squad Information
* Team Statistics
* Card Totals
* Supported-Team Information

---

## 🟨 Team Card Totals

Football Hub tracks disciplinary information including:

* Yellow Card Totals
* Red Card Totals
* Team Rankings
* Competition-Wide Comparisons

---

## ❤️ Supporters

Football Hub includes a dedicated Community Supporters page.

Features include:

* Latest Supporters
* All Supporters
* Supporter Names
* Supporter Countries
* National Flags
* Optional Messages
* Support Dates
* Supporters Around The World
* Premium Supporter Recognition

---

## 💾 Persistent Selections

Football Hub remembers:

* Last-Opened Page
* Selected Country
* Selected League
* Supported Team

Selections remain available after page refreshes and Home Assistant restarts.

---

## 📱 Responsive Interface

Football Hub is designed for:

* Desktop
* Tablet
* Mobile
* Touchscreen Dashboards
* Wall-Mounted Home Assistant Displays

---

## 📦 Included Entities

Football Hub provides Home Assistant entities covering areas such as:

* Integration Status
* Live Matches
* Fixtures
* Results
* League Standings
* Players
* Match Statistics
* Team Information
* Competition Information

Entity availability depends on the selected competition and available API data.

---

# 🙏 Credits

Football data is provided through:

https://www.api-football.com/

Football Hub is an independent Home Assistant integration and is not affiliated with, endorsed by or sponsored by API-Football, Home Assistant, HACS or any football organisation.

---

# 👨‍💻 Author

Created and maintained by Adrian Apel.

GitHub:

https://github.com/Adya84/ha-football-hub

---

# 📜 Licence

Copyright (C) 2026 Adrian Apel

Football Hub is licensed under the Football Hub Home Assistant Integration Licence.

This software is provided for personal, private and non-commercial use only.

Redistribution, resale, rebranding, commercial use and publication of modified versions are prohibited without prior written permission from Adrian Apel.

All rights reserved.

See the LICENSE file for full licence details.

---

# 🤝 Support & Feedback

Bug reports, feature requests and suggestions are welcome.

GitHub Repository:

https://github.com/Adya84/ha-football-hub

Issue Tracker:

https://github.com/Adya84/ha-football-hub/issues

Please open an issue if you discover a bug or would like to suggest a new feature.

---

# ❤️ Support Development

## 🍺 Buy Me a Beer

PayPal:

https://paypal.me/graffidoodle

Every contribution helps support:

* Football Data Costs
* New Competitions
* New Features
* Dashboard Improvements
* Live Match Development
* Testing
* Bug Fixes
* Ongoing Maintenance

Supporters can be recognised inside the Football Hub Supporters page with their name, country, national flag and an optional message.

---

## ⚠️ Disclaimer

Football Hub is an independent Home Assistant integration.

It is not affiliated with, endorsed by, sponsored by or officially connected to Home Assistant, HACS, API-Football, football-data.org, FIFA, UEFA, The Premier League, The English Football League, The Scottish Professional Football League, LaLiga, Bundesliga, Serie A, Ligue 1, Major League Soccer, or any football governing body, competition organiser, club, venue or broadcaster.

All trademarks, club names, competition names, team names and logos remain the property of their respective owners.
