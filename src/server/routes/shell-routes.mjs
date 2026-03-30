export function registerShellRoutes({ app, loginHtml, sessionAuth, uiHtml } = {}) {
  app.get("/", (req, res) => {
    res.set("Cache-Control", "no-store");
    if (sessionAuth.isAuthenticated(req)) {
      return res.type("html").send(uiHtml);
    }
    return res.type("html").send(loginHtml);
  });
}
