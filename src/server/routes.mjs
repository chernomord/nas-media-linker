import { registerLinkRoutes } from "./routes/link-routes.mjs";
import { registerMetadataRoutes } from "./routes/metadata-routes.mjs";
import { registerSavedTemplateRoutes } from "./routes/saved-template-routes.mjs";
import { registerSessionRoutes } from "./routes/session-routes.mjs";
import { registerShellRoutes } from "./routes/shell-routes.mjs";

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
  registerSessionRoutes({ app, auth, sessionAuth });
  registerLinkRoutes({ app, auth, executor, sessionAuth });
  registerMetadataRoutes({
    app,
    auth,
    enrichItemsWithOmdbPosterFn,
    hasPlexDiscoverConfigFn,
    plexDiscoverContainerFn,
    sessionAuth,
  });
  registerSavedTemplateRoutes({ app, auth, savedTemplatesStore, sessionAuth });
  registerShellRoutes({ app, loginHtml, sessionAuth, uiHtml });
}
