import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { createExecutor } from "../core/executor.mjs";
import { createSavedTemplatesStore } from "../core/saved-templates-store.mjs";

function env(name, fallback = undefined) {
  const raw = process.env[name];
  if (raw == null) return fallback;
  const value = String(raw).trim();
  return value === "" ? fallback : value;
}

export const runtimeConfig = (() => {
  const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
  const executorMode = env("EXECUTOR_MODE", "node");
  const port = Number(env("PORT", "8787"));
  const nasHost = env("NAS_HOST");
  const nasUser = env("NAS_USER");
  const nasKeyPath = env("NAS_KEY_PATH");
  const scriptPath = env("NAS_SCRIPT", "/volume1/scripts/linkmedia.sh");
  const uxStateDbPath = env(
    "UX_STATE_DB_PATH",
    path.join(repoRoot, "data", "ux-state.sqlite"),
  );

  if (!["bash", "node"].includes(executorMode)) {
    throw new Error(`EXECUTOR_MODE must be bash|node, got: ${executorMode}`);
  }
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`PORT must be an integer between 0 and 65535, got: ${port}`);
  }
  if (executorMode === "bash") {
    if (!nasHost || !nasUser || !nasKeyPath) {
      throw new Error("Need env for EXECUTOR_MODE=bash: NAS_HOST, NAS_USER, NAS_KEY_PATH");
    }
    if (!fs.existsSync(nasKeyPath)) {
      throw new Error(`NAS_KEY_PATH does not exist: ${nasKeyPath}`);
    }
  }

  return {
    runToken: crypto.randomBytes(32).toString("hex"),
    repoRoot,
    port,
    executorMode,
    uxStateDbPath,
    appAssetsDir: path.join(repoRoot, "dist", "app"),
    vendorAssetsDir: path.join(repoRoot, "assets", "vendor"),
    ssh: {
      host: nasHost,
      username: nasUser,
      privateKeyPath: nasKeyPath,
    },
    scriptPath,
  };
})();

export const discoverConfig = {
  url: env("PLEX_DISCOVER_URL", "https://discover.provider.plex.tv"),
  token: env("PLEX_DISCOVER_TOKEN", null),
  product: env("PLEX_DISCOVER_PRODUCT", "Plex Web"),
  version: env("PLEX_DISCOVER_VERSION", "4.147.1"),
  clientId: env("PLEX_DISCOVER_CLIENT_ID", "nas-linker"),
  platform: env("PLEX_DISCOVER_PLATFORM", "Safari"),
  platformVersion: env("PLEX_DISCOVER_PLATFORM_VERSION", "26.2"),
  features: env("PLEX_DISCOVER_FEATURES", "external-media,indirect-media,hub-style-list"),
  model: env("PLEX_DISCOVER_MODEL", "bundled"),
  device: env("PLEX_DISCOVER_DEVICE", "OSX"),
  deviceResolution: env("PLEX_DISCOVER_DEVICE_RESOLUTION", "1512x982"),
  providerVersion: env("PLEX_DISCOVER_PROVIDER_VERSION", "7.2"),
  textFormat: env("PLEX_DISCOVER_TEXT_FORMAT", "plain"),
  drm: env("PLEX_DISCOVER_DRM", "fairplay"),
  language: env("PLEX_DISCOVER_LANGUAGE", "en"),
};

export const omdbConfig = {
  url: env("OMDB_API_URL", "https://www.omdbapi.com/"),
  apiKey: env("OMDB_API_KEY", null),
};

export const appAuthConfig = {
  user: env("APP_AUTH_USER", null),
  passwordHash: env("APP_AUTH_PASSWORD_HASH", null),
  sessionCookie: env("APP_SESSION_COOKIE", "nas_linker_session"),
  sessionTtlMs: 12 * 60 * 60 * 1000,
  sessionIdleMs: 2 * 60 * 60 * 1000,
};

if (Boolean(appAuthConfig.user) !== Boolean(appAuthConfig.passwordHash)) {
  throw new Error("APP_AUTH_USER and APP_AUTH_PASSWORD_HASH must be set together");
}

export const defaultSavedTemplatesStore = createSavedTemplatesStore({
  dbPath: runtimeConfig.uxStateDbPath,
});

export const defaultExecutor = createExecutor({
  mode: runtimeConfig.executorMode,
  scriptPath: runtimeConfig.scriptPath,
  ssh: runtimeConfig.ssh,
});
