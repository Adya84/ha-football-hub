"""Football Hub integration setup."""

from __future__ import annotations

from pathlib import Path

from homeassistant.components.frontend import async_register_built_in_panel
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .api.coordinator import FootballHubCoordinator
from .const import DOMAIN

PLATFORMS = ["sensor"]

PANEL_URL = "football-hub"
PANEL_NAME = "football-hub-panel"
PANEL_VERSION = "0.2.0"
PANEL_STATIC_URL = "/football_hub/football-hub-panel.js"
PANEL_MODULE_URL = f"{PANEL_STATIC_URL}?v={PANEL_VERSION}"
PANEL_SCRIPT_PATH = Path(__file__).parent / "frontend" / "football-hub-panel.js"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up Football Hub and register its sidebar panel."""
    hass.data.setdefault(DOMAIN, {})

    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                PANEL_STATIC_URL,
                str(PANEL_SCRIPT_PATH),
                False,
            )
        ]
    )

    async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title="Football Hub",
        sidebar_icon="mdi:soccer",
        frontend_url_path=PANEL_URL,
        config={
            "_panel_custom": {
                "name": PANEL_NAME,
                "module_url": PANEL_MODULE_URL,
                "embed_iframe": False,
                "trust_external": False,
            }
        },
        require_admin=False,
        update=PANEL_URL in hass.data.get("frontend_panels", {}),
    )

    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up a Football Hub config entry."""
    hass.data.setdefault(DOMAIN, {})

    coordinator = FootballHubCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()

    hass.data[DOMAIN][entry.entry_id] = {
        "coordinator": coordinator,
    }

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a Football Hub config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)

    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)

    return unload_ok
