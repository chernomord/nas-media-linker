# Season Linking Journey Map

Scope: current season-linking screen and its support surfaces.

## Frame
- The common header stays shared.
- The primary job is quick single-season linking.
- Batch review is secondary and appears only after scan data exists.
- `Browse NAS` is not a standalone journey; source discovery lives inside the source dropdown in the linking forms.
- `Saved` remains a support surface for quick fill.

## Journeys

| Journey | Trigger | Main state | Main actions | Notes |
| --- | --- | --- | --- | --- |
| Quick single-season link | User selects a season source and fills title/year/season | source, title, year, season, reset, save | link season, save, reset target | primary path |
| Multi-season batch review | User selects a season source and scan returns rows | scan rows, include toggles, season overrides, batch reset | rescan, clear review, link batch | subordinate to the primary path |
| Quick fill from saved | User opens Saved and picks an entry | saved template values | fill form, delete saved item | support path |
| Source discovery | User opens the source dropdown inside a form | available torrent sources | choose source | embedded helper, not a separate tab |

## User journey hierarchy

```text
Primary
  Quick single-season link

Secondary
  Multi-season batch review

Support
  Quick fill from saved
  Source discovery inside the source dropdown
```

## Why this shape
- The most common action stays first.
- Batch review only appears when it is actually needed.
- Support tools stay available without competing with the main task.
- The screen becomes a task surface, not a browsing console.

## What is no longer a separate surface
- `Browse NAS` as a full card/tab is removed from the journey model.
- Folder discovery still exists, but only as part of source selection in the main forms.

## Implications
- The main screen can get materially shorter.
- The sidebar should only carry `Saved` as a persistent support surface.
- Batch review can keep its own compact section below the main form.
- If a future inspection-only browse mode is needed, it should be introduced as a separate, explicit journey rather than revived as a permanent side card.
