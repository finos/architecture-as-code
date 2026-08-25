# Pattern Decisions

This document explains how CALM patterns express decisions today. It ties together
rules that are spread across several packages. Read it before you change how a pattern
is read, merged, or rendered.

This is a recap of current, intended behaviour. It is not a proposal for new
behaviour. Where two parts of the system disagree, this document says so and gives
the reason. It does not pick a winner unless the code already has.

For what a **decision holder** and a **candidate** are, see
`calm-ai/tools/pattern-creation.md`. That guide is for pattern authors. This
document is for people who change the code that reads a pattern.

## Where a candidate can be declared

A pattern can declare a candidate in four places:

- a plain `prefixItems` entry
- a `prefixItems[i].oneOf` alternative
- a `prefixItems[i].anyOf` alternative
- an `items.oneOf`/`items.anyOf` catalog member

One function, `getPatternArray` (`@finos/calm-models/pattern`), finds the `prefixItems`
array and the `items` catalog for `nodes` or `relationships`. Other functions build on
top of it.

## `oneOf` and `anyOf` mean different things by location

The same two keywords carry different meaning depending on where they sit. Get this
wrong and the pattern still validates, but generation or the visualiser reads it
incorrectly.

**Inside a decision holder's `options`.** This sets the cardinality. `oneOf` means the
user must pick exactly one choice. `anyOf` means the user may pick any number of
choices, including none.

**Inside a `prefixItems[i]` slot.** This picks which single candidate fills that fixed
array position. `oneOf` and `anyOf` behave the same way here: only one alternative can
occupy the slot.

**Inside an `items` catalog.** This constrains the shape of one array entry, not how
many entries exist. Each candidate pins its own `unique-id` with `const`, so an entry
can match at most one candidate schema either way. Use `oneOf` here. It is the accurate
keyword, and it is the one the readers below resolve to when both are present.

**Never declare both `oneOf` and `anyOf` on one block.** Nothing in JSON Schema
forbids it, so a pattern can still do it by mistake. When it happens, every reader in
this codebase resolves it the same way: `oneOf` wins, and the `anyOf` alternatives are
dropped. See "A known disagreement" below for the one place that does not follow this
rule yet.

## Three functions answer three different questions

Each function lives in `@finos/calm-models/pattern`. Use the wrong one and the failure
is silent, not an error.

| Question | Function |
|---|---|
| What does this one block resolve to? (`oneOf` wins) | `resolveOperativeChoiceBlock` |
| What does the pattern declare, in total? (both keywords) | `listDeclaredCandidates` |
| What can a selection actually reach? (one keyword) | `listSelectableCandidates` |

Use `listDeclaredCandidates` for questions about the document itself: is an id unique,
does a reference dangle. Use `listSelectableCandidates` for questions about an answer:
can this choice be honoured. The two functions differ only where a block declares both
keywords — which a well-formed pattern never does.

`getPatternArray` is a fourth relevant function. It resolves the array a decision
lives in before either of the two `list*` functions walks it.

## `calm generate` never validates

`calm generate` does not run `calm validate`. It has its own guard instead.
`assertChoicesAreSelectable` throws from `runGenerate` when a chosen answer names a
candidate that selection cannot reach. It is not called from `selectChoices`, because
`calm validate` calls `selectChoices` too, and a malformed pattern must show its own
schema error there instead.

This means a decision holder placed somewhere illegal, such as inside an `items`
catalog, produces a `calm validate` error but not a `calm generate` error. A user who
only runs `calm generate` sees no error. The decision is simply never offered. This is
documented behaviour, not an oversight, but it is easy to miss.

## `allOf` has three unreconciled readers

Treat `allOf` for `nodes` and `relationships` as unsupported. Three parts of the
system read it, and they do not agree.

| Reader | Behaviour |
|---|---|
| `deepMergeSchemas` (`flatten-allof.ts`) | Shallow merge. A repeated property loses its `type`, so `instantiate` emits `{}` for it. |
| `getPatternArray` | Resolves one branch per property: the root schema, or else the first `allOf` branch that declares it. Reads `prefixItems` and `items` from that same branch. Later branches are ignored. Marked TEMPORARY in the code. |
| `listDeclaredCandidates` / `listSelectableCandidates` | Ignore `allOf` entirely. This keeps the reported `path` correct for diagnostics. |

**Why this is not one answer.** `allOf` means intersection, not union, because `calm
validate` never flattens a pattern before checking it. A correct merge would need to
combine the branches the way a real JSON Schema validator combines them. No part of
this codebase does that yet. Each reader above made its own narrow, expedient choice
instead, scoped to what its one caller needed.

`shared` used to keep a second copy of `listDeclaredCandidates` that followed `allOf`
through `getPatternArray`. It disagreed with the `calm-models` copy and reported a
`path` the document did not contain. Nothing tested or relied on that behaviour, so
the copy was deleted rather than fixed. A full `allOf`-intersection rework is
separate, larger work, not started.

## Enforcement

These rules run only on `calm validate`. `calm generate` never runs them.

| Rule | Severity | Catches |
|---|---|---|
| `pattern-option-relationship-must-be-in-prefix-items` | error | A decision holder placed inside an `items` catalog. |
| `pattern-decision-must-reference-selectable-nodes` / `-relationships` | error | A choice bundle naming a candidate that is declared but not reachable. |
| `group-relationship-with-const-nodes-references-existing-nodes-in-pattern` | error | A choice bundle naming an id that does not exist at all. |
| `pattern-items-catalog-must-declare-one-choice-keyword` | warn | An `items` catalog block, or a `prefixItems[*]` slot, that declares both keywords. |

The last rule's `given` paths reach `properties.<nodes\|relationships>.items` and
`properties.<nodes\|relationships>.prefixItems[*]`. They do not reach inside a
decision holder's own `relationship-type.options.prefixItems[*]`. So a decision holder
that declares both keywords in its own options block is not caught by this rule, or
by any other rule today. This is the root cause of the disagreement below.

`pattern-nodes-must-be-referenced` does not help with decision-holder placement. Its
recursive query matches a holder regardless of which array it sits in, so it cannot
tell a legal holder from an illegal one.

## How decisions fold into the visualiser's boxes

The pattern visualiser (`calm-hub-ui`) draws each decision as a box. The rules below
are current, deliberate behaviour, not bugs, unless stated otherwise.

**Every decision gets its own box.** Two decisions drawing from the same catalog
produce two boxes, each with its own prompt.

**A candidate can be drawn in one box only.** If two decisions name the same
candidate, the first decision (in document order) keeps it. The second decision's box
still offers that candidate as a choice, but does not draw it. If every one of a
decision's candidates is claimed by an earlier decision, that decision renders no box
at all.

**A container beats a decision box.** If a candidate is both a decision candidate and
a child of a container (`deployed-in` or `composed-of`), it is drawn inside the
container, not inside the choice box.

**A decision whose candidates are themselves containers keeps its box.** The box is
drawn next to the containers, not around them. Nesting a box around its containers is
future work, not current behaviour.

**A decision whose every candidate is pulled into one shared container loses its box
entirely, prompt included.** This is the one case where container precedence removes
the question from the diagram, not just its candidates. It is deliberate and tested,
not an oversight — the alternative, an empty box with nothing inside it, was judged
worse. Nesting the box inside the container, so the question survives, is tracked as
future work in issue #2933.

## A known disagreement: a decision holder that declares both keywords

`options.ts` (used by `calm generate`) and `patternTransformer.ts` (used by the
visualiser) both read a decision holder's choice bundles. They disagree when one
block declares both `oneOf` and `anyOf`.

- `options.ts`'s `extractOptions` reads the block once as `oneOf` and once as `anyOf`,
  and offers the union of both as available choices.
- `patternTransformer.ts`'s `extractOptionsMetadata` calls
  `resolveOperativeChoiceBlock`, which picks `oneOf` only, matching the rule stated
  above for every other reader in this codebase.

So a choice from the `anyOf` half is offered by `calm generate` but never drawn by the
visualiser. If a user answers with that choice, `calm generate` accepts it as valid
when it builds the prompt, but nothing downstream treats it as reachable the way the
rest of the system does.

**Why this exists.** This predates the items-catalog feature entirely. It was checked
directly against `main`: `options.ts`'s union-both behaviour is unchanged, and the
visualiser's `oneOf`-wins behaviour was already there, hand-written, before it was
swapped to call the shared `resolveOperativeChoiceBlock`. Neither side was built
against the other. Nobody has reconciled them.

**Which side is likely wrong.** `oneOf`-wins is the rule every other reader in this
codebase already follows — `resolveOperativeChoiceBlock`, `listSelectableCandidates`,
and the reasoning behind `pattern-decision-must-reference-selectable-nodes`. That
makes `options.ts`'s union-both behaviour the outlier, not the visualiser's. This is
not fixed here. It is tracked as a follow-up issue.

## Still duplicated

**Decision-holder reading.** `options.ts` (`isOptionsRelationship`,
`getItemsInOptionsRelationship`) and `patternTransformer.ts` (`isOptionsRelationship`,
its own `options.prefixItems` read) each re-implement finding a decision holder and
reading its choice bundles. Nothing keeps this pair in step, which is why they
disagree as described above. `calm-hub-ui` depends on `@finos/calm-models` and not on
`shared`, so a shared reader for this would have to live in `calm-models`, the same
place the readers above already live.

**A small id-reading helper.** `shared/src/spectral/functions/pattern/candidate-helpers.ts`
re-implements `isObject` and `readUniqueId`, which already exist, privately, in
`calm-models/src/pattern/pattern-reader.ts`. Exporting them would close this one.
