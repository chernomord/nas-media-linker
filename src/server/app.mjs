import express from "express";
import { createSessionAuth, createTokenAuth } from "./auth.mjs";
import {
  appAuthConfig,
  defaultExecutor,
  defaultSavedTemplatesStore,
  runtimeConfig,
} from "./config.mjs";
import {
  enrichItemsWithOmdbPoster,
  hasPlexDiscoverConfig,
  plexDiscoverContainer,
} from "./metadata.mjs";
import { registerAppRoutes } from "./routes.mjs";
import { buildLoginHtml, buildUiHtml } from "./ui-renderer.mjs";

export function createApp({
  runToken = runtimeConfig.runToken,
  executor = defaultExecutor,
  savedTemplatesStore = defaultSavedTemplatesStore,
  assetsDir = runtimeConfig.assetsDir,
  appAuthUser = appAuthConfig.user,
  appAuthPasswordHash = appAuthConfig.passwordHash,
  hasPlexDiscoverConfigFn = hasPlexDiscoverConfig,
  plexDiscoverContainerFn = plexDiscoverContainer,
  enrichItemsWithOmdbPosterFn = enrichItemsWithOmdbPoster,
} = {}) {
  const app = express();
  app.set("trust proxy", true);
  const sessionAuth = createSessionAuth({
    appAuthUser,
    appAuthPasswordHash,
    cookieName: appAuthConfig.sessionCookie,
    sessionTtlMs: appAuthConfig.sessionTtlMs,
    sessionIdleMs: appAuthConfig.sessionIdleMs,
  });
  const auth = createTokenAuth(runToken);
  const uiHtml = buildUiHtml(runToken);
  const loginHtml = buildLoginHtml();

  app.use(sessionAuth.attachSession);
  app.use(express.json({ limit: "64kb" }));
  app.use("/assets", express.static(assetsDir));
  registerAppRoutes({
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
  });

  return app;
}

export function startServer({
  app = createApp(),
  port = runtimeConfig.port,
  host = "127.0.0.1",
} = {}) {
  const server = app.listen(port, host, () => {
    const address = server.address();
    const listenPort =
      address && typeof address === "object" && "port" in address
        ? address.port
        : port;
    console.log(`Open: http://127.0.0.1:${listenPort} (executor=${runtimeConfig.executorMode})`);
  });

  return server;
}
