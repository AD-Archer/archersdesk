---
name: archer's desk
description: iOS StandBy on any screen; two widgets on pure black, one vivid tint each, red at night.
colors:
  black: "#000000"
  fill-1: "#1c1c1e"
  fill-2: "#2c2c2e"
  fill-3: "#3a3a3c"
  material: "rgba(44, 44, 46, 0.72)"
  label: "#ffffff"
  label-2: "rgba(235, 235, 245, 0.62)"
  label-3: "rgba(235, 235, 245, 0.32)"
  separator: "rgba(84, 84, 88, 0.6)"
  lit-white: "rgba(255, 255, 255, 0.94)"
  segment-on: "#636366"
  green: "#30d158"
  red: "#ff453a"
  orange: "#ff9f0a"
  yellow: "#ffd60a"
  cyan: "#64d2ff"
  blue: "#0a84ff"
  indigo: "#5e5ce6"
  purple: "#bf5af2"
  pink: "#ff375f"
  mint: "#63e6e2"
typography:
  display:
    fontFamily: "ui-rounded, SF Pro Rounded, Nunito, system-ui, sans-serif"
    fontSize: "min(56vw, 100vh)"
    fontWeight: 900
    lineHeight: 0.74
    letterSpacing: "0"
    fontFeature: "\"tnum\""
  figure:
    fontFamily: "ui-rounded, SF Pro Rounded, Nunito, system-ui, sans-serif"
    fontSize: "calc(var(--ps) * 0.24)"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontFeature: "\"tnum\""
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    letterSpacing: "-0.01em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.3
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.35
rounded:
  icon: "7px"
  field: "10px"
  row: "12px"
  tile: "20px"
  sheet: "22px"
  app-icon: "22.5%"
  pill: "999px"
  round: "50%"
spacing:
  hairline: "0.5px"
  xs: "8px"
  sm: "10px"
  md: "16px"
  lg: "20px"
  touch: "44px"
  row: "48px"
components:
  button-secondary:
    backgroundColor: "{colors.fill-2}"
    textColor: "{colors.label}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "44px"
  button-secondary-active:
    backgroundColor: "{colors.fill-3}"
  button-selected:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.label}"
    rounded: "{rounded.pill}"
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.label}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "50px"
  field:
    backgroundColor: "{colors.fill-1}"
    textColor: "{colors.label}"
    rounded: "{rounded.field}"
    padding: "0 14px"
    height: "44px"
  group:
    backgroundColor: "{colors.fill-1}"
    rounded: "{rounded.row}"
  group-row:
    textColor: "{colors.label}"
    padding: "0 16px"
    height: "48px"
  group-row-pressed:
    backgroundColor: "{colors.fill-2}"
  control-pill:
    backgroundColor: "{colors.material}"
    textColor: "{colors.label}"
    rounded: "{rounded.pill}"
    padding: "4px"
  remote-tile:
    backgroundColor: "{colors.fill-1}"
    textColor: "{colors.label}"
    rounded: "{rounded.tile}"
    padding: "12px 14px 13px"
  remote-tile-lit:
    backgroundColor: "{colors.lit-white}"
    textColor: "{colors.black}"
  remote-pill:
    backgroundColor: "{colors.fill-2}"
    textColor: "{colors.label}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  remote-pill-on:
    backgroundColor: "{colors.lit-white}"
    textColor: "{colors.black}"
  pad-key:
    backgroundColor: "{colors.fill-2}"
    textColor: "{colors.label}"
    rounded: "{rounded.app-icon}"
    size: "var(--t, 96px)"
---

# Design System: archer's desk

## Overview

**Creative North Star: "StandBy on any screen"**

The desk is an iPhone lying on its side at night: two widgets straight on pure black, no cards, no borders, each owning its half of the screen and one vivid iOS system tint. The first thing anyone sees from across a room is the time, in heavy rounded digits that fill most of the height, then the second widget. Nothing else competes. The controls are not there until someone taps; then a small translucent pill appears top right and the page dots flash, and both fade away again.

There is one look and no theme picker. The board is ambient and quiet; every screen off the board (settings, the phone remote, the macapad key editor, popups) is plain iOS dark UI, the way Settings, Home and Control Center look: large bold titles, inset grouped lists on #1c1c1e, pill buttons, a blue accent, a green switch. On the Echo Show 5 (960×480) settings is an iPad split view; on the iPhone (393×852) it is a drill-in list. Copy is plain sentence case for ordinary people, never developer syntax.

After sunset the whole display goes red, StandBy-style: every pixel's brightness is mapped into red so the screen never lights the room. Night is per device, decided by sunrise and sunset from the weather feed, and can be switched off per screen or paused with "Not tonight" until the next sunrise.

**Key Characteristics:**
- Pure black ground (#000), no card chrome on the board.
- One iOS dark system tint per widget, mapped by widget type, never mixed inside a widget.
- Heavy rounded numerals (weight 900) as big as the half allows; system sans for words.
- Controls hidden until a tap.
- Off-board screens are faithful iOS dark UI.
- Night turns everything red through a color matrix, not a second palette.

## Colors

A black field carrying the full iOS dark system tint set, one tint per widget, with iOS's gray fills and translucent labels for everything quiet.

### Primary
- **Widget Tints** (green, red, orange, yellow, cyan, blue, indigo, purple, pink, mint): the board's color. Each widget type gets exactly one, mapped centrally by widget type, and reads it as its current tint. The standing map: green for clocks and counters (clock, GitHub, stocks, chess); orange for time-passing things (analog second hand, world clock, alarms, timer); red for dates and calendars; cyan for weather; yellow for sun, quotes, away; indigo for moon and do-not-disturb; pink for music; purple for media news; blue for travel, coding time and the macapad; mint for pictures. A new widget joins a family; it does not invent a color.
- **System Blue** (blue): off the board it is the single interactive accent: primary pill buttons, the selected settings sidebar row, links, focus rings, the text caret, the selected tab.

### Neutral
- **Black** (black): every background, board and off-board alike.
- **Grouped Fill** (fill-1): grouped list sections, sheets, fields, remote tiles, empty album art.
- **Control Fill** (fill-2): pill buttons on a black or grouped ground, pressed list rows, pad keys at rest.
- **Pressed Fill** (fill-3): a pressed secondary button, scrollbar thumb, unlit tile icon disc.
- **Material** (material): the translucent control pill over the board, always with a 20px blur.
- **Label / Secondary / Tertiary** (label, label-2, label-3): white for the figure and primary text; 62% for captions, artist names, weekend days, the weather line; 32% for placeholders.
- **Separator** (separator): half-pixel hairlines between list rows, inset 16px from the left.
- **Lit White** (lit-white): the remote's "on" state, like a Home accessory that is turned on.
- **Segment On** (segment-on): the selected half of a segmented control.

### Named Rules
**The One Tint Rule.** A widget uses one tint. Its figure, glyph disc and accent marks all read the widget's tint; secondary text is gray, never a second hue. Exceptions are semantic: stock up/down pills (green/red) and the white colon dots.

**The Night Is a Filter Rule.** Night mode is a brightness-to-red color matrix over the whole page (`?night=1` / `?night=0` forces it). Never author red-variant styles per component; design in color and let the filter do it. Night runs only on the display, not on the remote.

**The Blue Means Act Rule.** Off the board, blue marks the action or the selection. There is one filled blue primary button per screen.

## Typography

**Display Font:** SF Pro Rounded via ui-rounded on Apple devices, Nunito (self-hosted, variable weight 200 to 1000) everywhere else, including the Echo
**Body Font:** SF Pro Text / system sans (with Roboto, Helvetica Neue, Arial)
**Icon Font:** Material Symbols, a self-hosted subset drawn by ligature name

**Character:** Rounded heavy figures carry every number worth reading from across a room; the plain system sans carries every word. The pairing is StandBy's: soft, loud digits and quiet, familiar text.

### Hierarchy
- **Display** (900, min(56vw, 100vh), 0.74): the standby clock only. Digits are drawn one by one in two alternating tones that overlap slightly where they meet, with the colon as two soft white dots; the line box is trimmed so the digits center on the glyphs. In portrait the hours stack over the minutes and the colon disappears.
- **Figure** (900, 0.24 × the panel's short side, rising to 0.32 when alone, 1): every widget's hero number, in the tint. A unit sits beside it in sans 600 at a quarter of the size, white; a caption sits under it in label-2. Panel-relative sizes scale with the panel, so a figure fills a half on the Echo and on the phone alike.
- **Headline** (700, 34px, 1.1): large page titles off the board (Control, Settings); 28px in the Echo's split sidebar.
- **Title** (700, 22px): section heads on the remote (Screens, Vibe, Away).
- **Body** (400 to 600, 17px, 1.3): rows, buttons (600), fields, empty-state sentences (500, max 26ch, balanced).
- **Label** (400, 13px, 1.35): grouped-list headers and footers in label-2, sentence case.

### Named Rules
**The Rounded Is for Numbers Rule.** The rounded face is for figures: times, temperatures, counts, the login wordmark. Words, including dates written out, use the system sans.

**The Sentence Case Rule.** All interface text is sentence case. Lowercase server strings are capitalized on their first letter by style; nothing is set in all caps or tracked out.

## Layout

The board is a horizontal pager of pages; each page holds rows that page vertically. In landscape (the Echo, 960×480) a row is two square-ish halves side by side with a 20px gap inside 16px page padding; a panel is never wider than 1.3× its height, so large windows stay boxy. A wide row gives one widget both halves. In portrait (the phone) the halves stack with a 12px gap. All widget sizes derive from the panel's short side (about 448px on the Echo, about 361px on the iPhone), never fixed pixels.

Standby is page zero: the clock fills the screen, with a small date / weather / alarm line pinned top left in 19px sans 600.

Off the board, the iOS rhythm holds: 16px gutters, 48px list rows, 44px minimum touch targets, 22px above a group header and 7px below, 26px between remote sections, 10px between tiles. At 700px and wider, settings becomes a split view (a 300px sidebar plus the open section); narrower, it is a drill-in stack with a back button and Done top right. The remote is a phone page with a translucent bottom tab bar; on a wide window its content centers at phone width.

## Elevation & Depth

The board is flat: nothing floats over black except the control pill, and depth there comes from translucency and blur, not shadow. Off the board, depth is tonal: black ground, #1c1c1e groups, #2c2c2e controls. Shadows are tiny and functional, copied from iOS where iOS has them.

### Shadow Vocabulary
- **Switch knob** (`box-shadow: 0 3px 8px rgba(0,0,0,0.15), 0 3px 1px rgba(0,0,0,0.06)`): the white thumb of the switch and of the selected segment.
- **Badge lift** (`box-shadow: 0 2px 8px rgba(0,0,0,0.45)`): small dark discs sitting on artwork, such as the Now Playing status badge.
- **Inset focus** (`box-shadow: inset 0 0 0 2px var(--blue)`): focus on fields and selected editor items, drawn inside so nothing shifts.

### Named Rules
**The Glass Not Shadow Rule.** Anything that floats over content (control pill, tab bar, status badge) is a translucent material with backdrop blur. A shadow is never what separates it; at most a small soft lift where a badge sits on artwork.

## Shapes

Everything is continuous and soft, iOS-shaped. Pills (999px) for every button and the control pill; full circles for icon buttons, glyph discs, page dots and today's date; 22.5% squircle-ish corners for macapad keys, like app icons; 20px for remote tiles and cards; 12px for grouped sections; 10px for fields and segmented controls; 7px for the colored square icons on settings rows. Album art takes a small radius (3% of the panel). There are no borders anywhere; separation is hairlines inside groups and tone between surfaces.

## Components

### Buttons
Quiet gray pills; one blue one where there is something to do.
- **Shape:** full pill (999px), 44px minimum height (50px for primary).
- **Primary:** System Blue fill, white 17px/600 label, 0 24px padding. One per screen.
- **Secondary:** Control Fill with a white label; a tinted label variant (red, green, orange, yellow, blue) for meaning, such as red for delete.
- **Selected:** blue fill, white label.
- **Pressed:** scale to 0.97 and darken (Pressed Fill on secondary, brightness 0.88 on primary). Disabled is 35% opacity.
- **Focus:** 2px blue outline offset 2px.

### Lists (grouped)
- **Corner Style:** 12px on the section; rows inside are square.
- **Background:** Grouped Fill on black.
- **Rows:** 48px, 16px side padding, a half-pixel hairline inset 16px (57px when the row has an icon). Pressed rows fill with Control Fill.
- **Row icons:** 7px-radius colored squares with a white glyph, one system color per section (Night mode is indigo).
- **Header / footer:** 13px label-2, sentence case, plain explanations ("“Not tonight” lasts until the next sunrise, then night mode is back.").

### Inputs / Fields
- **Style:** Grouped Fill, no border, 10px radius, 44px tall, 17px text, label-3 placeholder.
- **Focus:** 2px inset blue ring; the caret is blue.
- **Switch:** iOS switch, 51×31, green when on, white knob with the switch-knob shadow.
- **Segmented control:** Grouped Fill track with 2px padding, 10px radius; the selected segment is Segment On with a 600 label.

### Navigation
- **Board:** no visible navigation at rest. A tap reveals the control pill (top right: settings, remote, fullscreen as 44px circular icon buttons on Material with blur) and 7px page dots (white when current, 28% white otherwise); both fade in over 0.35s and hide again.
- **Settings:** phone drill-in with "‹ Settings" back and blue Done; Echo split view with the chosen sidebar row filled blue.
- **Remote:** translucent bottom tab bar (blur 20px), gray 10px labels, selected tab blue.

### StandBy Widget
The frame every widget lives in: content centered straight on black, no card. The widget's name is visually hidden (screen readers still get it) and shows only where it carries information the content does not, such as the weather's city or the macapad's page name and press errors; when shown it is 17px/700 in the tint, top left. Empty, loading and unconfigured states are the widget's glyph in a tinted disc (0.2 × panel) over one plain sentence. Lists inside widgets are iOS widget rows: label-2 left, white right, half-pixel hairlines.

### Standby Clock (signature)
Rounded 900 digits in two greens (a light #5fe08a and a deep #23934b, alternating digit by digit), overlapping by 0.05em, with two 90% white dots for the colon set over the join. Elsewhere, toned time uses the widget's tint and a 58% tint-into-black mix for the second tone. am/pm hangs under the minutes in 20px sans label-2.

### Now Playing
Square art at 0.6 × the panel (0.86 × height when wide) with a small radius, title 700 clamped to two lines, artist in label-2. A small dark circular badge in the art's top-right corner shows status (animated pink bars when playing, a pause mark when paused); it is a status, not a button. With nothing playing: a pink glyph disc over one sentence.

### Remote Tiles
Home and Control Center on the phone. Screen tiles and vibe tiles are 20px-radius Grouped Fill blocks; the current one lights up Lit White with black text, its icon disc turning blue (yellow when away). Vibe icons keep their own color. Choice pills (away durations) are Control Fill pills that light white when chosen.

### Macapad Keys
Home-screen tiles on black: 22.5%-radius squares sized from the panel, a white glyph or an app icon / logo / picture filling the tile, the label underneath. A press shrinks the tile and flashes it white, like a Control Center toggle turning on. The key editor is iOS Settings and always opens on the full list of choices, with search pinned at the top.

## Do's and Don'ts

### Do:
- **Do** put widgets straight on #000 with no card, border or background panel.
- **Do** give each widget exactly one system tint, assigned with its family in the central widget-to-tint map.
- **Do** size widget content from the panel's short side so it fills a half on both the Echo (960×480) and the iPhone (393×852).
- **Do** set every number worth glancing at in the rounded face at 800 to 900, tabular figures.
- **Do** keep board controls hidden until a tap, then fade them back out.
- **Do** build off-board screens from the iOS dark parts: large title, inset grouped lists, pill buttons, green switch, blue for action.
- **Do** write sentence-case, plain-language copy ("Add your city in settings", "Not tonight").
- **Do** let night mode come from the red color matrix; design in full color.

### Don't:
- **Don't** show a widget's name as a heading unless it carries information the content does not.
- **Don't** add a theme picker or alternate palettes; there is one look.
- **Don't** wrap board widgets in cards or a dashboard grid with corner chrome.
- **Don't** mix two tints inside one widget for decoration.
- **Don't** float things over the board with drop shadows; use translucent material with blur.
- **Don't** set interface text in all caps or letterspaced labels.
- **Don't** expose raw syntax, arrow paths or developer terms in board or settings copy.
