import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_PATH = path.join(REPO_ROOT, "server.mjs");

function waitForOpen(child, stdoutChunks, stderrChunks) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const maybeResolve = () => {
      const stdout = stdoutChunks.join("");
      const match = stdout.match(/Open: http:\/\/127\.0\.0\.1:(\d+) \(executor=(.+)\)/);
      if (match && !settled) {
        settled = true;
        resolve({ port: Number(match[1]), executor: match[2] });
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

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    const stdoutChunks = [];
    const stderrChunks = [];
    child.stdout.on("data", (chunk) => stdoutChunks.push(String(chunk)));
    child.stderr.on("data", (chunk) => stderrChunks.push(String(chunk)));
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      resolve({
        code,
        signal,
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
      });
    });
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

test("helper starts without executor-specific env", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "nas-linker-node-mode-"));
  const stdoutChunks = [];
  const stderrChunks = [];
  const child = spawn(process.execPath, ["--experimental-sqlite", SERVER_PATH], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PORT: "0",
      UX_STATE_DB_PATH: path.join(base, "ux-state.sqlite"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    const started = await waitForOpen(child, stdoutChunks, stderrChunks);
    assert.equal(started.executor, "node");
  } finally {
    if (child.exitCode == null && child.signalCode == null) {
      await stopChild(child);
    }
    await rm(base, { recursive: true, force: true });
  }
});

test("helper fails fast with invalid PORT value", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "nas-linker-bad-port-"));
  const child = spawn(process.execPath, ["--experimental-sqlite", SERVER_PATH], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PORT: "70000",
      UX_STATE_DB_PATH: path.join(base, "ux-state.sqlite"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    const exited = await waitForExit(child);
    assert.notEqual(exited.code, 0);
    assert.match(exited.stderr + exited.stdout, /PORT must be an integer between 0 and 65535, got: 70000/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
