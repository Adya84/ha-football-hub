"""Football Hub competition catalogue.

England includes the professional pyramid through the National League.
Other European countries expose their top domestic division.
"""


def _league(name: str, country: str, league_id: int) -> dict:
    return {
        "name": name,
        "country": country,
        "league_id": league_id,
        "type": "league",
        "has_table": True,
        "has_matchweeks": True,
    }


COMPETITIONS = {
    # England — through the former Conference.
    "premier_league": _league("Premier League", "England", 39),
    "championship": _league("Championship", "England", 40),
    "league_one": _league("League One", "England", 41),
    "league_two": _league("League Two", "England", 42),
    "national_league": _league("National League", "England", 43),

    # Home nations and Ireland.
    "scottish_premiership": _league("Scottish Premiership", "Scotland", 179),
    "cymru_premier": _league("Cymru Premier", "Wales", 110),
    "northern_ireland_premiership": _league("Premiership", "Northern Ireland", 408),
    "league_of_ireland": _league("Premier Division", "Ireland", 357),

    # Leading European top divisions.
    "la_liga": _league("La Liga", "Spain", 140),
    "bundesliga": _league("Bundesliga", "Germany", 78),
    "serie_a": _league("Serie A", "Italy", 135),
    "ligue_1": _league("Ligue 1", "France", 61),
    "eredivisie": _league("Eredivisie", "Netherlands", 88),
    "primeira_liga": _league("Primeira Liga", "Portugal", 94),
    "belgian_pro_league": _league("Jupiler Pro League", "Belgium", 144),
    "super_lig": _league("Süper Lig", "Türkiye", 203),
}
