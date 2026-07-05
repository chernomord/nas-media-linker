# Multi-season torrent planner

## Context
- Current season linking assumes `one source dir -> one season`.
- Some torrents store multiple seasons as sibling first-level folders.
- We do not want recursive auto-detection or ML-style guessing.
- User review is the authoritative step.

## Decision
- Add a manual `scan -> review -> run` flow for a selected torrent root.
- Keep the model to two levels only:
  - `PlanContainer`
  - `PlanRow`
- Each row gets a scan hint, but the user can always:
  - include it;
  - exclude it;
  - override the season number.
- Do not introduce separate `candidate / ignored / ambiguous` entities.
  These are only hints on the row.

## Invariants
- Scan only the first level under the selected root.
- Do not recurse deeper during plan construction.
- A row may be manually included even if the scan marked it as ignored or ambiguous.
- Manual season override wins over inferred season.
- Execution is per-row and may be partial.
- Single-season fast path stays available.

## Shape
| Entity | Fields | Meaning |
|---|---|---|
| `PlanContainer` | `rootPath`, `rows[]`, `summary` | One scan snapshot for one torrent root |
| `PlanRow` | `path`, `name`, `hint`, `inferredSeason`, `include`, `seasonOverride`, `result` | One first-level folder with user-editable decisions |

## UX Sketch

### Root scan
```text
+--------------------------------------------------------------+
| Multi-season torrent                                         |
|--------------------------------------------------------------|
| Torrent root                                                 |
| [ /volume1/Movies/qbt-downloads/Some.Show.Bundle     v ]     |
| [ Scan root ]                                                |
|                                                              |
| Hint: scan only reads first-level folders                    |
+--------------------------------------------------------------+
```

### Review table
```text
+----------------------------------------------------------------------------+
| Season plan                                                                |
|----------------------------------------------------------------------------|
| Folder                    | Hint       | Include | Season | Status        |
|-------------------------- |------------|---------|--------|---------------|
| S01 - Random Rip Name     | candidate  | [x]     | 01     | ready         |
| Disc 1 - S02              | candidate  | [x]     | 02     | ready         |
| Specials                  | ignored    | [ ]     | -      | excluded      |
| Season Three?             | ambiguous  | [ ]     | -      | needs review  |
|                                                                            |
| Batch actions: [Include all] [Exclude all] [Run batch]                     |
+----------------------------------------------------------------------------+
```

### Row edit
```text
+--------------------------------------------------------------+
| Edit row                                                     |
|--------------------------------------------------------------|
| Folder: Season Three?                                        |
| Hint: ambiguous                                              |
|                                                              |
| Include: [x]                                                 |
| Season:  [ 03 ]                                              |
|                                                              |
| [Save row]   [Cancel]                                        |
+--------------------------------------------------------------+
```

### Result
```text
+------------------------------------------------------------------+
| Batch execution                                                  |
|------------------------------------------------------------------|
| Pending: 1   Linked: 4   Skipped: 1   Failed: 0                 |
|------------------------------------------------------------------|
| S01 - Random Rip Name   -> Linked                               |
| Disc 1 - S02            -> Linked                               |
| Specials                -> Ignored                              |
| Season Three?           -> Linked (manual season 03)           |
|------------------------------------------------------------------|
| [Open log]   [Retry failed only]   [Back to plan]               |
+------------------------------------------------------------------+
```

## Validation
- Unit-test the row classifier.
- Unit-test plan construction from first-level folder lists.
- Unit-test manual season override precedence.
- Keep the current executor/link endpoints unchanged for single-season runs.
