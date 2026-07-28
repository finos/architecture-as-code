# ADR 0004: Defer Control and Decorator storage redesign

**Status**: Accepted. This is a decision to *not* decide yet — it needs no
code changes of its own.

## Context

`MongoControlStore` doesn't fit the header/version split cleanly: it's
double-nested (domain → control → configuration → version, one extra level
versus the other 7 types), using `arrayFilters` with `$[ctrl]`/`$[cfg]`
placeholders to reach two levels deep. ADR 0001 already excluded it,
flagging that it "needs bespoke design, not a straight copy of the other
7."

`DecoratorStore` isn't versioned at all — `updateDecorator` overwrites in
place, no `versions` map, no history — so it doesn't share the unbounded
per-document growth problem ([#2884](https://github.com/finos/architecture-as-code/issues/2884))
that motivates this whole redesign in the first place.

Both were already out of scope for ADR 0001. This ADR makes that exclusion
an explicit, deliberate sequencing decision rather than a silent gap.

## Decision

Defer designing a storage approach for Controls and Decorators. Implement
[ADR 0001](0001-versioned-artifact-storage.md),
[ADR 0002](0002-version-key-encoding.md), and
[ADR 0003](0003-shared-version-store-helper.md) first — the 7-type
versioned redesign, version-key encoding, and shared helper — and only
return to Controls/Decorators once that work has shipped.

Rationale:

- Controls' double-nesting is a genuinely different shape problem. Solving
  it in parallel with the 7-type redesign risks coupling two unrelated
  migrations together, growing the blast radius and review surface of the
  higher-priority, already-scoped work.
- Decorators have no urgency here — they don't have the growth problem this
  effort exists to solve.
- Real implementation experience from ADR 0001–0003 (in particular,
  whatever the shared helper in ADR 0003 turns out to look like once built)
  should inform Controls' bespoke design more usefully than speculating
  about it now, before any of the groundwork exists.

## Consequences

- `MongoControlStore` and `NitriteControlStore` are untouched by ADR
  0001–0003's implementation; `MongoControlStore` keeps using
  `MongoUpsertPush`/`MongoResourceSlice` directly (per ADR 0003).
- `DecoratorStore`/`MongoDecoratorStore`/`NitriteDecoratorStore` are
  untouched — still overwrite in place, no version history.
- A future ADR (0005 or later) will need to actually design Controls' and
  Decorators' storage when this work resumes. This ADR is a placeholder
  marking that intent, not a design — do not treat its existence as
  evidence a design decision has been made.
