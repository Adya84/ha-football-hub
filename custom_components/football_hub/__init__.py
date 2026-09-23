"""Football Hub integration setup."""
from __future__ import annotations

from pathlib import Path

from homeassistant.components.frontend import async_register_built_in_panel
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from .api.coordinator import FootballHubCoordinator
from .const import DOMAIN

PLATFORMS = ["sensor"]
PANEL_URL = "football-hub"
PANEL_NAME = "football-hub-panel"
PANEL_VERSION = "0.8.6-beta.10"
PANEL_STATIC_URL = "/football_hub/football-hub-panel.js"
PANEL_MODULE_URL = f"{PANEL_STATIC_URL}?v={PANEL_VERSION}"
PANEL_SCRIPT_PATH = Path(__file__).parent / "frontend" / "football-hub-panel.js"
PANEL_BACKGROUND_URL = "/football_hub/football-hub-background.png"
PANEL_BACKGROUND_PATH = Path(__file__).parent / "frontend" / "football-hub-background.png"
PANEL_LOGO_URL = "/football_hub/football-hub-logo.png"
PANEL_LOGO_PATH = Path(__file__).parent / "frontend" / "football-hub-logo.png"
PANEL_SOUNDS_URL = "/football_hub/sounds"
PANEL_SOUNDS_PATH = Path(__file__).parent / "frontend" / "sounds"


async def async_migrate_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    data = dict(entry.data)
    data.setdefault("country", "England")
    data.setdefault("competition", "premier_league")
    data.setdefault("season", 2026)
    data["provider_mode"] = "fm"
    hass.config_entries.async_update_entry(entry, data=data, version=3)
    return True


def async_cleanup_obsolete_favourite_devices(
    hass: HomeAssistant, entry: ConfigEntry, favourites: list[dict]
) -> None:
    """Remove sensors for clubs that are no longer saved favourites."""
    device_registry = dr.async_get(hass)
    entity_registry = er.async_get(hass)
    device_prefix = f"{entry.entry_id}_"
    entity_prefix = f"{entry.entry_id}_favourite_"
    active_device_identifiers = {
        f"{entry.entry_id}_{str(favourite.get('home_competition') or favourite.get('competition') or '')}_{str(favourite.get('team') or '').casefold()}"
        for favourite in favourites
        if str(favourite.get("team") or "").strip()
    }

    for device in list(dr.async_entries_for_config_entry(device_registry, entry.entry_id)):
        favourite_identifiers = {
            identifier
            for domain, identifier in device.identifiers
            if domain == DOMAIN and identifier.startswith(device_prefix)
        }
        if not favourite_identifiers or favourite_identifiers & active_device_identifiers:
            continue
        for entity in er.async_entries_for_device(
            entity_registry, device.id, include_disabled_entities=True
        ):
            if entity.unique_id.startswith(entity_prefix):
                entity_registry.async_remove(entity.entity_id)
        device_registry.async_remove_device(device.id)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    hass.data.setdefault(DOMAIN, {})
    await hass.http.async_register_static_paths([
        StaticPathConfig(PANEL_STATIC_URL, str(PANEL_SCRIPT_PATH), False),
        StaticPathConfig(PANEL_BACKGROUND_URL, str(PANEL_BACKGROUND_PATH), False),
        StaticPathConfig(PANEL_LOGO_URL, str(PANEL_LOGO_PATH), False),
        StaticPathConfig(PANEL_SOUNDS_URL, str(PANEL_SOUNDS_PATH), False),
    ])
    async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title="Football Hub",
        sidebar_icon="mdi:soccer",
        frontend_url_path=PANEL_URL,
        config={"_panel_custom": {"name": PANEL_NAME, "module_url": PANEL_MODULE_URL, "embed_iframe": False, "trust_external": False}},
        require_admin=False,
        update=PANEL_URL in hass.data.get("frontend_panels", {}),
    )

    async def _coordinators(call: ServiceCall):
        entry_id = str(call.data.get("entry_id") or "").strip()
        for runtime_entry_id, runtime in list(hass.data.get(DOMAIN, {}).items()):
            if entry_id and runtime_entry_id != entry_id:
                continue
            if isinstance(runtime, dict) and runtime.get("coordinator") is not None:
                yield runtime["coordinator"]

    async def async_select_live_team(call: ServiceCall) -> None:
        team = str(call.data.get("team") or "").strip()
        async for coordinator in _coordinators(call):
            await coordinator.async_set_supported_team(team)

    async def async_select_live_match(call: ServiceCall) -> None:
        fixture_id = str(call.data.get("fixture_id") or "").strip()
        async for coordinator in _coordinators(call):
            await coordinator.async_set_selected_live_match(fixture_id)

    async def async_select_competition(call: ServiceCall) -> None:
        competition = str(call.data.get("competition") or "").strip()
        async for coordinator in _coordinators(call):
            await coordinator.async_set_competition(competition)

    async def async_select_cup(call: ServiceCall) -> None:
        competition = str(call.data.get("competition") or "").strip()
        async for coordinator in _coordinators(call):
            await coordinator.async_set_cup(competition)

    async def async_select_my_club(call: ServiceCall) -> None:
        team = str(call.data.get("team") or "").strip()
        async for coordinator in _coordinators(call):
            previous = len(coordinator.favourite_clubs)
            await coordinator.async_set_my_club(team)
            if len(coordinator.favourite_clubs) != previous:
                hass.async_create_task(hass.config_entries.async_reload(coordinator.entry.entry_id))

    async def async_remove_favourite_club(call: ServiceCall) -> None:
        team = str(call.data.get("team") or "").strip()
        competition = str(call.data.get("competition") or "").strip()
        async for coordinator in _coordinators(call):
            await coordinator.async_remove_favourite_club(team, competition)
            hass.async_create_task(hass.config_entries.async_reload(coordinator.entry.entry_id))

    async def async_save_ui_preferences(call: ServiceCall) -> None:
        preferences = call.data.get("preferences") or {}
        if isinstance(preferences, str):
            import json
            preferences = json.loads(preferences)
        async for coordinator in _coordinators(call):
            await coordinator.async_set_ui_preferences(preferences if isinstance(preferences, dict) else {})

    async def async_refresh(call: ServiceCall) -> None:
        async for coordinator in _coordinators(call):
            await coordinator.async_request_refresh()

    services = {
        "select_live_team": async_select_live_team,
        "select_live_match": async_select_live_match,
        "select_competition": async_select_competition,
        "select_cup": async_select_cup,
        "select_my_club": async_select_my_club,
        "remove_favourite_club": async_remove_favourite_club,
        "save_ui_preferences": async_save_ui_preferences,
        "refresh": async_refresh,
    }
    for name, handler in services.items():
        if not hass.services.has_service(DOMAIN, name):
            hass.services.async_register(DOMAIN, name, handler)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.setdefault(DOMAIN, {})
    coordinator = FootballHubCoordinator(hass, entry)
    async_cleanup_obsolete_favourite_devices(hass, entry, coordinator.favourite_clubs)
    await coordinator.async_config_entry_first_refresh()
    hass.data[DOMAIN][entry.entry_id] = {"coordinator": coordinator}
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)
    return unload_ok

