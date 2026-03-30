import path from "node:path";
import { pathToFileURL } from "node:url";

import { createApp, startServer } from "./src/server/app.mjs";

export { createApp, startServer } from "./src/server/app.mjs";

const IS_MAIN = (() => {
  if (!process.argv[1]) return false;
  return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
})();

if (IS_MAIN) {
  startServer();
}
