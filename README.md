# ⚽ Home Assistant Football Hub

[![License](https://img.shields.io/badge/license-Personal%20Use-red.svg)](LICENSE)
![Version](https://img.shields.io/badge/version-v0.8.2--beta3-yellow)
![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024.1%2B-blue)
![HACS](https://img.shields.io/badge/HACS-Custom-orange)
![Cloud Polling](https://img.shields.io/badge/IoT--Class-Cloud%20Polling-blue)

Football Hub is a football dashboard and private competition manager for Home Assistant. Follow live scores, fixtures, results, tables, teams, cups, players, news, TV listings and transfers in one football-themed interface.

It also includes Last Man Standing (LMS) and Acca League tools, with private player links, automatic fixture checking, payments, reminders and shared public pages.

---

## Latest release — 0.8.2-beta3

### Live Centre

- Live filters now apply everywhere: an unchecked competition cannot reappear as the provider's primary match or in the favourite-club live strip.
- Live leagues now show the country flag beside the competition name, including England, Czechia and Cyprus.
- Favourite competitions can be starred in the **Live** filters. Starred competitions are pinned above other matches when they have live fixtures.
- Favourite-club matches appear in a dedicated **Your clubs playing now** section.
- Live headers show the number of current matches, goals and selected matches, plus when the data was last updated.
- Match alerts, live scores, match minutes, team badges and detailed match views remain available.
- Optional **Nuvio watch links** can compare public Sports Streams event names with Football Hub fixtures. A Watch in Nuvio button appears only for one exact team match; Football Hub never retrieves, stores or serves stream URLs.

### Favourite clubs and sensors

- Each selected favourite club creates one clean Home Assistant device with its current sensors.
- Removing a favourite club also removes that club's Football Hub sensors and device data.
- Old duplicated favourite-club devices are cleaned up automatically.
- Favourite-club fixture, result, live-score and league-position sensors have improved cache recovery.

### Last Man Standing and Acca League

- LMS players are grouped into **Live now**, **To play**, **Through** and **Eliminated** sections.
- Only a finished fixture can mark a player **Through** or **Out**. Live games show their score and minute; future games show their fixture date and kick-off time.
- Buy-backs are saved atomically, restore the player correctly, retain the original team as used and show **Paid back · Round 1** on LMS pages and standings.
- Secure LMS pick links include grouped round fixtures, local kick-off times and a fixture count such as `England · 10 games`.
- Acca League payer corrections stay saved when a new round begins, while keeping the organiser's configured round fee.

### Reliability

- Fixed a panel error that could cause a black screen for some users.
- Prevents large football-data attributes from being written unnecessarily to Home Assistant's recorder database.
- Corrects stale LMS outcomes using the completed fixture selected for that round.

---

## Installation

### HACS

1. In **HACS → Integrations → Custom repositories**, add `https://github.com/Adya84/ha-football-hub` as an **Integration** repository.
2. Install **Football Hub**.
3. Restart Home Assistant.
4. Go to **Settings → Devices & Services → Add Integration** and add **Football Hub**.
5. Open Football Hub from the sidebar and choose your country, competition and favourite clubs.

### Manual installation

1. Download the latest [release](https://github.com/Adya84/ha-football-hub/releases).
2. Copy `custom_components/football_hub` into `config/custom_components/football_hub`.
3. Restart Home Assistant.
4. Add Football Hub from **Settings → Devices & Services**.

After an update, restart Home Assistant and hard-refresh the browser with **Ctrl+F5**.

---

## What Football Hub includes

### Live Centre

- Worldwide live scores grouped by country and competition
- Country flags, match timers, goals, cards, substitutions and score updates
- Starred preferred competitions and favourite-club priority
- Optional on-page alerts for kick-off, goals, cards, half-time and full-time
- Match details with timeline, statistics, line-ups, venue, referee and weather where available
- Optional Nuvio hand-off links for exact Sports Streams football-event matches (requires the add-on to be installed in Nuvio)

### My Club

Follow up to five favourite clubs across countries and competitions. Club pages can show profile information, league position, upcoming fixtures, results, squad, injuries, suspensions, transfers, club records and trophies.

Each favourite club is also available through Home Assistant sensors. Removing a club from **My Club** removes its associated Football Hub device and sensors.

### Fixtures, results and tables

- Full fixture lists with local kick-off dates and times
- Completed results, scores and match status
- Domestic and supported cup coverage
- League tables, scorers, assists, player statistics and squad information where supplied by the provider

### Last Man Standing

- Private competitions with player links and hidden picks until the deadline
- Automatic result checking and player status grouping
- Live match score and minute for active selections
- Buy-back support with visible paid-back status
- Payment tracking, prize fund, reminders and previous winners
- Restart a completed competition with the same player links

### Acca League

- Two-pick 3/1/0 scoring competitions
- Round fixtures and result checking across selected competitions
- Payment/payer tracking and historic correction controls
- Shared standings and round history

---

## Supported football coverage

Football Hub supports a wide range of domestic leagues, cups, UEFA competitions and international football, including England, Scotland, Wales, Ireland, major European leagues and United States coverage. Available details depend on the data available for each fixture and competition.

---

## Data refresh and troubleshooting

Live scores refresh more often than fixtures, tables and club information. If a panel looks outdated after an update:

1. Restart Home Assistant.
2. Hard-refresh Football Hub with **Ctrl+F5**.
3. Open **Live** and press **Refresh** if needed.
4. Check **Settings → System → Logs** for a Football Hub error and include it in an [issue](https://github.com/Adya84/ha-football-hub/issues).

---

## Support Football Hub

Football Hub is independently developed by Adrian Apel. You can support future updates through [Ko-fi](https://ko-fi.com/ady1984) or [PayPal](https://paypal.me/graffidoodle). Please also star the repository and report problems through the [issue tracker](https://github.com/Adya84/ha-football-hub/issues).

---

## Licence

Copyright (C) 2026 Adrian Apel

This software is provided for personal, private and non-commercial use only. Redistribution, resale, rebranding, commercial use and publication of modified versions are prohibited without prior written permission. See [LICENSE](LICENSE) for the full terms.

---

## Disclaimer

Football Hub is an independent Home Assistant integration. It is not affiliated with, endorsed by, sponsored by or officially connected to Home Assistant, HACS, FIFA, UEFA, any football data provider, association, competition, club, venue or broadcaster. All trademarks, competition names, club names, team names and logos remain the property of their respective owners.
