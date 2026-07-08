"use client";

// Home Assistant — a pick-your-entities status list, not a full dashboard.
// Toggleable domains (light/switch/input_boolean/fan) get a small toggle
// control rather than making the whole row a button, so most of the row
// stays swipeable (see Status.tsx's AwayUntil/Vibe fix for why that matters).

import { useState } from "react";
import { WIDGET_INFO } from "@/lib/types";
import { Empty, Shell, integrationGate, useIntegration, useIntegrationAction } from "./kit";
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
  const payload = useIntegration<HomeAssistantData>("homeassistant", integrationSettings ?? settings, 20 * 1000);
  const act = useIntegrationAction("homeassistant");
  const [pending, setPending] = useState<Set<string>>(new Set());
  const gate = integrationGate(payload, "checking the house…");

  if (gate)
    return (
      <Shell icon={WIDGET_INFO.homeassistant.icon} label="home assistant">
        {gate}
      </Shell>
    );

  const shown = payload!.data!.entities.slice(0, wide ? 8 : 3);

  async function toggle(entityId: string) {
    setPending((cur) => new Set(cur).add(entityId));
    await act("toggle", { entityId });
    setPending((cur) => {
      const next = new Set(cur);
      next.delete(entityId);
      return next;
    });
  }

  return (
    <Shell icon={WIDGET_INFO.homeassistant.icon} label="home assistant">
      {shown.length === 0 ? (
        <Empty>no entities matched</Empty>
      ) : (
        <div className="ha-list">
          {shown.map((e) => (
            <div key={e.entityId} className="ha-row">
              <div className="ha-row-text">
                <span className="ha-row-name">{e.name}</span>
                <span className="ha-row-state">
                  {e.state}
                  {e.unit ? ` ${e.unit}` : ""}
                </span>
              </div>
              {e.toggleable && (
                <button
                  className={`ha-toggle${e.state === "on" ? " on" : ""}`}
                  disabled={pending.has(e.entityId)}
                  onClick={() => toggle(e.entityId)}
                  aria-label={`toggle ${e.name}`}
                >
                  <span className="ha-toggle-knob" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
