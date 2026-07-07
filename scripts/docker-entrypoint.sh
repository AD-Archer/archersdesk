#!/bin/sh
# Prod twin of scripts/with-env.sh: run through Infisical when a machine
# identity token is provided, otherwise fall back to plain container env.
set -e

if command -v infisical >/dev/null 2>&1 && [ -n "$INFISICAL_TOKEN" ]; then
  echo "[archersdesk] infisical token present — injecting secrets (env: ${INFISICAL_ENV:-prod})" >&2
  exec infisical run --env="${INFISICAL_ENV:-prod}" --projectId="${INFISICAL_PROJECT_ID:?set INFISICAL_PROJECT_ID}" -- "$@"
else
  echo "[archersdesk] no infisical token — using container environment" >&2
  exec "$@"
fi
