import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSeasonPlan,
  classifySeasonPlanRow,
  resolveSeasonPlanRowSeason,
} from "../src/ui/season-plan.mjs";

const ROOT = "/volume1/Movies/qbt-downloads/Bundle";

test("season plan builder classifies first-level folders and skips root files", () => {
  const plan = buildSeasonPlan(ROOT, [
    { path: `${ROOT}/S01 - Random Rip Name`, name: "S01 - Random Rip Name", type: "d" },
    { path: `${ROOT}/Disc 1 - S02`, name: "Disc 1 - S02", type: "d" },
    { path: `${ROOT}/Specials`, name: "Specials", type: "d" },
    { path: `${ROOT}/Weird Folder`, name: "Weird Folder", type: "d" },
    { path: `${ROOT}/README.nfo`, name: "README.nfo", type: "f" },
  ]);

  assert.equal(plan.rootPath, ROOT);
  assert.equal(plan.summary.folderCount, 4);
  assert.equal(plan.summary.candidateCount, 2);
  assert.equal(plan.summary.ignoredCount, 1);
  assert.equal(plan.summary.ambiguousCount, 1);
  assert.equal(plan.summary.rootFileCount, 1);
  assert.deepEqual(plan.rows.map((row) => row.hint), [
    "candidate",
    "candidate",
    "ignored",
    "ambiguous",
  ]);
  assert.deepEqual(plan.rows.map((row) => row.include), [true, true, false, false]);
  assert.deepEqual(plan.rows.map((row) => row.inferredSeason), ["01", "02", "", ""]);
});

test("season plan rows remain manually overridable regardless of scan hint", () => {
  const ignoredRow = classifySeasonPlanRow({
    path: `${ROOT}/Specials`,
    name: "Specials",
    type: "d",
  });
  assert.equal(ignoredRow.hint, "ignored");
  assert.equal(resolveSeasonPlanRowSeason(ignoredRow), "");

  ignoredRow.include = true;
  ignoredRow.seasonOverride = "7";
  assert.equal(resolveSeasonPlanRowSeason(ignoredRow), "07");
});

