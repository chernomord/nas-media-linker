import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_PATH = path.join(REPO_ROOT, "server.mjs");

test("configured Plex discover token is used server-side but not leaked to delivered responses", () => {
  const token = "plex-discover-secret-token";
  const script = `
    import { once } from "node:events";
    import { pathToFileURL } from "node:url";

    const serverUrl = pathToFileURL(${JSON.stringify(SERVER_PATH)}).href;
    const { createApp } = await import(serverUrl);

    const observed = { urlContainsToken: false, headerContainsToken: false };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init = {}) => {
      const url = String(input);
      if (!url.startsWith("https://discover.example.test")) {
        return originalFetch(input, init);
      }
      const headers = init.headers ?? {};
      observed.urlContainsToken = url.includes(${JSON.stringify(token)});
      observed.headerContainsToken =
        headers["X-Plex-Token"] === ${JSON.stringify(token)} ||
        headers["x-plex-token"] === ${JSON.stringify(token)};
      return new Response(JSON.stringify({
        MediaContainer: {
          Metadata: [
            {
              title: "Frieren: Beyond Journey's End",
              year: 2023,
              type: "show",
              summary: "Elf mage travels on.",
              guid: "imdb://tt22248376",
              thumb: "https://image.tmdb.org/t/p/original/poster-a.jpg",
            }
          ]
        }
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const app = createApp({
      runToken: "test-token",
      executor: {
        async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
        async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
        async listDir() { return { ok: true, code: 0, items: [] }; },
      },
      savedTemplatesStore: {
        list() { return []; },
        upsert() { throw new Error("not used"); },
        delete() { throw new Error("not used"); },
      },
    });

    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    const baseUrl = "http://127.0.0.1:" + address.port;

    try {
      const html = await fetch(baseUrl + "/").then((r) => r.text());
      const apiPayload = await fetch(baseUrl + "/api/meta/search", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-run-token": "test-token",
        },
        body: JSON.stringify({
          kind: "show",
          title: "Frieren",
        }),
      }).then((r) => r.text());

      console.log(JSON.stringify({
        urlContainsToken: observed.urlContainsToken,
        headerContainsToken: observed.headerContainsToken,
        htmlContainsToken: html.includes(${JSON.stringify(token)}),
        apiContainsToken: apiPayload.includes(${JSON.stringify(token)}),
      }));
    } finally {
      globalThis.fetch = originalFetch;
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  `;

  const result = spawnSync(process.execPath, ["--experimental-sqlite", "--input-type=module", "-e", script], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PLEX_DISCOVER_URL: "https://discover.example.test",
      PLEX_DISCOVER_TOKEN: token,
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(result.stdout.trim());
  assert.equal(summary.urlContainsToken, true);
  assert.equal(summary.headerContainsToken, true);
  assert.equal(summary.htmlContainsToken, false);
  assert.equal(summary.apiContainsToken, false);
});
