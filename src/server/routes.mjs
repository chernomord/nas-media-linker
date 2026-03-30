import {
  isAllowedListDir,
  isUnder,
  TORRENTS_ROOT,
} from "../../lib/executor.mjs";
import { extractPlexResults } from "./metadata.mjs";

export function registerAppRoutes({
  app,
  auth,
  executor,
  hasPlexDiscoverConfigFn,
  enrichItemsWithOmdbPosterFn,
  loginHtml,
  plexDiscoverContainerFn,
  savedTemplatesStore,
  sessionAuth,
  uiHtml,
} = {}) {
  app.get("/api/session", sessionAuth.sessionInfo);
  app.post("/api/session/login", sessionAuth.login);
  app.post("/api/session/logout", sessionAuth.requireSession, auth, sessionAuth.logout);

  app.post("/api/link/movie", sessionAuth.requireSession, auth, async (req, res) => {
    const { src, title, year } = req.body ?? {};
    if (!isUnder(src, TORRENTS_ROOT)) return res.status(400).json({ ok: false, error: "src must be under torrents" });
    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ ok: false, error: "bad title" });
    if (!/^\d{4}$/.test(String(year ?? ""))) return res.status(400).json({ ok: false, error: "bad year" });

    const result = await executor.linkMovie({ src, title, year });
    res.json({ ok: result.code === 0, code: result.code, stdout: result.stdout, stderr: result.stderr });
  });

  app.post("/api/link/season", sessionAuth.requireSession, auth, async (req, res) => {
    const { srcDir, title, season, year } = req.body ?? {};
    if (!isUnder(srcDir, TORRENTS_ROOT)) return res.status(400).json({ ok: false, error: "srcDir must be under torrents" });
    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ ok: false, error: "bad title" });
    if (!/^\d+$/.test(String(season ?? ""))) return res.status(400).json({ ok: false, error: "bad season" });
    if (!/^\d{4}$/.test(String(year ?? ""))) return res.status(400).json({ ok: false, error: "bad year" });

    const result = await executor.linkSeason({ srcDir, title, season, year });
    res.json({ ok: result.code === 0, code: result.code, stdout: result.stdout, stderr: result.stderr });
  });

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
      const requestedYear = String(year);
      const exact = items.filter((item) => item.year && String(item.year) === requestedYear);
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

  app.get("/", (req, res) => {
    res.set("Cache-Control", "no-store");
    if (sessionAuth.isAuthenticated(req)) {
      return res.type("html").send(uiHtml);
    }
    return res.type("html").send(loginHtml);
  });
}
