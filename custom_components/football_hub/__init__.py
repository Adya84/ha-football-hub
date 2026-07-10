"""Football Hub integration setup."""

from __future__ import annotations

from pathlib import Path

from homeassistant.components.frontend import async_register_built_in_panel
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall

from .api.coordinator import FootballHubCoordinator
from .const import DOMAIN

PLATFORMS = ["sensor"]

PANEL_URL = "football-hub"
PANEL_NAME = "football-hub-panel"
PANEL_VERSION = "0.2.3"
PANEL_STATIC_URL = "/football_hub/football-hub-panel.js"
PANEL_MODULE_URL = f"{PANEL_STATIC_URL}?v={PANEL_VERSION}"
PANEL_SCRIPT_PATH = Path(__file__).parent / "frontend" / "football-hub-panel.js"
PANEL_BACKGROUND_URL = "/football_hub/football-hub-background.png"
PANEL_BACKGROUND_PATH = Path(__file__).parent / "frontend" / "football-hub-background.png"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up Football Hub and register its sidebar panel."""
    hass.data.setdefault(DOMAIN, {})

    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                PANEL_STATIC_URL,
                str(PANEL_SCRIPT_PATH),
                False,
            ),
            StaticPathConfig(
                PANEL_BACKGROUND_URL,
                str(PANEL_BACKGROUND_PATH),
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

    async def async_select_live_team(call: ServiceCall) -> None:
        """Select the supported team for detailed live polling."""
        team = str(call.data.get("team") or "").strip()
        for runtime in hass.data.get(DOMAIN, {}).values():
            if not isinstance(runtime, dict):
                continue
            coordinator = runtime.get("coordinator")
            if coordinator is not None:
                await coordinator.async_set_supported_team(team)

    if not hass.services.has_service(DOMAIN, "select_live_team"):
        hass.services.async_register(
            DOMAIN,
            "select_live_team",
            async_select_live_team,
        )

    async def async_select_competition(call: ServiceCall) -> None:
        """Switch the active competition for a config entry."""
        competition_key = str(call.data.get("competition") or "").strip()
        entry_id = str(call.data.get("entry_id") or "").strip()
        for runtime_entry_id, runtime in hass.data.get(DOMAIN, {}).items():
            if entry_id and runtime_entry_id != entry_id:
                continue
            if not isinstance(runtime, dict):
                continue
            coordinator = runtime.get("coordinator")
            if coordinator is not None:
                await coordinator.async_set_competition(competition_key)

    if not hass.services.has_service(DOMAIN, "select_competition"):
        hass.services.async_register(
            DOMAIN,
            "select_competition",
            async_select_competition,
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

