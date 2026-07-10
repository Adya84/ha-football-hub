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

    # European top divisions.
    "la_liga": _league("La Liga", "Spain", 140),
    "bundesliga": _league("Bundesliga", "Germany", 78),
    "serie_a": _league("Serie A", "Italy", 135),
    "ligue_1": _league("Ligue 1", "France", 61),
    "eredivisie": _league("Eredivisie", "Netherlands", 88),
    "primeira_liga": _league("Primeira Liga", "Portugal", 94),
    "belgian_pro_league": _league("Jupiler Pro League", "Belgium", 144),
    "austrian_bundesliga": _league("Bundesliga", "Austria", 218),
    "swiss_super_league": _league("Super League", "Switzerland", 207),
    "super_lig": _league("Süper Lig", "Türkiye", 203),
    "greek_super_league": _league("Super League 1", "Greece", 197),
    "danish_superliga": _league("Superliga", "Denmark", 119),
    "eliteserien": _league("Eliteserien", "Norway", 103),
    "allsvenskan": _league("Allsvenskan", "Sweden", 113),
    "veikkausliiga": _league("Veikkausliiga", "Finland", 244),
    "besta_deild": _league("Besta deild karla", "Iceland", 164),
    "ekstraklasa": _league("Ekstraklasa", "Poland", 106),
    "czech_first_league": _league("Chance Liga", "Czech Republic", 345),
    "croatian_hnl": _league("HNL", "Croatia", 210),
    "serbian_super_liga": _league("Super Liga", "Serbia", 286),
    "romanian_liga_1": _league("Liga I", "Romania", 283),
    "ukrainian_premier_league": _league("Premier League", "Ukraine", 333),
    "bulgarian_first_league": _league("First League", "Bulgaria", 172),
    "hungarian_nb_1": _league("NB I", "Hungary", 271),
    "slovak_super_liga": _league("Niké Liga", "Slovakia", 332),
    "slovenian_prva_liga": _league("PrvaLiga", "Slovenia", 373),
    "cypriot_first_division": _league("1. Division", "Cyprus", 318),
    "israeli_premier_league": _league("Ligat Ha'al", "Israel", 383),
    "russian_premier_league": _league("Premier League", "Russia", 235),
    "kazakhstan_premier_league": _league("Premier League", "Kazakhstan", 389),
    "azerbaijan_premier_league": _league("Premyer Liqa", "Azerbaijan", 419),
    "armenian_premier_league": _league("Premier League", "Armenia", 342),
    "georgian_erovnuli_liga": _league("Erovnuli Liga", "Georgia", 327),
    "belarusian_premier_league": _league("Premier League", "Belarus", 95),
    "estonian_meistriliiga": _league("Meistriliiga", "Estonia", 329),
    "latvian_virsliga": _league("Virsliga", "Latvia", 365),
    "lithuanian_a_lyga": _league("A Lyga", "Lithuania", 362),
    "moldovan_super_liga": _league("Super Liga", "Moldova", 394),
    "albanian_superliga": _league("Superliga", "Albania", 310),
    "bosnian_premier_league": _league("Premijer Liga", "Bosnia and Herzegovina", 315),
    "montenegrin_first_league": _league("First League", "Montenegro", 355),
    "macedonian_first_league": _league("First League", "North Macedonia", 371),
    "maltese_premier_league": _league("Premier League", "Malta", 392),
}
