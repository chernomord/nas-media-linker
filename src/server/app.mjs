import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  createExecutor,
  isAllowedListDir,
  isUnder,
  MOVIES_ROOT,
  TORRENTS_ROOT,
  TV_ROOT,
} from "../../lib/executor.mjs";
import { createSavedTemplatesStore } from "../../lib/saved-templates-store.mjs";

const RUN_TOKEN = crypto.randomBytes(32).toString("hex");
const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

function env(name, fallback = undefined) {
  const raw = process.env[name];
  if (raw == null) return fallback;
  const value = String(raw).trim();
  return value === "" ? fallback : value;
}

const NAS_HOST = env("NAS_HOST");     // "192.168.1.10"
const NAS_USER = env("NAS_USER");     // "chernomord" или отдельный юзер
const NAS_KEY  = env("NAS_KEY_PATH"); // "/Users/you/.ssh/synology_linker"
const SCRIPT   = env("NAS_SCRIPT", "/volume1/scripts/linkmedia.sh");
const EXECUTOR_MODE = env("EXECUTOR_MODE", "node");
const PORT = Number(env("PORT", "8787"));
const UX_STATE_DB_PATH = env(
  "UX_STATE_DB_PATH",
  path.join(REPO_ROOT, "data", "ux-state.sqlite"),
);

if (!["bash", "node"].includes(EXECUTOR_MODE)) {
  throw new Error(`EXECUTOR_MODE must be bash|node, got: ${EXECUTOR_MODE}`);
}
if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
  throw new Error(`PORT must be an integer between 0 and 65535, got: ${PORT}`);
}
if (EXECUTOR_MODE === "bash") {
  if (!NAS_HOST || !NAS_USER || !NAS_KEY) {
    throw new Error("Need env for EXECUTOR_MODE=bash: NAS_HOST, NAS_USER, NAS_KEY_PATH");
  }
  if (!fs.existsSync(NAS_KEY)) {
    throw new Error(`NAS_KEY_PATH does not exist: ${NAS_KEY}`);
  }
}

const PLEX_DISCOVER_URL = env("PLEX_DISCOVER_URL", "https://discover.provider.plex.tv");
const PLEX_DISCOVER_TOKEN = env("PLEX_DISCOVER_TOKEN", null);
const PLEX_DISCOVER_PRODUCT = env("PLEX_DISCOVER_PRODUCT", "Plex Web");
const PLEX_DISCOVER_VERSION = env("PLEX_DISCOVER_VERSION", "4.147.1");
const PLEX_DISCOVER_CLIENT_ID = env("PLEX_DISCOVER_CLIENT_ID", "nas-linker");
const PLEX_DISCOVER_PLATFORM = env("PLEX_DISCOVER_PLATFORM", "Safari");
const PLEX_DISCOVER_PLATFORM_VERSION = env("PLEX_DISCOVER_PLATFORM_VERSION", "26.2");
const PLEX_DISCOVER_FEATURES =
  env("PLEX_DISCOVER_FEATURES", "external-media,indirect-media,hub-style-list");
const PLEX_DISCOVER_MODEL = env("PLEX_DISCOVER_MODEL", "bundled");
const PLEX_DISCOVER_DEVICE = env("PLEX_DISCOVER_DEVICE", "OSX");
const PLEX_DISCOVER_DEVICE_RES =
  env("PLEX_DISCOVER_DEVICE_RESOLUTION", "1512x982");
const PLEX_DISCOVER_PROVIDER_VERSION = env("PLEX_DISCOVER_PROVIDER_VERSION", "7.2");
const PLEX_DISCOVER_TEXT_FORMAT = env("PLEX_DISCOVER_TEXT_FORMAT", "plain");
const PLEX_DISCOVER_DRM = env("PLEX_DISCOVER_DRM", "fairplay");
const PLEX_DISCOVER_LANGUAGE = env("PLEX_DISCOVER_LANGUAGE", "en");
const OMDB_API_URL = env("OMDB_API_URL", "https://www.omdbapi.com/");
const OMDB_API_KEY = env("OMDB_API_KEY", null);
const APP_AUTH_USER = env("APP_AUTH_USER", null);
const APP_AUTH_PASSWORD_HASH = env("APP_AUTH_PASSWORD_HASH", null);
const APP_SESSION_COOKIE = env("APP_SESSION_COOKIE", "nas_linker_session");
const APP_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const APP_SESSION_IDLE_MS = 2 * 60 * 60 * 1000;

if (Boolean(APP_AUTH_USER) !== Boolean(APP_AUTH_PASSWORD_HASH)) {
  throw new Error("APP_AUTH_USER and APP_AUTH_PASSWORD_HASH must be set together");
}

const ASSETS_DIR = path.join(REPO_ROOT, "assets");
const DEFAULT_SAVED_TEMPLATES_STORE = createSavedTemplatesStore({ dbPath: UX_STATE_DB_PATH });

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function hasAppAuthConfig() {
  return Boolean(APP_AUTH_USER && APP_AUTH_PASSWORD_HASH);
}

function parseScryptHash(value) {
  const [scheme, n, r, p, salt, hash] = String(value).split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !hash) {
    throw new Error("APP_AUTH_PASSWORD_HASH must use scrypt$N$r$p$salt$hash format");
  }
  return {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    salt,
    hash,
  };
}

function timingSafeEqualStrings(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifyPassword(password, encodedHash, parsedHash = parseScryptHash(encodedHash)) {
  const { N, r, p, salt, hash } = parsedHash;
  if (![N, r, p].every(Number.isFinite)) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = crypto.scryptSync(String(password), salt, expected.length, { N, r, p });
  return crypto.timingSafeEqual(actual, expected);
}

function createSessionAuth({ appAuthUser, appAuthPasswordHash, cookieName = APP_SESSION_COOKIE }) {
  if (Boolean(appAuthUser) !== Boolean(appAuthPasswordHash)) {
    throw new Error("APP_AUTH_USER and APP_AUTH_PASSWORD_HASH must be set together");
  }

  const parsedHash =
    appAuthUser && appAuthPasswordHash
      ? parseScryptHash(appAuthPasswordHash)
      : null;
  const sessions = new Map();

  function sessionConfigured() {
    return Boolean(appAuthUser && appAuthPasswordHash);
  }

  function setNoStore(res) {
    res.set("Cache-Control", "no-store");
  }

  function isSecureRequest(req) {
    const proto = (req.get("x-forwarded-proto") || "").split(",")[0].trim().toLowerCase();
    return req.secure || proto === "https";
  }

  function serializeCookie(name, value, {
    path = "/",
    httpOnly = true,
    sameSite = "Strict",
    secure = false,
    maxAge = null,
    expires = null,
  } = {}) {
    const parts = [`${name}=${value}`];
    if (path) parts.push(`Path=${path}`);
    if (httpOnly) parts.push("HttpOnly");
    if (sameSite) parts.push(`SameSite=${sameSite}`);
    if (secure) parts.push("Secure");
    if (maxAge != null) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
    if (expires) parts.push(`Expires=${expires.toUTCString()}`);
    return parts.join("; ");
  }

  function setSessionCookie(req, res, sessionId) {
    res.append("Set-Cookie", serializeCookie(cookieName, encodeURIComponent(sessionId), {
      secure: isSecureRequest(req),
      maxAge: Math.floor(APP_SESSION_TTL_MS / 1000),
    }));
  }

  function clearSessionCookie(req, res) {
    res.append("Set-Cookie", serializeCookie(cookieName, "", {
      secure: isSecureRequest(req),
      maxAge: 0,
      expires: new Date(0),
    }));
  }

  function parseCookies(req) {
    const raw = req.get("cookie");
    if (!raw) return {};
    const cookies = {};
    for (const entry of raw.split(";")) {
      const idx = entry.indexOf("=");
      if (idx < 0) continue;
      const key = entry.slice(0, idx).trim();
      const value = entry.slice(idx + 1).trim();
      cookies[key] = value;
    }
    return cookies;
  }

  function createSession() {
    const id = crypto.randomBytes(32).toString("hex");
    const now = Date.now();
    const session = {
      id,
      createdAt: now,
      lastSeenAt: now,
    };
    sessions.set(id, session);
    return session;
  }

  function isExpired(session, now = Date.now()) {
    if (!session) return true;
    if (now - session.createdAt > APP_SESSION_TTL_MS) return true;
    if (now - session.lastSeenAt > APP_SESSION_IDLE_MS) return true;
    return false;
  }

  function getSession(req, res) {
    if (!sessionConfigured()) return null;
    const cookieValue = parseCookies(req)[cookieName];
    if (!cookieValue) return null;
    const sessionId = decodeURIComponent(cookieValue);
    const session = sessions.get(sessionId);
    if (!session) {
      clearSessionCookie(req, res);
      return null;
    }
    if (isExpired(session)) {
      sessions.delete(sessionId);
      clearSessionCookie(req, res);
      return null;
    }
    session.lastSeenAt = Date.now();
    return session;
  }

  function attachSession(req, res, next) {
    req.appSession = getSession(req, res);
    next();
  }

  function requireSession(req, res, next) {
    if (!sessionConfigured()) return next();
    if (req.appSession) return next();
    setNoStore(res);
    res.set("X-NAS-Linker-Auth", "session");
    return res.status(401).json({ ok: false, error: "session required" });
  }

  function login(req, res) {
    if (!sessionConfigured()) {
      return res.json({ ok: true, authenticated: true, mode: "disabled" });
    }

    const username = typeof req.body?.username === "string" ? req.body.username : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!username || !password) {
      setNoStore(res);
      return res.status(400).json({ ok: false, error: "username and password required" });
    }
    if (!timingSafeEqualStrings(username, appAuthUser)) {
      setNoStore(res);
      res.set("X-NAS-Linker-Auth", "session");
      return res.status(401).json({ ok: false, error: "invalid credentials" });
    }
    if (!verifyPassword(password, appAuthPasswordHash, parsedHash)) {
      setNoStore(res);
      res.set("X-NAS-Linker-Auth", "session");
      return res.status(401).json({ ok: false, error: "invalid credentials" });
    }

    const session = createSession();
    setNoStore(res);
    setSessionCookie(req, res, session.id);
    return res.json({ ok: true, authenticated: true });
  }

  function logout(req, res) {
    if (req.appSession?.id) {
      sessions.delete(req.appSession.id);
    }
    setNoStore(res);
    clearSessionCookie(req, res);
    return res.json({ ok: true, authenticated: false });
  }

  function sessionInfo(req, res) {
    setNoStore(res);
    if (!sessionConfigured()) {
      return res.json({ ok: true, authenticated: true, mode: "disabled" });
    }
    return res.json({ ok: true, authenticated: Boolean(req.appSession) });
  }

  function isAuthenticated(req) {
    return !sessionConfigured() || Boolean(req.appSession);
  }

  return {
    sessionConfigured,
    attachSession,
    requireSession,
    login,
    logout,
    sessionInfo,
    isAuthenticated,
  };
}

function createTokenAuth(runToken) {
  return function auth(req, res, next) {
    const got = req.get("x-run-token");
    if (got !== runToken) return res.status(401).send("Unauthorized");
    next();
  };
}

function hasPlexDiscoverConfig() {
  return Boolean(PLEX_DISCOVER_URL && PLEX_DISCOVER_TOKEN);
}

function hasOmdbConfig() {
  return Boolean(OMDB_API_URL && OMDB_API_KEY);
}

function collectGuidStrings(value, out = []) {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const entry of value) collectGuidStrings(entry, out);
    return out;
  }
  for (const entry of Object.values(value)) {
    collectGuidStrings(entry, out);
  }
  return out;
}

function extractImdbId(m) {
  const matchers = [
    m?.guid,
    m?.Guid,
    m?.guids,
    m?.Guids,
  ];

  for (const value of matchers) {
    const strings = collectGuidStrings(value);
    for (const candidate of strings) {
      const match = String(candidate).match(/imdb:\/\/(tt\d{5,12})/i);
      if (match) return match[1];
    }
  }
  return null;
}

function isTmdbImageUrl(value) {
  if (typeof value !== "string" || !value.startsWith("http")) return false;
  try {
    const url = new URL(value);
    return /(^|\.)tmdb\.org$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function normalizePlexItem(m, fallbackType) {
  const thumb = m.thumb ?? null;
  const art = m.art ?? null;
  const thumbPath = typeof thumb === "string" && thumb.startsWith("/") ? thumb : null;
  const thumbUrl = typeof thumb === "string" && thumb.startsWith("http") ? thumb : null;
  const artPath = typeof art === "string" && art.startsWith("/") ? art : null;
  const artUrl = typeof art === "string" && art.startsWith("http") ? art : null;
  return {
    title: m.title ?? "",
    year: m.year ?? null,
    type: m.type ?? fallbackType,
    score: m.score ?? null,
    summary: m.summary ?? "",
    guid: m.guid ?? null,
    ratingKey: m.ratingKey ?? null,
    imdbId: extractImdbId(m),
    thumbUrl,
    thumbPath,
    artUrl,
    artPath,
  };
}

function extractPlexResults(container, kind) {
  const items = [];
  const fallbackType = kind === "movie" ? "movie" : "show";

  const addItems = (arr) => {
    for (const m of arr) {
      if (!m || typeof m !== "object") continue;
      if (kind === "movie" && m.type && m.type !== "movie") continue;
      if (kind === "show" && m.type && m.type !== "show") continue;
      items.push(normalizePlexItem(m, fallbackType));
    }
  };

  const meta = container?.Metadata ?? [];
  addItems(meta);

  const hubs = container?.Hub ?? [];
  for (const hub of hubs) {
    addItems(hub?.Metadata ?? []);
  }

  const searchResults = container?.SearchResults ?? [];
  for (const result of searchResults) {
    addItems(result?.Metadata ?? []);
    addItems(result?.Results ?? []);
    if (result?.Media) addItems(result.Media);
    const sr = result?.SearchResult ?? [];
    for (const entry of sr) {
      if (entry?.Metadata) addItems([entry.Metadata]);
      if (entry?.Directory) addItems([entry.Directory]);
      if (entry?.Media) addItems([entry.Media]);
    }
  }

  if (items.length === 0 && container) {
    const seen = new Set();
    const stack = [{ value: container, depth: 0 }];
    while (stack.length > 0) {
      const { value, depth } = stack.pop();
      if (!value || typeof value !== "object") continue;
      if (seen.has(value)) continue;
      seen.add(value);
      if (Array.isArray(value.Metadata)) {
        addItems(value.Metadata);
        if (items.length > 0) break;
      }
      if (depth > 6) continue;
      for (const v of Object.values(value)) {
        if (v && typeof v === "object") {
          stack.push({ value: v, depth: depth + 1 });
        }
      }
    }
  }
  return items;
}

function plexDiscoverHeaders(extra = {}) {
  return {
    "Accept": "application/json",
    "X-Plex-Token": PLEX_DISCOVER_TOKEN,
    "X-Plex-Client-Identifier": PLEX_DISCOVER_CLIENT_ID,
    "X-Plex-Product": PLEX_DISCOVER_PRODUCT,
    "X-Plex-Version": PLEX_DISCOVER_VERSION,
    "X-Plex-Platform": PLEX_DISCOVER_PLATFORM,
    "X-Plex-Platform-Version": PLEX_DISCOVER_PLATFORM_VERSION,
    "X-Plex-Features": PLEX_DISCOVER_FEATURES,
    "X-Plex-Model": PLEX_DISCOVER_MODEL,
    "X-Plex-Device": PLEX_DISCOVER_DEVICE,
    "X-Plex-Device-Screen-Resolution": PLEX_DISCOVER_DEVICE_RES,
    "X-Plex-Provider-Version": PLEX_DISCOVER_PROVIDER_VERSION,
    "X-Plex-Text-Format": PLEX_DISCOVER_TEXT_FORMAT,
    "X-Plex-Drm": PLEX_DISCOVER_DRM,
    "X-Plex-Language": PLEX_DISCOVER_LANGUAGE,
    ...extra,
  };
}

async function plexDiscoverContainer(path, params = {}, headers = {}) {
  if (!hasPlexDiscoverConfig()) {
    throw new Error("Plex Discover not configured");
  }
  const url = new URL(path, PLEX_DISCOVER_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }
  if (!url.searchParams.has("X-Plex-Token")) {
    url.searchParams.set("X-Plex-Token", PLEX_DISCOVER_TOKEN);
  }
  const resp = await fetch(url, {
    headers: plexDiscoverHeaders(headers),
  });
  const text = await resp.text();
  const data = text.trim().startsWith("{") ? JSON.parse(text) : {};
  return { ok: resp.ok, status: resp.status, data };
}

const omdbPosterCache = new Map();

function omdbTypeForItem(item) {
  return item?.type === "show" ? "series" : item?.type === "movie" ? "movie" : null;
}

function omdbLookupKey(item) {
  if (item?.imdbId) return `imdb:${item.imdbId}`;
  const title = typeof item?.title === "string" ? item.title.trim().toLowerCase() : "";
  const year = item?.year ? String(item.year) : "";
  const type = omdbTypeForItem(item) ?? "";
  if (!title) return null;
  return `title:${type}:${year}:${title}`;
}

function buildOmdbLookupUrl(item) {
  if (!hasOmdbConfig()) return null;
  const url = new URL(OMDB_API_URL);
  url.searchParams.set("apikey", OMDB_API_KEY);

  if (item?.imdbId) {
    url.searchParams.set("i", item.imdbId);
    return url;
  }

  if (typeof item?.title !== "string" || !item.title.trim()) return null;
  url.searchParams.set("t", item.title.trim());
  if (item?.year) url.searchParams.set("y", String(item.year));
  const type = omdbTypeForItem(item);
  if (type) url.searchParams.set("type", type);
  return url;
}

async function omdbPosterForItem(item) {
  if (!hasOmdbConfig()) return null;
  const cacheKey = omdbLookupKey(item);
  if (!cacheKey) return null;
  if (omdbPosterCache.has(cacheKey)) {
    return omdbPosterCache.get(cacheKey);
  }

  const url = buildOmdbLookupUrl(item);
  if (!url) return null;

  try {
    const resp = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(2500) : undefined,
    });
    const payload = await resp.json().catch(() => null);
    const poster =
      resp.ok &&
      payload &&
      payload.Response === "True" &&
      typeof payload.Poster === "string" &&
      payload.Poster !== "N/A"
        ? payload.Poster
        : null;

    omdbPosterCache.set(cacheKey, poster);
    return poster;
  } catch {
    return null;
  }
}

async function enrichItemsWithOmdbPoster(items) {
  if (!hasOmdbConfig() || !Array.isArray(items) || items.length === 0) {
    return items;
  }

  const posterEntries = await Promise.all(
    items.map(async (item) => [omdbLookupKey(item), await omdbPosterForItem(item)]),
  );
  const posterByLookup = new Map(posterEntries.filter(([key]) => key));

  return items.map((item) => {
    const poster = posterByLookup.get(omdbLookupKey(item)) ?? null;
    if (!poster) return item;
    if (item.thumbUrl && !isTmdbImageUrl(item.thumbUrl)) return item;
    return { ...item, thumbUrl: poster };
  });
}

const DEFAULT_EXECUTOR = createExecutor({
  mode: EXECUTOR_MODE,
  scriptPath: SCRIPT,
  ssh: {
    host: NAS_HOST,
    username: NAS_USER,
    privateKeyPath: NAS_KEY,
  },
});

const UI_TEMPLATE = fs.readFileSync(new URL("../templates/app-shell.html", import.meta.url), "utf8");
const LOGIN_TEMPLATE = fs.readFileSync(new URL("../templates/login-shell.html", import.meta.url), "utf8");
function buildUiHtml(runToken) {
  return UI_TEMPLATE
    .replaceAll("__RUN_TOKEN__", JSON.stringify(runToken))
    .replaceAll("__TORRENTS_ROOT__", escapeHtml(TORRENTS_ROOT))
    .replaceAll("__MOVIES_ROOT__", escapeHtml(MOVIES_ROOT))
    .replaceAll("__TV_ROOT__", escapeHtml(TV_ROOT));
}

function buildLoginHtml() {
  return LOGIN_TEMPLATE;
}

export function createApp({
  runToken = RUN_TOKEN,
  executor = DEFAULT_EXECUTOR,
  savedTemplatesStore = DEFAULT_SAVED_TEMPLATES_STORE,
  assetsDir = ASSETS_DIR,
  appAuthUser = APP_AUTH_USER,
  appAuthPasswordHash = APP_AUTH_PASSWORD_HASH,
  hasPlexDiscoverConfigFn = hasPlexDiscoverConfig,
  plexDiscoverContainerFn = plexDiscoverContainer,
  enrichItemsWithOmdbPosterFn = enrichItemsWithOmdbPoster,
} = {}) {
  const app = express();
  app.set("trust proxy", true);
  const sessionAuth = createSessionAuth({ appAuthUser, appAuthPasswordHash });
  const auth = createTokenAuth(runToken);
  const uiHtml = buildUiHtml(runToken);
  const loginHtml = buildLoginHtml();

  app.use(sessionAuth.attachSession);
  app.use(express.json({ limit: "64kb" }));
  app.use("/assets", express.static(assetsDir));

  app.get("/api/session", sessionAuth.sessionInfo);
  app.post("/api/session/login", sessionAuth.login);
  app.post("/api/session/logout", sessionAuth.requireSession, auth, sessionAuth.logout);

  // Movie endpoint
  app.post("/api/link/movie", sessionAuth.requireSession, auth, async (req, res) => {
    const { src, title, year } = req.body ?? {};
    if (!isUnder(src, TORRENTS_ROOT)) return res.status(400).json({ ok: false, error: "src must be under torrents" });
    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ ok: false, error: "bad title" });
    if (!/^\d{4}$/.test(String(year ?? ""))) return res.status(400).json({ ok: false, error: "bad year" });

    const r = await executor.linkMovie({ src, title, year });
    res.json({ ok: r.code === 0, code: r.code, stdout: r.stdout, stderr: r.stderr });
  });

  // Season endpoint
  app.post("/api/link/season", sessionAuth.requireSession, auth, async (req, res) => {
    const { srcDir, title, season, year } = req.body ?? {};
    if (!isUnder(srcDir, TORRENTS_ROOT)) return res.status(400).json({ ok: false, error: "srcDir must be under torrents" });
    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ ok: false, error: "bad title" });
    if (!/^\d+$/.test(String(season ?? ""))) return res.status(400).json({ ok: false, error: "bad season" });
    if (!/^\d{4}$/.test(String(year ?? ""))) return res.status(400).json({ ok: false, error: "bad year" });

    const r = await executor.linkSeason({ srcDir, title, season, year });
    res.json({ ok: r.code === 0, code: r.code, stdout: r.stdout, stderr: r.stderr });
  });

  // List Folders
  app.post("/api/list", sessionAuth.requireSession, auth, async (req, res) => {
    const { dir } = req.body ?? {};
    if (typeof dir !== "string") {
      return res.status(400).json({ ok: false, error: "dir required" });
    }

    if (!isAllowedListDir(dir)) {
      return res.status(400).json({ ok: false, error: "dir not allowed" });
    }

    const result = await executor.listDir({ dir });
    if (!result.ok) {
      return res.json({ ok: false, stderr: result.stderr });
    }

    res.json({ ok: true, dir, items: result.items });
  });

  // Plex preview search (pre-match)
  app.post("/api/meta/search", sessionAuth.requireSession, auth, async (req, res) => {
    const { kind, title, year, limit } = req.body ?? {};
    const type =
      kind === "movie" ? 1 :
      kind === "show" ? 2 :
      null;

    if (!type) return res.status(400).json({ ok: false, error: "kind must be movie|show" });
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ ok: false, error: "title required" });
    }
    if (year != null && !/^\d{4}$/.test(String(year))) {
      return res.status(400).json({ ok: false, error: "bad year" });
    }

    if (!hasPlexDiscoverConfigFn()) {
      return res.status(503).json({ ok: false, error: "Plex Discover not configured" });
    }

    const discover = await plexDiscoverContainerFn("/library/search", {
      query: title.trim(),
      limit: Number.isFinite(Number(limit)) ? Number(limit) : 8,
      searchTypes: "availabilityPlatforms,categories,movies,people,tvod,tv",
      searchProviders: "discover,plexAVOD,plexTVOD",
      includeMetadata: 1,
      filterPeople: 1,
    });

    if (!discover.ok) {
      return res.status(discover.status).json({ ok: false, error: "Plex Discover error", details: discover.data });
    }

    let items = extractPlexResults(discover.data?.MediaContainer, kind);

    if (year) {
      const y = String(year);
      const exact = items.filter((i) => i.year && String(i.year) === y);
      if (exact.length > 0) {
        items = exact;
      }
    }

    const max = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(20, Number(limit))) : 8;
    items = await enrichItemsWithOmdbPosterFn(items.slice(0, max));
    res.json({
      ok: true,
      items: items.map(({ imdbId, ...item }) => item),
    });
  });

  app.get("/api/saved-templates", sessionAuth.requireSession, auth, (req, res) => {
    try {
      res.json({
        ok: true,
        items: savedTemplatesStore.list(),
      });
    } catch (error) {
      res.status(503).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post("/api/saved-templates", sessionAuth.requireSession, auth, (req, res) => {
    try {
      const item = savedTemplatesStore.upsert(req.body ?? {});
      res.json({ ok: true, item });
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post("/api/saved-templates/delete", sessionAuth.requireSession, auth, (req, res) => {
    try {
      savedTemplatesStore.delete(req.body?.id);
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // UI
  app.get("/", (req, res) => {
    res.set("Cache-Control", "no-store");
    if (sessionAuth.isAuthenticated(req)) {
      return res.type("html").send(uiHtml);
    }
    return res.type("html").send(loginHtml);
  });

  return app;
}

export function startServer({
  app = createApp(),
  port = PORT,
  host = "127.0.0.1",
} = {}) {
  const server = app.listen(port, host, () => {
    const address = server.address();
    const listenPort =
      address && typeof address === "object" && "port" in address
        ? address.port
        : port;
    console.log(`Open: http://127.0.0.1:${listenPort} (executor=${EXECUTOR_MODE})`);
  });

  return server;
}
