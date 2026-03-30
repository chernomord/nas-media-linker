import { extractPlexResults } from "../metadata.mjs";

export function registerMetadataRoutes({
  app,
  auth,
  enrichItemsWithOmdbPosterFn,
  hasPlexDiscoverConfigFn,
  plexDiscoverContainerFn,
  sessionAuth,
} = {}) {
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
}
