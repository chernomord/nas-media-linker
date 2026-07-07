import fs from "node:fs";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";
import { chromium } from "playwright";

const port = Number(process.env.UI_REGRESSION_PORT || 4173);
const tmpDir = process.env.TMPDIR || "/tmp";
const launchArgs =
  process.platform === "darwin" && process.env.CODEX_SANDBOX
    ? ["--single-process", "--disable-gpu", "--disable-webgl"]
    : [];
const executablePath = getChromiumExecutablePath();

function getChromiumExecutablePath() {
  if (process.platform !== "darwin" || !process.env.CODEX_SANDBOX) {
    return chromium.executablePath();
  }

  const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!browsersPath) {
    return chromium.executablePath();
  }

  const shellDir = fs
    .readdirSync(browsersPath, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name.startsWith("chromium_headless_shell-"));

  if (!shellDir) {
    return chromium.executablePath();
  }

  const shellArch = process.arch === "arm64" ? "arm64" : "x64";
  const shellPath = path.join(
    browsersPath,
    shellDir.name,
    `chrome-headless-shell-mac-${shellArch}`,
    "chrome-headless-shell",
  );

  return fs.existsSync(shellPath) ? shellPath : chromium.executablePath();
}

export default defineConfig({
  testDir: "./test-ui",
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  outputDir: path.join(tmpDir, "nas-linker-playwright-results"),
    use: {
      ...devices["Desktop Chrome"],
      baseURL: `http://127.0.0.1:${port}`,
      trace: "retain-on-failure",
      screenshot: "only-on-failure",
      video: "off",
      launchOptions: {
        executablePath,
        args: launchArgs,
      },
    },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath,
          args: launchArgs,
        },
      },
    },
  ],
  webServer: {
    command: "node --experimental-sqlite test-ui/ui-regression-server.mjs",
    url: `http://127.0.0.1:${port}/`,
    cwd: process.cwd(),
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      ...process.env,
      UI_REGRESSION_PORT: String(port),
    },
  },
});
