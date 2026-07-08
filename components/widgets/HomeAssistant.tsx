"use client";

// Home Assistant — a pick-your-entities status list, not a full dashboard.
// Toggleable domains (light/switch/input_boolean/fan) get a lightbulb button
// that lights up when the entity is on; tapping it toggles. State updates
// optimistically (so the icon flips instantly) and a forced refetch reconciles
// against the real state right after, since the plain poll lags ~20s.

import { useEffect, useState } from "react";
import { WIDGET_INFO } from "@/lib/types";
import { Empty, MI, Shell, integrationGate, useIntegration, useIntegrationAction } from "./kit";
import type { WidgetProps } from "./registry";

interface HAEntity {
  entityId: string;
  name: string;
  state: string;
  unit: string;
  domain: string;
  toggleable: boolean;
}

interface HomeAssistantData {
  entities: HAEntity[];
}

export function HomeAssistantWidget({ wide, settings, integrationSettings }: WidgetProps) {
  const [refresh, setRefresh] = useState(0);
  const payload = useIntegration<HomeAssistantData>("homeassistant", integrationSettings ?? settings, 20 * 1000, refresh);
  const act = useIntegrationAction("homeassistant");
  const [pending, setPending] = useState<Set<string>>(new Set());
  // entityId → optimistic state, cleared once the real poll confirms it
  const [override, setOverride] = useState<Record<string, string>>({});
  const gate = integrationGate(payload, "checking the house…");

  const entities = payload?.data?.entities;
  useEffect(() => {
    if (!entities) return;
    setOverride((o) => {
      let changed = false;
      const next = { ...o };
      for (const e of entities) {
        if (e.entityId in next && next[e.entityId] === e.state) {
          delete next[e.entityId];
          changed = true;
        }
      }
      return changed ? next : o;
    });
  }, [entities]);

  if (gate)
    return (
      <Shell icon={WIDGET_INFO.homeassistant.icon} label="home assistant">
        {gate}
      </Shell>
    );

  const shown = payload!.data!.entities.slice(0, wide ? 8 : 3);

  async function toggle(e: HAEntity) {
    const current = override[e.entityId] ?? e.state;
    const next = current === "on" ? "off" : "on";
    setOverride((o) => ({ ...o, [e.entityId]: next }));
    setPending((cur) => new Set(cur).add(e.entityId));
    await act("toggle", { entityId: e.entityId });
    setPending((cur) => {
      const s = new Set(cur);
      s.delete(e.entityId);
      return s;
    });
    setRefresh((x) => x + 1); // force an authoritative refetch
  }

  return (
    <Shell icon={WIDGET_INFO.homeassistant.icon} label="home assistant">
      <span className="hero-tap-icon">
        <MI name={WIDGET_INFO.homeassistant.icon} className="hero-tap-mi" />
      </span>
      {shown.length === 0 ? (
        <Empty>no entities matched</Empty>
      ) : (
        <div className="ha-list">
          {shown.map((e) => {
            const state = override[e.entityId] ?? e.state;
            const on = state === "on";
            return (
              <div key={e.entityId} className="ha-row">
                <div className="ha-row-text">
                  <span className="ha-row-name">{e.name}</span>
                  {!e.toggleable && (
                    <span className="ha-row-state">
                      {e.state}
                      {e.unit ? ` ${e.unit}` : ""}
                    </span>
                  )}
                </div>
                {e.toggleable && (
                  <button
                    className={`ha-bulb${on ? " on" : ""}`}
                    disabled={pending.has(e.entityId)}
                    onClick={() => toggle(e)}
                    aria-label={`turn ${on ? "off" : "on"} ${e.name}`}
                    aria-pressed={on}
                  >
                    <MI name="lightbulb" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
