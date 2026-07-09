import fs from "node:fs";
import path from "node:path";

// Secrets arrive via Infisical (`pnpm dev` runs through scripts/with-env.sh)
// or the plain environment — everything here has a sane fallback so the app
// boots either way.

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

export const env = {
  dataDir,
  dbPath: process.env.DATABASE_PATH || path.join(dataDir, "archersdesk.db"),
  // Server-wide Last.fm API key; users can override per-account in their YAML.
  lastfmApiKey: process.env.LASTFM_API_KEY || "",
  // Bootstrap account — set these in docker-compose / infisical and the user
  // is created (or its password synced) on boot.
  adminUsername: process.env.ADMIN_USERNAME || "",
  adminPassword: process.env.ADMIN_PASSWORD || "",
  // Lock the instance down to env-provisioned accounts only.
  disableRegistration: process.env.DISABLE_REGISTRATION === "true",
  // Cookies must stay non-secure when the Echo Show hits the app over plain
  // http on the LAN. Set COOKIE_SECURE=true behind an https reverse proxy.
  cookieSecure: process.env.COOKIE_SECURE === "true",
  // Encrypts the settings JSON stored in sqlite. If omitted, a persistent key
  // is generated in DATA_DIR so local installs still survive restarts.
  settingsEncryptionKey: process.env.SETTINGS_ENCRYPTION_KEY || "",
  isProd: process.env.NODE_ENV === "production",
};
