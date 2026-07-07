# ── archer's desk · production image ────────────────────────────────
# Dev never touches this — run `pnpm dev` raw. Build/run only in prod:
#   docker compose up -d --build

FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
# better-sqlite3 ships prebuilds for linux glibc; toolchain is the fallback
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 DATA_DIR=/app/data

# Infisical CLI so the entrypoint can inject secrets when INFISICAL_TOKEN is
# set; without a token the app just uses plain container env vars.
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
  && curl -1sLf https://artifacts-cli.infisical.com/setup.deb.sh | bash \
  && apt-get install -y infisical \
  && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY scripts/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p /app/data && chown -R node:node /app/data

USER node
EXPOSE 3000
VOLUME /app/data
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
