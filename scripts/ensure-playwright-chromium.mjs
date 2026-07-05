import fs from "node:fs";
import { spawnSync } from "node:child_process";

import { chromium } from "playwright";

const executablePath = chromium.executablePath();

if (fs.existsSync(executablePath)) {
  process.exit(0);
}

const install = spawnSync(
  "npx",
  ["playwright", "install", "chromium"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
    },
  },
);

if (install.error) {
  console.error(install.error);
  process.exit(1);
}

process.exit(install.status ?? 1);
