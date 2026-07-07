# ADR 0003: Season-linking density budget and surface hierarchy

Status: active
Date: 2026-07-06
Supersedes: none
Related:
- [docs/adr/0001-season-linking-operators.md](/Users/slavakomarov/Misc%20Projects/nas-linker-public/docs/adr/0001-season-linking-operators.md)
- [docs/adr/0002-mode-scoped-progressive-disclosure.md](/Users/slavakomarov/Misc%20Projects/nas-linker-public/docs/adr/0002-mode-scoped-progressive-disclosure.md)
- [docs/season-linking-journey-map.md](/Users/slavakomarov/Misc%20Projects/nas-linker-public/docs/season-linking-journey-map.md)
- [docs/ui_task.yaml](/Users/slavakomarov/Misc%20Projects/nas-linker-public/docs/ui_task.yaml)

## Context
- The current season-linking screen is structurally correct but visually too tall for the most common task.
- The page is trying to show one primary linking action, one batch-review surface, and one support surface at the same visual weight.
- The screenshot shows that the result reads like a full operational console, not a compact task screen.
- The frequent case is still single-season linking.

## State model

| Surface | Owns state | Depends on | User value |
| --- | --- | --- | --- |
| Single-season link | source, title, year, season, reset, save | source selection, title, year, season | primary action |
| Batch review | scan rows, include toggles, season overrides, batch reset | source selection, scan results, shared title/year | review and multi-season execution |
| Saved | saved template values | none for availability | quick fill |
| Source picker | torrent-root browsing | none for availability | embedded helper |

## Decision
- Make the single-season link the dominant above-the-fold surface.
- Treat batch review as subordinate state, not a second full form.
- Keep `Saved` available, but visually lighter than the linking surfaces.
- Treat source discovery as an embedded helper inside the source dropdown, not a standalone browse surface.
- Preserve disclosure by mode, but also enforce a density budget so the page does not read as a full console when the user only wants one action.

## Decision drivers
- Reduce scan cost for the common path.
- Avoid forms-first drift.
- Keep shared context visible without giving every surface equal weight.
- Preserve the current state model and validation split.

## Alternatives considered

### 1. Keep the current full-height stacked page
- Pros:
  - no structural change
  - everything stays visible
- Cons:
  - too much vertical weight
  - support surfaces compete with the main action
  - the screen still feels like an operations dashboard

### 2. Split the page into separate routes
- Pros:
  - strongest separation
  - each route can stay compact
- Cons:
  - too much navigation
  - duplicates shared state
  - more friction than the problem justifies

### 3. Keep one page, but apply a density budget
- Pros:
  - preserves the current model
  - keeps the common context in one place
  - lowers perceived complexity without a route split
- Cons:
  - requires tighter hierarchy and more careful spacing

## Consequences
- The primary season form should fit comfortably above the fold on a standard mobile viewport.
- Batch review can still extend below the fold, but it must read as subordinate state.
- Support surfaces should not compete with the main linking action.
- The screen remains one page, but not one equally weighted stack.
- Secondary surfaces may need compact chrome or disclosure treatment later if they still dominate visually.

## Invariants
- No new domain entities.
- No change to the batch/single validation split from ADR 0001.
- No change to the mode-scoped disclosure rule from ADR 0002.
- No hidden authority in the support surfaces.

## Wireframes

### Current shape
```text
+--------------------------------------------------+
| Header                                           |
| Tabs                                             |
|--------------------------------------------------|
| Season form                                      |
|  - source                                        |
|  - title/year/season                             |
|  - link / save / reset                           |
|                                                  |
| Batch review card                                |
|  - scan / context / reset / run                  |
|  - table of rows                                 |
|                                                  |
| Saved                                            |
+--------------------------------------------------+
```

### Proposed compact shape
```text
+--------------------------------------------------+
| Header                                           |
| Tabs                                             |
|--------------------------------------------------|
| Shared context                                   |
|  - source                                        |
|  - title/year                                    |
|                                                  |
| Batch review (shown only when data exists)       |
|  - scan / context / reset / run                  |
|  - table of rows                                 |
|                                                  |
| Single-season fallback                           |
|  - season                                        |
|  - link / save / reset                           |
|                                                  |
| Saved (light)                                    |
+--------------------------------------------------+
```

## Validation plan
- Verify the primary season form remains the first complete task on a mobile-width viewport.
- Verify batch review does not look like a second equal-weight main form.
- Verify support surfaces remain available without dominating the page.
- Verify source discovery remains available inside the source dropdown without a separate browse card.
- Re-check after implementation with one screenshot on a narrow viewport and one on desktop.

## Open questions
- Whether `Saved` should remain as a full card or eventually become a lighter disclosure rail.
