# ADR 0001: Separate single-season and batch season-linking contracts

Status: active
Date: 2026-07-06
Supersedes: none
Related:
- [docs/ui_task.yaml](/Users/slavakomarov/Misc%20Projects/nas-linker-public/docs/ui_task.yaml)
- [archive/historical-notes/multi-season-torrent-planner.md](/Users/slavakomarov/Misc%20Projects/nas-linker-public/archive/historical-notes/multi-season-torrent-planner.md)

## Context
- The current season-linking UX serves two different operators:
  - single-season linking
  - multi-season batch review/linking
- They share some inputs, but the validity rules are not the same.
- The single-season flow needs an explicit season number at the top level.
- The batch flow must not require that top-level season field, because each row can carry its own season override.
- Forcing one shared form contract makes the UI feel split, bulky, and misleading.

## Decision
- Keep one shared header for the common context:
  - source folder
  - title
  - year
- Split the action surface into two distinct operators:
  - single-season link
  - multi-season batch review/link
- Validate each operator separately.
- Do not let batch availability depend on the single-season season field.
- Keep the destructive reset meaning identical in both flows, but present it with separate labels.

## Why
- The UI should match the actual state model.
- A shared validator creates a false dependency between unrelated actions.
- Batch should be driven by scan results and row-level overrides, not by the single-season season input.
- The shared header reduces duplication without merging the two operators.

## Alternatives considered

### 1. Keep one merged season form
- Pros:
  - fewer visible blocks
  - less code duplication
- Cons:
  - batch remains coupled to irrelevant season validation
  - the form reads as if it has one contract when it does not
  - user intent is harder to parse

### 2. Split into two fully separate pages
- Pros:
  - clear contracts
  - no validation ambiguity
- Cons:
  - too much navigation
  - duplicated shared context
  - higher cognitive and maintenance cost than necessary

### 3. Shared header + two action surfaces
- Pros:
  - clear contracts
  - shared common context
  - batch and single flows stay operationally distinct
  - easier to validate and explain
- Cons:
  - still more complex than a pure single-action screen

## Consequences
- Single-season and batch flows must be validated independently.
- Batch button enablement must depend on:
  - valid title
  - valid year
  - at least one runnable reviewed row
- Single-season link must continue to require:
  - source folder
  - title
  - season
  - year
- The batch section can be hidden until scan data exists.
- The batch header should carry context so the user can see which title/year the batch will use.

## Decision drivers
- Keep shared input only where the contract is actually shared.
- Prevent batch from inheriting irrelevant single-season validation.
- Make the UI match the state model instead of hiding two operators under one form.
- Reduce operator confusion without duplicating the whole screen.

## Invariants
- No new domain entities.
- No hidden dependency from batch to single-season season validation.
- No silent promotion of batch review into a separate backend model.
- Destructive reset keeps the same meaning in both flows.
- Manual row overrides remain authoritative for batch execution.

## UX sketch

### Shared header
```text
+--------------------------------------------------------------+
| Season link                                                  |
|--------------------------------------------------------------|
| Source folder: [ Torrents / ...                         v ]   |
| Title:        [ The Boys                                   ] |
| Year:         [ 2019 ]                                       |
+--------------------------------------------------------------+
```

### Single-season action surface
```text
+--------------------------------------------------------------+
| Single season link                                           |
|--------------------------------------------------------------|
| Season:       [ 05 ]                                         |
| [ Link season ]   [ Save ]   [ Reset target before linking ] |
+--------------------------------------------------------------+
```

### Batch action surface
```text
+--------------------------------------------------------------+
| Multi-season review                            Uses: title · year |
|--------------------------------------------------------------|
| [ Rescan ]                                                   |
| Reset target before batch [ ]   [ Clear review ] [ Link batch ] |
|                                                              |
| Folder | Hint | Include | Season | Status                    |
| ...                                                          |
+--------------------------------------------------------------+
```

## Validation plan
- Unit-test the validators separately:
  - single-season validity
  - batch validity
- Add UI regression coverage for:
  - batch disabled when title/year are empty
  - batch enabled when title/year are present and rows are runnable
  - single-season still requires season number
- Keep a browser check for the batch context text if the header becomes dynamic.

## Open questions
- Whether `Save` should remain visible in both surfaces or be narrowed to the single-season flow.
- Whether the single-season and batch surfaces should eventually be split more aggressively once the current confusion is gone.
