# archer's desk

An ambient, StandBy-style dashboard for small screens — built for a 5" Echo Show
(960×480) sitting on a desk, but happy in any browser. Widgets are configured
per-account in YAML, pages swipe like Apple StandBy, and it installs as a PWA.

## stack

- **Next.js** (app router) — dev runs raw, no containers
- **SQLite** (better-sqlite3) — users, sessions, and each user's YAML config
- **Infisical** — secrets manager; every run script auto-detects it and falls
  back to plain env vars when it's not around
- **Docker** — production only

## dev

```sh
pnpm install
pnpm dev          # → http://localhost:3000
```

`pnpm dev` goes through `scripts/with-env.sh`: if the `infisical` CLI and an
`.infisical.json` (or `INFISICAL_TOKEN`) are present it wraps the command in
`infisical run`, otherwise it just runs `next dev`. To wire up Infisical:

```sh
brew install infisical/get-cli/infisical
infisical init                      # link the project → creates .infisical.json
infisical secrets set LASTFM_API_KEY=<key>
```

### secrets / env

| var                    | purpose                                                  | default        |
| ---------------------- | -------------------------------------------------------- | -------------- |
| `LASTFM_API_KEY`       | server-wide Last.fm key for the now-playing widget       | none           |
| `ADMIN_USERNAME`       | account bootstrapped from the env on boot                | none           |
| `ADMIN_PASSWORD`       | its password — changing it re-syncs (and logs out) the account | none     |
| `DISABLE_REGISTRATION` | `true` = no public signups, env accounts only            | `false`        |
| `DATA_DIR`             | where the sqlite db lives                                | `./data`       |
| `DATABASE_PATH`        | exact db file path                                       | `DATA_DIR/archersdesk.db` |
| `COOKIE_SECURE`        | `true` only behind https (breaks plain-http LAN use)     | `false`        |
| `INFISICAL_ENV`        | infisical environment slug for `infisical run`           | `dev` (`prod` in docker) |

Get a Last.fm API key at <https://www.last.fm/api/account/create>. Users can
also set `lastfm.api_key` in their own YAML instead of the server-wide secret.

## the yaml config

Each account gets its own document (gear icon → config). The default:

```yaml
city: New York
units: fahrenheit        # fahrenheit | celsius

layout:
  mode: split            # split = two squares · dual = one wide panel
  left: calendar
  right: nowplaying
  dual: clock            # the widget shown when mode is dual

standby:                 # the swipe-left page
  show_temp: true
  show_alarm: true

lastfm:
  username: ""           # navidrome scrobbles land here
  api_key: ""            # optional — falls back to LASTFM_API_KEY

alarms:
  - time: "07:30"        # 24h HH:MM
    label: wake up
    days: [mon, tue, wed, thu, fri]   # omit or [] = every day
    enabled: false
```

Widgets: `clock` · `date` · `datetime` · `calendar` · `weather` ·
`nowplaying` · `alarms`. Saving validates the YAML and reports line-level
errors; nothing is applied until it parses clean.

New widgets: add the name to `WIDGETS` in `lib/types.ts`, drop a component in
`components/widgets/`, and register it in `components/widgets/registry.tsx`.

## pages

- **main** — the two squares (or one wide panel in `dual` mode)
- **standby** — swipe left: big clock, date, city temperature, next alarm
- alarms ring full-screen with a chime; snooze or dismiss

## echo show setup

Open Silk on the Echo Show, browse to `http://<your-machine>:3000`, sign in,
and use Silk's menu → *Add to Home Screen*. The app requests a screen wake
lock so it stays awake as an always-on desk clock. On a phone/desktop Chrome
you'll get the normal PWA install prompt.

## production (docker)

Dev never builds containers; prod is:

```sh
docker compose up -d --build
```

Set `ADMIN_USERNAME` / `ADMIN_PASSWORD` in the compose file — the account is
created on first boot and its password follows the env value, so whoever
deploys the compose just types their password there. Leave
`DISABLE_REGISTRATION: "true"` unless you want open signups.

CI (`.github/workflows/docker.yml`) builds a multi-arch image on every push
to `main` and publishes it to GitHub Container Registry as
`ghcr.io/<owner>/archersdesk:latest` — once the repo is on GitHub you can swap
`build: .` in the compose file for that image.

Secrets in prod, pick one:

- **Infisical machine identity**: set `INFISICAL_TOKEN` + `INFISICAL_PROJECT_ID`
  (and optionally `INFISICAL_ENV`, default `prod`) — the entrypoint wraps the
  server in `infisical run`
- **plain env**: just set `LASTFM_API_KEY` etc. on the service

The sqlite db persists in the `desk-data` volume. Set `COOKIE_SECURE=true` if
you put it behind an https reverse proxy.
