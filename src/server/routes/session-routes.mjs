export function registerSessionRoutes({ app, auth, sessionAuth } = {}) {
  app.get("/api/session", sessionAuth.sessionInfo);
  app.post("/api/session/login", sessionAuth.login);
  app.post("/api/session/logout", sessionAuth.requireSession, auth, sessionAuth.logout);
}
