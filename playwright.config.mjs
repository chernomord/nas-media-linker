import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.UI_REGRESSION_PORT || 4173);
const tmpDir = process.env.TMPDIR || "/tmp";

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
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
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
