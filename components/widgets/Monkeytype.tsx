"use client";

import { WIDGET_INFO } from "@/lib/types";
import { BigStat, Empty, MI, MiniList, Shell, StatRow, integrationGate, useIntegration } from "./kit";
import type { WidgetProps } from "./registry";

interface MonkeytypeData {
  username: string;
  best60: {
    wpm: number;
    raw: number | null;
    acc: number | null;
    consistency: number | null;
    timestamp: number | null;
    language: string;
  } | null;
  last: {
    wpm: number;
    raw: number | null;
    acc: number | null;
    mode: string;
    mode2: string | number;
    timestamp: number | null;
    isPb: boolean;
  } | null;
  totals: { tests: number; hours: number | null };
  streak: { current: number; max: number } | null;
}

function testName(last: MonkeytypeData["last"]) {
  if (!last?.mode) return "last test";
  return `${last.mode}${last.mode2 ? ` ${last.mode2}` : ""}`;
}

export function MonkeytypeWidget({ settings, integrationSettings, wide }: WidgetProps) {
  const source = integrationSettings ?? settings;
  const hasApeKey = Boolean(source.integrations.monkeytype?.apeKey);
  const payload = useIntegration<MonkeytypeData>("monkeytype", source, 10 * 60 * 1000, undefined, hasApeKey);
  const gate = integrationGate(payload, "warming up the keyboard…");

  return (
    <Shell
      icon={WIDGET_INFO.monkeytype.icon}
      label={`monkeytype${payload?.data?.username ? ` · ${payload.data.username}` : ""}`}
    >
      {!hasApeKey ? (
        <Empty>add your monkeytype ape key in settings → accounts</Empty>
      ) : gate ?? (
        <>
          <div className="monkeytype-hero">
            <span className="monkeytype-hero-icon">
              <MI name={WIDGET_INFO.monkeytype.icon} className="monkeytype-hero-mi" />
            </span>
            <BigStat
              value={Math.round(payload!.data!.best60?.wpm ?? payload!.data!.last?.wpm ?? 0)}
              unit={payload!.data!.best60 ? "wpm pb" : "wpm last"}
              caption={
                payload!.data!.best60?.acc
                  ? `60s · ${payload!.data!.best60.acc.toFixed(1)}% acc`
                  : testName(payload!.data!.last)
              }
            />
          </div>
          <StatRow
            items={[
              ...(payload!.data!.streak ? [{ label: "streak", value: payload!.data!.streak.current }] : []),
              ...(payload!.data!.totals.tests
                ? [{ label: "tests", value: payload!.data!.totals.tests.toLocaleString() }]
                : []),
              ...(payload!.data!.last
                ? [{ label: payload!.data!.last.isPb ? "last pb" : "last", value: Math.round(payload!.data!.last.wpm) }]
                : []),
            ]}
          />
          {wide && (
            <MiniList
              rows={[
                ...(payload!.data!.best60
                  ? [
                      {
                        key: "best",
                        left: "60s best",
                        right: (
                          <>
                            <b>{payload!.data!.best60.wpm.toFixed(1)} wpm</b>
                            {payload!.data!.best60.raw !== null && <small>{payload!.data!.best60.raw.toFixed(1)} raw</small>}
                          </>
                        ),
                      },
                    ]
                  : []),
                ...(payload!.data!.last
                  ? [
                      {
                        key: "last",
                        left: testName(payload!.data!.last),
                        right: (
                          <>
                            <b>{payload!.data!.last.wpm.toFixed(1)} wpm</b>
                            {payload!.data!.last.acc !== null && <small>{payload!.data!.last.acc.toFixed(1)}% acc</small>}
                          </>
                        ),
                      },
                    ]
                  : []),
                ...(payload!.data!.streak
                  ? [
                      {
                        key: "streak",
                        left: "best streak",
                        right: <b>{payload!.data!.streak.max} days</b>,
                      },
                    ]
                  : []),
              ]}
            />
          )}
        </>
      )}
    </Shell>
  );
}
