import express from "express";
import { createSessionAuth, createTokenAuth } from "./auth/session-auth.mjs";
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
} from "./metadata/media-metadata.mjs";
import { registerAppRoutes } from "./routes/index.mjs";
import { buildLoginHtml, buildUiHtml } from "./ui/ui-renderer.mjs";

export function createApp({
  runToken = runtimeConfig.runToken,
  executor = defaultExecutor,
  savedTemplatesStore = defaultSavedTemplatesStore,
  appAssetsDir = runtimeConfig.appAssetsDir,
  vendorAssetsDir = runtimeConfig.vendorAssetsDir,
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
  app.use("/assets/app", express.static(appAssetsDir));
  app.use("/assets/vendor", express.static(vendorAssetsDir));
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
