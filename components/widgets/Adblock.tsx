"use client";

// AdGuard Home + Pi-hole — same shape once normalized server-side (see
// lib/integrations.ts), so one component renders both.

import { WIDGET_INFO } from "@/lib/types";
import { BigStat, MiniList, Shell, integrationGate, useIntegration } from "./kit";
import type { WidgetProps } from "./registry";

interface AdblockData {
  queriesToday: number;
  blockedToday: number;
  blockedPct: number;
  protectionEnabled: boolean;
  topBlocked: Array<{ domain: string; count: number }>;
}

function AdblockWidget({
  service,
  wide,
  settings,
  integrationSettings,
}: WidgetProps & { service: "adguard" | "pihole" }) {
  const payload = useIntegration<AdblockData>(service, integrationSettings ?? settings, 60 * 1000);
  const gate = integrationGate(payload, "checking the filter…");

  return (
    <Shell icon={WIDGET_INFO[service].icon} label={WIDGET_INFO[service].label}>
      {gate ?? (
        <>
          <BigStat
            value={payload!.data!.blockedPct.toFixed(1)}
            unit="% blocked"
            caption={
              <>
                {payload!.data!.blockedToday.toLocaleString()} / {payload!.data!.queriesToday.toLocaleString()}{" "}
                queries today
                {!payload!.data!.protectionEnabled && " · protection off"}
              </>
            }
          />
          {wide && payload!.data!.topBlocked.length > 0 && (
            <MiniList
              rows={payload!.data!.topBlocked.map((d) => ({
                key: d.domain,
                left: d.domain,
                right: <b>{d.count.toLocaleString()}</b>,
              }))}
            />
          )}
        </>
      )}
    </Shell>
  );
}

export const AdguardWidget = (p: WidgetProps) => <AdblockWidget {...p} service="adguard" />;
export const PiholeWidget = (p: WidgetProps) => <AdblockWidget {...p} service="pihole" />;
