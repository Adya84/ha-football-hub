"""Config flow for Football Hub."""

from __future__ import annotations

import voluptuous as vol

from homeassistant import config_entries

from .const import DOMAIN
from .competitions import DEFAULT_SEASON, SEASONS


class FootballHubConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Set up Football Hub with only an API key."""

    VERSION = 3

    async def async_step_user(self, user_input=None):
        """Collect the API key and use safe starting defaults."""
        if user_input is not None:
            await self.async_set_unique_id("football_hub")
            self._abort_if_unique_id_configured()

            return self.async_create_entry(
                title=f"Football Hub - {SEASONS.get(DEFAULT_SEASON, DEFAULT_SEASON)}",
                data={
                    "api_key": str(user_input["api_key"]).strip(),
                    "country": "England",
                    "competition": "premier_league",
                    "season": DEFAULT_SEASON,
                    "provider_mode": "main",
                },
            )

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({vol.Required("api_key"): str}),
        )
