// What an MCP token may do. Client-safe: the settings sheet lists these when
// a token is made, and the docs print them.

export const MCP_SCOPES = ["read", "screens", "alarms", "calendars", "time", "accounts"] as const;

export type McpScope = (typeof MCP_SCOPES)[number];

export const MCP_SCOPE_INFO: Record<McpScope, { label: string; blurb: string }> = {
  read: { label: "Read", blurb: "See screens, pages, alarms, calendars and which accounts are set up. Never secrets." },
  screens: {
    label: "Screens",
    blurb: "Pages, cards, set times, location, away and each screen's own options.",
  },
  alarms: { label: "Alarms", blurb: "Add, change and remove alarms." },
  calendars: { label: "Calendars", blurb: "Add, change and remove calendar feeds." },
  time: { label: "Time", blurb: "World clocks and units." },
  accounts: {
    label: "Accounts",
    blurb: "Set the usernames, addresses and keys widgets sign in with. Keys can be written, never read back.",
  },
};

/** A token as the settings sheet sees it: never the token itself. */
export interface McpTokenInfo {
  id: string;
  name: string;
  scopes: McpScope[];
  screens: string[]; // device ids; empty = every screen
  createdAt: number;
  lastUsedAt: number | null;
}
