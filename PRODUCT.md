# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Archer and the other people at home. The main screen is an **Echo Show 5** (960×480 landscape,
Silk browser) on a desk or bedside, read at a glance from across the room, often in the dark.
An **iPhone 15 Pro** (393×852 portrait) acts as the remote. Other household members glance at
the display too, so anything shown on it has to make sense to someone who didn't set it up.

## Product Purpose

A deskside / bedside ambient display: a big standby clock, then pages of widgets (time, weather,
calendar, now playing, alarms, status signs like do-not-disturb and away, home-server and account
stats, a macro pad that drives a Mac). The phone remote pushes presence (away, vibe), manages
alarms and devices, and presses macapad keys. Success: the time and the one thing you care about
right now read instantly from across a room, and setting it up never feels like a dev tool.

## Positioning

A self-hosted, always-on desk display that works like a phone's standby mode on a cheap smart
display, while the phone becomes its remote. It also drives the user's Mac through Macapad
(macro keys), which no stock smart-display face does.

## Operating Context

- Always-on screen beside a desk or bed. Day and night use; at night it must not light up the
  room.
- Swipe left/right between standby and widget pages; swipe up/down through rows; a row is two
  square panels or one wide panel.
- Settings autosave; everything is tap-first (no keyboard on the Echo).
- Several browsers can each act as a named "device"; a phone in portrait can act as the remote.

## Capabilities and Constraints

- Next.js 15 app router, React 19, SQLite, self-hosted (Docker). Plain CSS in `app/styles/*.css`.
- Must work on Silk (Chromium-based, Echo Show 5) and iOS Safari. Fonts are self-hosted woff2.
- Widgets scale from `--ps` (a panel's short side).
- Macapad is API-only on the Mac; this app is one of its frontends.

## Brand Commitments

- Name: "archer's desk"; the app's voice is lowercase.
- Visual direction pinned by the user (2026-10-10): **iOS StandBy mode** for the display: pure
  black, huge bold rounded numerals, each widget with its own vivid color, full-bleed widgets
  with no card chrome, and **automatic red night mode after dark**. Settings, the remote and the
  macapad editor follow **iOS-style dark UI** (grouped lists, big bold titles, pill buttons).
- One look only, no theme picker.

## Evidence on Hand

- Real widget data comes from the user's own accounts and feeds; no screenshots or marketing
  material exist. Don't invent stats or claims.

## Product Principles

1. Readable from across the room first; detail second.
2. For ordinary people: one decision per screen, plain words, never raw syntax.
3. Don't light up a dark room.
4. Every screen works at 960×480 and 393×852.

## Accessibility & Inclusion

Large type and high contrast for glanceability; tap targets ≥ 44px on the phone; respect reduced
motion.
