"use client";

// Archer-only: pulls weighted-grant hour totals from the stern grants api.
// Tap the hero to flip between the two headline stats, chess.com-style.

import { useEffect, useState } from "react";
import { WIDGET_INFO } from "@/lib/types";
import EditablePopup from "../EditablePopup";
import { ClickSettingsGlyph } from "./Integrations";
import { BigStat, MI, MiniList, Shell, integrationGate, useIntegration } from "./kit";
import type { WidgetProps } from "./registry";

interface ArcherHoursData {
  name: string;
  weightedGrantsTotal: number;
  hoursPerWeightedGrant: number;
  hoursShipped: number;
  roundedHoursShipped: number;
}

const ARCHER_MODE_KEY = "archersdesk.archerHoursMode";

const ARCHER_MODES = [
  { key: "projects", title: "weighted projects" },
  { key: "hours", title: "hours shipped" },
] as const;

type ArcherMode = (typeof ARCHER_MODES)[number]["key"];

export function ArcherHoursWidget({ settings, integrationSettings }: WidgetProps) {
  const payload = useIntegration<ArcherHoursData>("archerhours", integrationSettings ?? settings, 5 * 60 * 1000);
  const [mode, setMode] = useState<ArcherMode>("projects");
  const [open, setOpen] = useState(false);
  const gate = integrationGate(payload, "counting the hours…");

  useEffect(() => {
    const saved = window.localStorage.getItem(ARCHER_MODE_KEY);
    if (ARCHER_MODES.some((m) => m.key === saved)) setMode(saved as ArcherMode);
  }, []);

  if (gate)
    return (
      <Shell icon={WIDGET_INFO.archerhours.icon} label="archer hours">
        {gate}
      </Shell>
    );
  const d = payload!.data!;

  function pick(next: ArcherMode) {
    window.localStorage.setItem(ARCHER_MODE_KEY, next);
    setMode(next);
    setOpen(false);
  }

  return (
    <Shell icon={WIDGET_INFO.archerhours.icon} label="archer hours">
      <button className="archer-hero" onClick={() => setOpen(true)} aria-label="choose stat">
        <span className="archer-hero-icon">
          <MI name={WIDGET_INFO.archerhours.icon} className="archer-hero-mi" />
        </span>
        {mode === "projects" ? (
          <BigStat
            value={d.weightedGrantsTotal.toFixed(2)}
            unit="weighted projects"
            caption={`${d.hoursPerWeightedGrant}h per project`}
          />
        ) : (
          <BigStat
            value={d.roundedHoursShipped}
            unit="hours shipped"
            caption={`${d.hoursShipped.toFixed(1)} exact`}
          />
        )}
        <ClickSettingsGlyph />
      </button>
      <MiniList
        rows={
          mode === "projects"
            ? [{ key: "hours", left: "hours shipped", right: <b>{d.roundedHoursShipped}</b> }]
            : [{ key: "projects", left: "weighted projects", right: <b>{d.weightedGrantsTotal.toFixed(2)}</b> }]
        }
      />
      <EditablePopup open={open} title="show first" onClose={() => setOpen(false)}>
        <div className="mood-grid">
          {ARCHER_MODES.map((m) => (
            <button
              key={m.key}
              className={`mood-card${mode === m.key ? " on" : ""}`}
              onClick={() => pick(m.key)}
            >
              <b>{m.title}</b>
              <small>
                {m.key === "projects"
                  ? `${d.weightedGrantsTotal.toFixed(2)} projects`
                  : `${d.roundedHoursShipped} hours`}
              </small>
            </button>
          ))}
        </div>
      </EditablePopup>
    </Shell>
  );
}
