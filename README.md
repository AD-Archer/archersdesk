# archer's desk

An ambient, StandBy-style dashboard for small screens — built for a 5" Echo Show
(960×480) on a desk, happy in any browser, installable as a PWA. Everything is
configured by tapping; the only typing left is usernames and API keys.

## stack

- **Next.js** (app router) — dev runs raw, no containers
- **SQLite** (better-sqlite3) — users, sessions, per-user settings JSON
- **Infisical** — secrets manager; run scripts auto-detect it and fall back to
  plain env vars when absent
- **Docker** — production only, with CI pushing images to GHCR

## dev

```sh
pnpm install
pnpm dev          # → http://localhost:3000
```

`pnpm dev` goes through `scripts/with-env.sh`: if the `infisical` CLI and an
`.infisical.json` (or `INFISICAL_TOKEN`) are present it wraps the command in
`infisical run`, otherwise it just runs `next dev`.

### env / secrets

| var                    | purpose                                              | default |
| ---------------------- | ---------------------------------------------------- | ------- |
| `LASTFM_API_KEY`       | server-wide last.fm key for now-playing              | none    |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | account bootstrapped from env on boot   | none    |
| `DISABLE_REGISTRATION` | `true` = env accounts only                           | `false` |
| `DATA_DIR`             | sqlite location                                      | `./data`|
| `COOKIE_SECURE`        | `true` only behind https                             | `false` |

## using it

Two pages, swiped **left/right**: the widget board and a standby page (big
clock · date · temperature · next alarm). The board is made of **rows** you
swipe **up/down** — each row is either two square panels (each side swipes
independently) or one wide `dual` panel:

```
clock     | nowplaying
calendar  | weather
     forecast (dual)
github    | chess
```

Buttons: top-left = fullscreen (also grabs a screen wake lock so the display
stays awake), top-right gear = settings. Everything in settings is tap-first
and autosaves: layout rows (add/remove/reorder, pick widgets from a grid),
themes, alarms (time picker + day chips + toggles), location (search a city,
tap a result), and accounts.

### widgets

time & date: `clock` · `analog` · `date` · `datetime` · `worldclock`
sky: `weather` · `forecast` · `sun` · `moon`
tools: `calendar` · `alarms` · `timer` · `quote`
status signs: `dnd` · `please_disturb` · `lunch` · `away_until` · `vibe`
accounts: `nowplaying` (last.fm/navidrome) · `github` · `chess` (chess.com) ·
`stocks` · `anilist` · `wakatime` · `jellyfin` · `plex`
keyless feeds: `dog` · `cat` · `fox` · `duck` · `shibe` (rotating critter
cams) · `catfact` · `dogfact` · `spacenews` · `f1` (next race + standings) ·
`citybikes` (nearest stations to your location) · `flights` (aircraft
overhead via OpenSky) · `septa` (regional rail arrivals via api.septa.org)

Account widgets need a username/key in **settings → accounts**; feeds need
nothing. Weather/forecast/sun use Open-Meteo (no key). Stocks come from
Yahoo's public chart endpoint. GitHub works keyless (60 req/hr) and pulls
GitHub Streak Stats JSON when available — add a token for headroom. WakaTime
defaults to `https://api.wakatime.com/api/v1` and accepts an **api url**
override so self-hosted wakapi or hackatime work
(`https://hackatime.hackclub.com/api/hackatime/v1`).

### themes

`ember` (warm black/amber) · `moonlight` (ice blue) · `meadow` (sage) ·
`rose` (blush) · `paper` (light). Themes are CSS variable sets on
`[data-theme]` in `app/globals.css` — every widget reads tokens, so new
widgets and new themes compose for free.

### icons

Widget icons are Material Symbols (rounded), self-hosted as a subset font at
`app/fonts/material-symbols.woff2` and rendered by ligature name via the
kit's `<MI name="chess" />`. To add icons, append the new names to the
`icon_names` list in this curl and replace the font file:

```sh
curl -A "Mozilla/5.0" -o subset.css "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=<comma-separated,sorted,names>&display=block"
curl -o app/fonts/material-symbols.woff2 "$(sed -n 's/.*src: url(\([^)]*\)).*/\1/p' subset.css | head -1)"
```

(names must be sorted alphabetically; a name missing from the font renders
as literal text, so eyeball new icons once)

## adding a widget

1. add the name to `WIDGETS` + `WIDGET_INFO` in `lib/types.ts` (label, blurb,
   category, icon)
2. build the component in `components/widgets/` from the kit
   (`kit.tsx`: `Shell`, `BigStat`, `MiniList`, `StatRow`, `Delta`, `Empty`)
3. register it in `components/widgets/registry.tsx`

If it needs an external API, add a fetcher to `lib/integrations.ts` (one
object: ttl + fetch), a credentials field in `Settings.integrations`
(+ sanitize in `lib/settings.ts`), a field group in settings → accounts, and
use `useIntegration("<service>", settings)` in the widget. Caching, error
envelopes, and refetch-on-credential-change are handled for you.

## echo show

Open Silk → `http://<your-machine>:3000`, sign in, tap the fullscreen button
(or Silk menu → *Add to Home Screen*). The wake lock keeps the screen on.
Keep `COOKIE_SECURE=false` while serving plain http on the LAN.

## production (docker)

```sh
docker compose pull
docker compose up -d
```

`docker-compose.yml` pulls the multi-arch image published by CI from
`ghcr.io/ad-archer/archersdesk:latest`:

```yaml
# Production only — for development just run `pnpm dev`.
services:
  desk:
    image: ghcr.io/ad-archer/archersdesk:latest
    ports:
      - "3000:3000"
    volumes:
      - desk-data:/app/data
    environment:
      # your account — created on first boot, password stays in sync with this
      ADMIN_USERNAME: archer
      ADMIN_PASSWORD: change-me-please
      # set true so randoms can't sign up on your instance
      DISABLE_REGISTRATION: "true"

      # option a: let infisical inject the rest (machine identity token)
      # INFISICAL_TOKEN: ${INFISICAL_TOKEN}
      # INFISICAL_PROJECT_ID: ${INFISICAL_PROJECT_ID}
      # INFISICAL_ENV: prod
      # option b: pass secrets straight through
      LASTFM_API_KEY: ${LASTFM_API_KEY:-}
      # set true only when serving behind an https reverse proxy
      COOKIE_SECURE: ${COOKIE_SECURE:-false}
    restart: unless-stopped

volumes:
  desk-data:
```

Set `ADMIN_USERNAME` / `ADMIN_PASSWORD` before first boot — the account is
created on boot and its password follows the env value. Leave
`DISABLE_REGISTRATION: "true"` unless you want open signups. Secrets come from
an Infisical machine identity (`INFISICAL_TOKEN` + `INFISICAL_PROJECT_ID`) or
plain container env.
