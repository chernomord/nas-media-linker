import test from "node:test";
import assert from "node:assert/strict";

import { parseSeasonLinkSummary } from "../src/ui/season-link-summary.mjs";

test("parseSeasonLinkSummary extracts linked and skipped counts", () => {
  assert.deepEqual(
    parseSeasonLinkSummary(`
Linked season:
  show: Show (2025)
  season: 02
  linked: 1
  skipped: 3
`),
    { linked: 1, skipped: 3 },
  );
});

test("parseSeasonLinkSummary falls back to zero when counters are missing", () => {
  assert.deepEqual(parseSeasonLinkSummary("Linked season:\n  show: Show"), {
    linked: 0,
    skipped: 0,
  });
});
