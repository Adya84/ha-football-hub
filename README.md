# ⚽ Football Hub for Home Assistant

Football Hub is a modern Home Assistant integration that brings football competitions from around the world into a single, dedicated dashboard.

Track fixtures, live matches, results, league tables, statistics, line-ups and player information from one easy-to-use interface, with support for multiple countries and competitions.

---

## ✨ Features

- ⚽ Dedicated Football Hub sidebar panel
- 🌍 Country and competition selector
- 🔴 Live Match Centre with automatic updates
- ⭐ Favourite team selection
- 📅 Fixtures and results
- 📊 Live league tables
- 📈 Match statistics
- 🟨 Yellow & red card totals
- 🎯 Goalscorers and player statistics
- 👥 Team line-ups
- 🏟 Team Centre
- ❤️ Community Supporters page
- 🌎 Country flags throughout the interface
- 💾 Persistent league, page and team selections
- 🔄 Automatically restores your previous session
- 📱 Responsive interface for desktop and mobile
- 🧩 Fully HACS compatible

---

# 🌍 Supported Competitions

Football Hub supports leagues from across Europe and beyond.

Current English competitions include:

- Premier League
- Championship
- League One
- League Two
- National League

Additional countries and leagues are available through the built-in country selector.

> Competition availability depends on your configured football data provider and API subscription.

---

# 🔴 Live Match Centre

Football Hub automatically prioritises your chosen supported team.

Features include:

- Live scores
- Match timer
- Goals
- Cards
- Statistics
- Match events
- Line-ups
- Live league positions
- Multiple simultaneous live matches

Polling automatically speeds up during live matches and slows down when football isn't being played, helping reduce unnecessary API requests.

---

# ❤️ Supporters

Football Hub includes a built-in Community Supporters page.

Supporters are recognised with:

- Name
- Country
- National flag
- Optional personal message

Premium supporters also receive additional recognition inside the integration.

---

# 📦 Requirements

- Home Assistant
- HACS (recommended)
- Supported Football API account
- API key

---

# 🚀 Installation

## HACS (Recommended)

1. Open **HACS**
2. Add this repository as a **Custom Repository**
3. Search for **Football Hub**
4. Install the integration
5. Restart Home Assistant
6. Navigate to:

```
Settings
→ Devices & Services
→ Add Integration
→ Football Hub
```

7. Enter your API details.

---

## Manual Installation

1. Download the latest release.
2. Copy:

```
custom_components/football_hub
```

into your Home Assistant installation.

3. Restart Home Assistant.
4. Add Football Hub via **Devices & Services**.

---

# ⚙ Configuration

After installation simply open Football Hub from the Home Assistant sidebar.

Choose:

- Country
- Competition
- Supported Team

Your selections are automatically remembered and restored after Home Assistant restarts.

---

# 🛠 Active Development

Football Hub is under continuous development.

Upcoming improvements include:

- More competitions
- Additional statistics
- More player data
- Historical records
- Enhanced live match coverage
- UI improvements
- Performance optimisations

Suggestions and feature requests are always welcome.

---

# 🐞 Issues & Feature Requests

Found a bug?

Have an idea?

Please open an Issue on GitHub.

---

# ⭐ Support the Project

Football Hub is developed in spare time and maintained for the Home Assistant community.

If you'd like to support future development you can do so directly from the built-in **Supporters** page inside Football Hub.

Every contribution helps fund:

- API costs
- Development
- Testing
- New features
- Ongoing maintenance

---

# 📚 Repository

https://github.com/Adya84/ha-football-hub

---

# ⚠ Disclaimer

Football Hub is an independent Home Assistant integration.

It is **not affiliated with, endorsed by, sponsored by or officially connected with**:

- Home Assistant
- HACS
- API-Football
- football-data.org
- FIFA
- UEFA
- The Premier League
- The English Football League
- The Scottish Professional Football League
- LaLiga
- Bundesliga
- Serie A
- Ligue 1
- Major League Soccer

or any football governing body, competition organiser, club, broadcaster or rights holder.

All competition names, club names, logos and trademarks remain the property of their respective owners.

---

# 📄 Licence

Football Hub is released under the licence included in this repository.

See the **LICENSE** file for full details.
