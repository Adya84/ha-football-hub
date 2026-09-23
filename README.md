# ⚽ Home Assistant Football Hub

[![License](https://img.shields.io/badge/license-Personal%20Use-red.svg)](LICENSE)
![Version](https://img.shields.io/badge/version-v0.8.5-brightgreen)
![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024.1%2B-blue)
![HACS](https://img.shields.io/badge/HACS-Custom-orange)
![Cloud Polling](https://img.shields.io/badge/IoT--Class-Cloud%20Polling-blue)

Football Hub is a football dashboard and private competition manager for Home Assistant. Follow live scores, fixtures, results, tables, teams, cups, players, news, TV listings and transfers in one football-themed interface.

It also includes Last Man Standing (LMS) and Acca League tools, with private player links, automatic fixture checking, payments, reminders and shared public pages.

---

## Contents

- [Install Football Hub](#install-football-hub)
- [First-time setup](#first-time-setup)
- [Updating Football Hub](#updating-football-hub)
- [What Football Hub includes](#what-football-hub-includes)
- [Data refresh and troubleshooting](#data-refresh-and-troubleshooting)

---

## Latest release — 0.8.5

- **Per-match alerts:** Every Live match can be enabled or disabled independently, while favourite-club matches begin enabled automatically.
- **Bulk controls:** Select all enables every match; Deselect non-favourites preserves favourite-club match alerts.
- **Event controls:** Choose the alert types you want, including goals, kick-off, cards, half-time and full-time.

---

## Install Football Hub

### Quick install — HACS

1. Open **HACS → Integrations** in Home Assistant.
2. Select the three-dot menu, choose **Custom repositories**, then add `https://github.com/Adya84/ha-football-hub`.
3. Set the category to **Integration** and select **Add**.
4. Search HACS integrations for **Football Hub**, open it, then select **Download**.
5. Restart Home Assistant when HACS finishes installing it.
6. Continue with [First-time setup](#first-time-setup).

> New to HACS? Install and configure HACS first, then return to these steps. Football Hub is added as a custom repository; it is not installed from the default HACS catalogue.

### HACS

Use the **Quick install — HACS** steps above. HACS keeps the integration in `config/custom_components/football_hub` and offers future updates from its **Updates** page.

### Manual installation

1. Download the source ZIP for the required [release](https://github.com/Adya84/ha-football-hub/releases), then extract it.
2. In your Home Assistant configuration directory, create `custom_components` if it does not already exist.
3. Copy the extracted `custom_components/football_hub` folder so the final path is exactly:

   ```text
   config/custom_components/football_hub/manifest.json
   ```

   Do not copy the outer repository folder or create a nested `football_hub/football_hub` folder.
4. Restart Home Assistant fully: **Settings → System → Restart Home Assistant**.
5. Continue with [First-time setup](#first-time-setup).

### First-time setup

1. In Home Assistant, go to **Settings → Devices & services**.
2. Select **Add integration**, search for **Football Hub**, and select it.
3. Confirm the empty setup form. Football Hub starts with the English Premier League and does not require an API key.
4. Open **Football Hub** from the Home Assistant sidebar.
5. Use the competition controls to choose your country, competition and season. Add clubs in **My Club** to follow them across supported competitions.

### Updating Football Hub

**HACS:** Open **HACS → Integrations**, select Football Hub, then install the available update and restart Home Assistant.

**Manual installation:** Download the new release, replace only `config/custom_components/football_hub`, and restart Home Assistant. Keep your Home Assistant configuration directory and do not remove unrelated custom components.

After any update, hard-refresh the Football Hub browser page with **Ctrl+F5** (Windows/Linux) or **Cmd+Shift+R** (macOS). This ensures the new dashboard JavaScript is loaded.

### Installation checks

- **Football Hub is not listed in Add integration:** Confirm the path ends in `custom_components/football_hub/manifest.json`, restart Home Assistant, and check the logs for a manifest or import error.
- **The panel still shows an older version:** Restart Home Assistant, then hard-refresh the browser. Clear the browser cache for your Home Assistant URL if needed.
- **HACS cannot find the repository:** Check that the custom repository category is **Integration** and that the repository URL is exactly `https://github.com/Adya84/ha-football-hub`.

---

## What Football Hub includes

### Live Centre

- Worldwide live scores grouped by country and competition
- Country flags, match timers, goals, cards, substitutions and score updates
- Starred preferred competitions and favourite-club priority
- Optional on-page alerts for kick-off, goals, cards, half-time and full-time
- Match details with timeline, statistics, line-ups, venue, referee and weather where available
- Optional Sports Streams hand-off links for exact football-event matches (requires Sports Streams to be installed in Stremio)

### Watch live matches with Stremio + Sports Streams

Football Hub can optionally add a **Watch** button beside a live match. Football Hub does not host video or choose a broadcaster. It compares the football fixture with the public event names supplied by the Sports Streams add-on and, when one exact match is found, hands the event over to Stremio so you can choose from the sources that Sports Streams makes available.

> Use streaming services and add-ons only where you have the right to access the content in your country. Availability, source quality and legality are controlled by the third-party service, not Football Hub.

#### 1. Create a Stremio account

1. Install the latest **Stremio** app for your device from [stremio.com/downloads](https://www.stremio.com/downloads), or use Stremio Web.
2. Open Stremio and create/sign in to your Stremio account.
3. Stay signed in to the same account in the browser/device you will open from Football Hub. Stremio synchronises installed add-ons across devices on the same account.

#### 2. Configure Sports Streams

1. Open the [Sports Streams configuration page](https://sports.highfly.dev/configure).
2. Choose the sports and preferences you want. For Football Hub, make sure **Football** is included if you are filtering the catalogue.
3. Sports Streams currently offers a free tier and optional paid/premium features. A paid account is **not required by Football Hub**; Football Hub only needs a valid Sports Streams manifest URL.
4. Click **Add to Stremio Web** or **Install in Stremio** to add Sports Streams to your Stremio account.
5. In Stremio, open **Add-ons** and confirm **Sports Streams** appears as installed.

Sports Streams says its catalogue normally refreshes every 60–120 seconds. If a match has only just started, refresh Stremio/Football Hub before assuming it is unavailable.

#### 3. Copy your Sports Streams manifest URL

Football Hub needs the **raw manifest URL**, not the configure-page address.

1. Return to the [Sports Streams configuration page](https://sports.highfly.dev/configure).
2. Set your preferences.
3. Use the **Copy** button on the page. Sports Streams documents this as the way to copy the raw manifest URL.
4. The copied value should be an HTTPS address ending in **`/manifest.json`**, for example:

   `https://sports.highfly.to/YOUR-TOKEN/manifest.json`

5. **Keep this URL private.** It can contain a personal/configuration token. Do not post it in GitHub issues, screenshots or logs.

If you change your Sports Streams preferences later, copy the newly generated manifest URL and save the new value in Football Hub.

#### 4. Add the manifest to Football Hub

1. Open **Football Hub → Live**.
2. Open the **Sports Streams (Beta)** settings section.
3. Paste the complete Sports Streams manifest URL into **Sports Streams manifest URL**.
4. Press **Save Sports Streams link**.
5. Press **Refresh** on the Live page, or restart Home Assistant if the catalogue does not update immediately.

Football Hub accepts the Sports Streams HTTPS manifest and uses its football catalogue for event-name matching. It does **not** retrieve or store the underlying video stream URLs.

#### 5. Use the Watch button

When Football Hub finds one exact Sports Streams event for the two teams:

1. A green **Watch** button appears on the compact live-match row.
2. Press **Watch**.
3. Stremio Web opens the matched sports event and requests the available sources for that event.
4. Choose the source you want from Stremio's stream list.
5. Playback is then handled by Stremio/Sports Streams.

Football Hub deliberately does not choose a particular source. Sports Streams itself recommends trying another source from its stream list if one is buffering or fails.

#### Watch button not appearing?

Check these in order:

1. Make sure the fixture is actually present in Sports Streams.
2. Confirm Sports Streams is installed in the Stremio account you are using.
3. Re-copy the manifest URL from Sports Streams and make sure it ends in `/manifest.json`.
4. In **Football Hub → Live → Sports Streams (Beta)**, save the URL again and refresh the page.
5. The button only appears when Football Hub can identify **one exact team-v-team event**. Ambiguous or differently named events are intentionally not linked.
6. If Sports Streams shows no matches, refresh/restart Stremio and try again after a minute or two.
7. If the correct event opens but a source is wrong, return to the stream list and choose another source. Football Hub only matches the event metadata; it cannot verify the video carried by a third-party source.

#### Privacy and security

The Sports Streams manifest can contain a token in its URL. Treat it like a private credential. Football Hub needs the URL for catalogue matching, but you should redact the token before sharing diagnostics publicly.

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
