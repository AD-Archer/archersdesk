// Client-safe helpers that translate between the canonical multi-device
// `Settings` document and the flattened `ViewSettings` a single browser renders
// (the active device's fields hoisted to the top, alongside the global fields).
// No sqlite import — safe to use from client components.

import type { Device, Settings, ViewSettings } from "./types";

/** Flatten `settings` for the given active `device` into the render view-model. */
export function toView(settings: Settings, device: Device): ViewSettings {
  return {
    deviceId: device.id,
    deviceName: device.name,
    theme: device.theme,
    location: device.location,
    layout: device.layout,
    standby: device.standby,
    presence: device.presence,
    units: settings.units,
    lastfm: settings.lastfm,
    integrations: settings.integrations,
    embeds: settings.embeds,
    alarms: settings.alarms,
    worldclock: settings.worldclock,
    calendars: settings.calendars,
    showEpicInAgenda: settings.showEpicInAgenda,
    presets: settings.presets,
    devices: settings.devices,
    version: settings.version,
  };
}

/** Fold an edited view back into a canonical `Settings`. The device list comes
 *  from `view.devices` (so device add/rename/delete survive); the active
 *  device's theme/location/layout/standby are overwritten from the top-level
 *  edits. `presence` is left as-is — it is owned by /api/presence, never by a
 *  settings write. */
export function fromView(view: ViewSettings): Settings {
  const devices = view.devices.map((d) =>
    d.id === view.deviceId
      ? { ...d, theme: view.theme, location: view.location, layout: view.layout, standby: view.standby }
      : d
  );
  return {
    version: view.version,
    devices,
    presets: view.presets,
    units: view.units,
    lastfm: view.lastfm,
    integrations: view.integrations,
    embeds: view.embeds,
    alarms: view.alarms,
    worldclock: view.worldclock,
    calendars: view.calendars,
    showEpicInAgenda: view.showEpicInAgenda,
  };
}
