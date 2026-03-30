export function registerSavedTemplateRoutes({ app, auth, savedTemplatesStore, sessionAuth } = {}) {
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
}
