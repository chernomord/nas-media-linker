import { discoverConfig, omdbConfig } from "./config.mjs";

export function hasPlexDiscoverConfig() {
  return Boolean(discoverConfig.url && discoverConfig.token);
}

function hasOmdbConfig() {
  return Boolean(omdbConfig.url && omdbConfig.apiKey);
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

function extractImdbId(item) {
  const matchers = [
    item?.guid,
    item?.Guid,
    item?.guids,
    item?.Guids,
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

function normalizePlexItem(item, fallbackType) {
  const thumb = item.thumb ?? null;
  const art = item.art ?? null;
  const thumbPath = typeof thumb === "string" && thumb.startsWith("/") ? thumb : null;
  const thumbUrl = typeof thumb === "string" && thumb.startsWith("http") ? thumb : null;
  const artPath = typeof art === "string" && art.startsWith("/") ? art : null;
  const artUrl = typeof art === "string" && art.startsWith("http") ? art : null;
  return {
    title: item.title ?? "",
    year: item.year ?? null,
    type: item.type ?? fallbackType,
    score: item.score ?? null,
    summary: item.summary ?? "",
    guid: item.guid ?? null,
    ratingKey: item.ratingKey ?? null,
    imdbId: extractImdbId(item),
    thumbUrl,
    thumbPath,
    artUrl,
    artPath,
  };
}

export function extractPlexResults(container, kind) {
  const items = [];
  const fallbackType = kind === "movie" ? "movie" : "show";

  const addItems = (arr) => {
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      if (kind === "movie" && item.type && item.type !== "movie") continue;
      if (kind === "show" && item.type && item.type !== "show") continue;
      items.push(normalizePlexItem(item, fallbackType));
    }
  };

  addItems(container?.Metadata ?? []);

  for (const hub of container?.Hub ?? []) {
    addItems(hub?.Metadata ?? []);
  }

  for (const result of container?.SearchResults ?? []) {
    addItems(result?.Metadata ?? []);
    addItems(result?.Results ?? []);
    if (result?.Media) addItems(result.Media);
    for (const entry of result?.SearchResult ?? []) {
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
      for (const entry of Object.values(value)) {
        if (entry && typeof entry === "object") {
          stack.push({ value: entry, depth: depth + 1 });
        }
      }
    }
  }
  return items;
}

function plexDiscoverHeaders(extra = {}) {
  return {
    Accept: "application/json",
    "X-Plex-Token": discoverConfig.token,
    "X-Plex-Client-Identifier": discoverConfig.clientId,
    "X-Plex-Product": discoverConfig.product,
    "X-Plex-Version": discoverConfig.version,
    "X-Plex-Platform": discoverConfig.platform,
    "X-Plex-Platform-Version": discoverConfig.platformVersion,
    "X-Plex-Features": discoverConfig.features,
    "X-Plex-Model": discoverConfig.model,
    "X-Plex-Device": discoverConfig.device,
    "X-Plex-Device-Screen-Resolution": discoverConfig.deviceResolution,
    "X-Plex-Provider-Version": discoverConfig.providerVersion,
    "X-Plex-Text-Format": discoverConfig.textFormat,
    "X-Plex-Drm": discoverConfig.drm,
    "X-Plex-Language": discoverConfig.language,
    ...extra,
  };
}

export async function plexDiscoverContainer(path, params = {}, headers = {}) {
  if (!hasPlexDiscoverConfig()) {
    throw new Error("Plex Discover not configured");
  }
  const url = new URL(path, discoverConfig.url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  if (!url.searchParams.has("X-Plex-Token")) {
    url.searchParams.set("X-Plex-Token", discoverConfig.token);
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
  const url = new URL(omdbConfig.url);
  url.searchParams.set("apikey", omdbConfig.apiKey);

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

export async function enrichItemsWithOmdbPoster(items) {
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
