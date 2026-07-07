#!/bin/sh
# Runs the given command through Infisical when the CLI + project are present,
# otherwise falls back to the plain environment. Usage: with-env.sh <cmd...>
set -e

if command -v infisical >/dev/null 2>&1 && { [ -f .infisical.json ] || [ -n "$INFISICAL_TOKEN" ]; }; then
  echo "[archersdesk] infisical detected — injecting secrets (env: ${INFISICAL_ENV:-dev})" >&2
  exec infisical run --env="${INFISICAL_ENV:-dev}" -- "$@"
else
  echo "[archersdesk] infisical not detected — running with plain environment" >&2
  exec "$@"
fi
