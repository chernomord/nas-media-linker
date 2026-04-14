import {
  isAllowedListDir,
  isUnder,
  TORRENTS_ROOT,
} from "../../core/executor.mjs";

export function registerLinkRoutes({ app, auth, executor, sessionAuth } = {}) {
  app.post("/api/link/movie", sessionAuth.requireSession, auth, async (req, res) => {
    const { src, title, year } = req.body ?? {};
    if (!isUnder(src, TORRENTS_ROOT)) return res.status(400).json({ ok: false, error: "src must be under torrents" });
    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ ok: false, error: "bad title" });
    if (!/^\d{4}$/.test(String(year ?? ""))) return res.status(400).json({ ok: false, error: "bad year" });

    const result = await executor.linkMovie({ src, title, year });
    res.json({ ok: result.code === 0, code: result.code, stdout: result.stdout, stderr: result.stderr });
  });

  app.post("/api/link/season", sessionAuth.requireSession, auth, async (req, res) => {
    const { srcDir, title, season, year, resetTarget } = req.body ?? {};
    if (!isUnder(srcDir, TORRENTS_ROOT)) return res.status(400).json({ ok: false, error: "srcDir must be under torrents" });
    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ ok: false, error: "bad title" });
    if (!/^\d+$/.test(String(season ?? ""))) return res.status(400).json({ ok: false, error: "bad season" });
    if (!/^\d{4}$/.test(String(year ?? ""))) return res.status(400).json({ ok: false, error: "bad year" });

    const input = {
      srcDir,
      title,
      season,
      year,
    };
    if (resetTarget === true) {
      input.resetTarget = true;
    }

    const result = await executor.linkSeason(input);
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
}
