import { registerLinkRoutes } from "./link-routes.mjs";
import { registerMetadataRoutes } from "./metadata-routes.mjs";
import { registerSavedTemplateRoutes } from "./saved-templates-routes.mjs";
import { registerSessionRoutes } from "./session-routes.mjs";
import { registerShellRoutes } from "./shell-routes.mjs";

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
