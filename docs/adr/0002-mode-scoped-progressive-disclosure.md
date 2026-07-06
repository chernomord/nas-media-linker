# ADR 0002: Mode-scoped progressive disclosure for season linking

Status: active
Date: 2026-07-06
Supersedes: none
Related:
- [docs/adr/0001-season-linking-operators.md](/Users/slavakomarov/Misc%20Projects/nas-linker-public/docs/adr/0001-season-linking-operators.md)
- [docs/adr/0003-season-linking-density-budget.md](/Users/slavakomarov/Misc%20Projects/nas-linker-public/docs/adr/0003-season-linking-density-budget.md)
- [docs/ui_task.yaml](/Users/slavakomarov/Misc%20Projects/nas-linker-public/docs/ui_task.yaml)

## Context
- The season-linking screen combines a shared context with two distinct operators:
  - single-season linking
  - multi-season batch review/linking
- When both operators stay equally visible, the screen feels overloaded and hard to scan.
- The batch operator is only useful after scan data exists.
- The batch operator should not inherit single-season validation or visual weight.

## Decision
- Use progressive disclosure by mode:
  - keep the shared header visible
  - keep single-season actions visible
  - hide or de-emphasize batch controls until scan results exist
  - surface batch context in the batch header, not in a secondary controls row
- Validate each mode independently.
- Let batch readiness depend on shared title/year plus runnable review rows, not on the single-season season field.

## Decision drivers
- Reduce perceived overload without inventing new domain concepts.
- Make the screen answer one operator at a time.
- Prevent irrelevant fields from blocking the wrong action.
- Keep the current two-level model intact.

## Alternatives considered

### 1. Keep everything visible at once
- Pros:
  - simplest to implement
  - no mode switching logic
- Cons:
  - high scan cost
  - batch looks like part of the same contract as single-season linking
  - the screen keeps feeling crowded

### 2. Split into two separate pages
- Pros:
  - the two operators become very explicit
  - no shared-state confusion
- Cons:
  - too much navigation
  - duplicates the shared header
  - increases operational friction

### 3. Shared header + progressive disclosure by mode
- Pros:
  - keeps common context in one place
  - reduces visible complexity until batch is relevant
  - preserves the two-operator model
  - keeps validation local to each operator
- Cons:
  - slightly more UI state to manage

## Consequences
- Batch review remains hidden until scan data exists.
- Batch controls can carry their own compact context and reset semantics.
- Single-season linking stays fast and direct.
- Shared header remains the stable anchor for both modes.
- The screen becomes easier to scan because only the active operator carries full weight.
- Batch stays expanded after execution for now; collapse behavior is deferred until real usage shows it is worth adding.
- `Save` stays shared for now; splitting it by mode would require sqlite and API contract migration, so that work is deferred.

## Invariants
- No new domain entities.
- No shared validator that makes batch depend on single-season season input.
- No silent shift from shared header into hidden state authority.
- Destructive reset keeps the same meaning across modes.
- Manual row overrides remain authoritative for batch execution.

## Validation plan
- UI regression:
  - batch stays hidden until scan yields rows
  - batch becomes visible after scan
  - batch does not require top-level season
  - batch disables when title/year are absent
- Manual review:
  - confirm the screen scans as one shared header plus two mode-specific action surfaces
- Usability check:
  - verify the screen feels lighter before scan and still exposes enough context after scan

## Open questions
- Whether the single-season block should eventually be visually separated more strongly from batch review.
