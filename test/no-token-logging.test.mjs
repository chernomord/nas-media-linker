import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HELPER_PATH = path.join(REPO_ROOT, "helper.mjs");

function waitForOpen(child, stdoutChunks, stderrChunks) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const maybeResolve = () => {
      const stdout = stdoutChunks.join("");
      const match = stdout.match(/Open: http:\/\/127\.0\.0\.1:(\d+) \(executor=/);
      if (match && !settled) {
        settled = true;
        resolve(Number(match[1]));
      }
    };

    child.stdout.on("data", (chunk) => {
      stdoutChunks.push(String(chunk));
      maybeResolve();
    });
    child.stderr.on("data", (chunk) => {
      stderrChunks.push(String(chunk));
    });
    child.once("exit", (code, signal) => {
      if (settled) return;
      settled = true;
      reject(
        new Error(
          `helper exited before startup (code=${code}, signal=${signal})\n` +
            stdoutChunks.join("") +
            stderrChunks.join(""),
        ),
      );
    });
    maybeResolve();
  });
}

function stopChild(child) {
  return new Promise((resolve, reject) => {
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode == null && child.signalCode == null) {
        child.kill("SIGKILL");
      }
    }, 1000).unref();
    child.once("error", reject);
  });
}

test("helper startup logs do not contain runtime token or discover token", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "nas-linker-no-token-log-"));
  const discoverToken = "plex-discover-secret-token";
  const stdoutChunks = [];
  const stderrChunks = [];
  const child = spawn(process.execPath, ["--experimental-sqlite", HELPER_PATH], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      EXECUTOR_MODE: "node",
      PORT: "0",
      UX_STATE_DB_PATH: path.join(base, "ux-state.sqlite"),
      PLEX_DISCOVER_URL: "https://discover.example.test",
      PLEX_DISCOVER_TOKEN: discoverToken,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    const port = await waitForOpen(child, stdoutChunks, stderrChunks);
    const html = await fetch(`http://127.0.0.1:${port}/`).then((resp) => resp.text());
    const match = html.match(/const RUN_TOKEN = "([^"]+)";/);
    assert.ok(match, "RUN_TOKEN should be embedded in delivered HTML");
    const runtimeToken = match[1];

    await stopChild(child);

    const combinedLogs = stdoutChunks.join("") + stderrChunks.join("");
    assert.doesNotMatch(combinedLogs, new RegExp(discoverToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(combinedLogs, new RegExp(runtimeToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  } finally {
    if (child.exitCode == null && child.signalCode == null) {
      await stopChild(child);
    }
    await rm(base, { recursive: true, force: true });
  }
});
