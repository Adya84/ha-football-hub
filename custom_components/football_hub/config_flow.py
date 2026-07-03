"""Config flow for Football Hub."""

from __future__ import annotations

import voluptuous as vol

from homeassistant import config_entries

from .const import DOMAIN
from .competitions import COMPETITIONS, DEFAULT_SEASON, SEASONS


class FootballHubConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Football Hub."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle the initial step."""
        errors = {}

        if user_input is not None:
            competition_key = user_input["competition"]
            season = user_input["season"]

            competition = COMPETITIONS.get(competition_key)

            if competition is None:
                errors["competition"] = "invalid_competition"
            else:
                await self.async_set_unique_id(
                    f"{competition_key}_{season}_{user_input['provider_mode']}"
                )
                self._abort_if_unique_id_configured()

                return self.async_create_entry(
                    title=f"Football Hub - {competition['name']} {SEASONS.get(season, season)}",
                    data=user_input,
                )

        data_schema = vol.Schema(
            {
                vol.Required("api_key"): str,
                vol.Required("competition", default="premier_league"): vol.In(
                    {key: value["name"] for key, value in COMPETITIONS.items()}
                ),
                vol.Required("season", default=DEFAULT_SEASON): vol.In(SEASONS),
                vol.Required("provider_mode", default="main"): vol.In(
                    {
                        "main": "Main Provider",
                        "viewer": "Viewer Device",
                    }
                ),
            }
        )

        return self.async_show_form(
            step_id="user",
            data_schema=data_schema,
            errors=errors,
        )
