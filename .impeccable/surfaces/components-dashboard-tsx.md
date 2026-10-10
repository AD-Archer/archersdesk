---
version: 1
slug: "components-dashboard-tsx"
primary_target: "components/Dashboard.tsx"
related_targets: ["components/Standby.tsx","components/SettingsSheet.tsx","components/Remote.tsx"]
---

Scope: the desk display (standby page, widget pages, controls) plus settings, phone remote, macapad editor and overlays. Mode: Operate (glance-and-tap ambient display).

Audience: Archer and household, Echo Show 5 at a desk/bed, iPhone as remote. Job: read the time and one thing at a glance from across a room; set it up without dev-speak.

## Direction contract

THESIS: The desk is iOS StandBy on any screen: two widgets on pure black, no cards, each owning its half with one vivid tint. Refuses the dashboard-of-cards grid with corner chrome.

OWN-WORLD: #000 ground; iOS dark system tints (green #30D158 clock, red #FF453A dates, orange #FF9F0A second hand/timer, yellow, blue, purple, pink); Nunito 900–1000 rounded numerals; system sans for text; iOS grouped lists (#1C1C1E rows, 10px radius) and pill buttons off-board; night = everything red.

STORY: The visitor sees the time instantly, then the second widget; taps to reveal controls; swipes for more.

FIRST VIEWPORT: Standby: rounded digits fill ~85% of the height, two-tone green, two white colon dots overlapping; small gray weather/alarm line top-left. Controls hidden until tap: a translucent pill top-right (settings, remote, fullscreen), page dots right edge.

FORM: iOS StandBy, brief-pinned over roll; seed 0605e3b2.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
