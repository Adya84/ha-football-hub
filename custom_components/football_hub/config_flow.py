import voluptuous as vol

from homeassistant import config_entries

from .const import DOMAIN
from .competitions import COMPETITIONS, DEFAULT_SEASON, SEASONS


class FootballHubConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Football Hub."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Initial setup step."""

        errors = {}

        if user_input is not None:
            competition_key = user_input["competition"]
            season = user_input["season"]

            competition = COMPETITIONS.get(competition_key)

            if not competition:
                errors["competition"] = "invalid_competition"
            else:
                title = f"Football Hub - {competition['name']} {SEASONS.get(season, season)}"

                return self.async_create_entry(
                    title=title,
                    data={
                        "api_key": user_input["api_key"],
                        "competition": competition_key,
                        "season": season,
                        "provider_mode": user_input["provider_mode"],
                    },
                )

        schema = vol.Schema(
            {
                vol.Required("api_key"): str,
                vol.Required(
                    "competition",
                    default="premier_league",
                ): vol.In(
                    {
                        key: value["name"]
                        for key, value in COMPETITIONS.items()
                    }
                ),
                vol.Required(
                    "season",
                    default=DEFAULT_SEASON,
                ): vol.In(SEASONS),
                vol.Required(
                    "provider_mode",
                    default="main",
                ): vol.In(
                    {
                        "main": "Main Provider",
                        "viewer": "Viewer Device",
                    }
                ),
            }
        )

        return self.async_show_form(
            step_id="user",
            data_schema=schema,
            errors=errors,
        )
