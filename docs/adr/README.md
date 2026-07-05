# ADR Index

Architecture Decision Records in this repository capture stable product and UX decisions after a concrete choice has been made.

## Rules
- Use one ADR per decision.
- Keep each ADR short and local to one decision.
- Prefer concrete consequences over abstract principles.
- Write the decision as it stands now, not as a brainstorming log.
- If a decision changes later, add a new ADR that references the prior one.

## Naming
- Use `NNNN-short-slug.md`.
- Keep `NNNN` zero-padded and monotonic.
- Keep the slug short and descriptive.

## Required sections
- `Status`
- `Date`
- `Context`
- `Decision`
- `Decision drivers`
- `Alternatives considered`
- `Consequences`
- `Invariants`
- `Validation plan`
- `Open questions`

## Optional sections
- `Related`
- `References`
- `Sketch`
- `Implementation notes`

## Current ADRs
- [0001-season-linking-operators.md](./0001-season-linking-operators.md)

## Template
- [template.md](./template.md)
