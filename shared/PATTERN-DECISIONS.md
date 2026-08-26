# Pattern Decisions

This document explains how CALM patterns express decisions. It ties together rules
that are spread across several packages. Read it before you change how a pattern is
read, merged, or rendered.

It describes the behaviour the code has. Where two parts of the system disagree, this
document names the disagreement and gives the reason. It does not pick a winner unless
the code already has.

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
forbids it, so a pattern can still do it by mistake. When it happens, every operation
that resolves a block to what will actually exist reads it the same way: `oneOf` wins,
and the `anyOf` alternatives are dropped. Operations that only enumerate what a pattern
declares union both keywords instead, which is why `listDeclaredCandidates` exists
alongside `listSelectableCandidates`. See "A known disagreement" below for the one
operation that enumerates on the union and then resolves against it.

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
only runs `calm generate` sees no error. The decision is simply never offered. The
behaviour is deliberate, and it is easy to miss.

## `allOf` has three unreconciled readers

Three parts of the system read `allOf` for `nodes` and `relationships`, and they do not
agree. Nothing may assume consistent behaviour across them. Pattern authors are told not
to split a property's definition across branches - see `calm-ai/tools/pattern-creation.md`.

| Reader | Behaviour |
|---|---|
| `deepMergeSchemas` (`flatten-allof.ts`) | Shallow merge. A repeated property loses its `type`, so `instantiate` emits `{}` for it. |
| `getPatternArray` | Resolves one branch per property: the root schema, or else the first `allOf` branch that declares it. Reads `prefixItems` and `items` from that same branch. Later branches are ignored. Its private `resolveArrayContainer` carries the TEMPORARY marker, not `getPatternArray` itself. |
| `listDeclaredCandidates` / `listSelectableCandidates` | Ignore `allOf` entirely. This keeps the reported `path` correct for diagnostics. |

**Why this is not one answer.** `allOf` means intersection, not union, because `calm
validate` never flattens a pattern before checking it. A correct merge would combine
the branches the way a real JSON Schema validator combines them. No part of this
codebase does that. Each reader above makes its own narrow choice instead, scoped to
what its one caller needs.

Keep one implementation of each `list*` function, and keep it in `calm-models`. Do not
add a copy that follows `allOf` through `getPatternArray`: that combination reports a
`path` the document does not contain, which is wrong for a diagnostic. Reconciling the
three readers needs the real intersection merge described above, which is larger work
than any single caller justifies.

## Enforcement

These rules run only on `calm validate`. `calm generate` never runs them.

| Rule | Severity | Catches |
|---|---|---|
| `pattern-option-relationship-must-be-in-prefix-items` | error | A decision holder placed inside an `items` catalog. |
| `pattern-decision-must-reference-selectable-nodes` / `-relationships` | error | A choice bundle naming a candidate that is declared but not reachable. |
| `group-relationship-with-const-nodes-references-existing-nodes-in-pattern` | error | A choice bundle naming an id that does not exist at all. |
| `pattern-items-catalog-must-declare-one-choice-keyword` | warn | An `items` catalog block, or a `prefixItems[*]` slot, that declares both keywords. |

The last rule's eight `given` paths reach `properties.<nodes\|relationships>.items` and
`properties.<nodes\|relationships>.prefixItems[*]`, each also under `allOf[*]`. So the rule
does reach a decision holder, as one of the `relationships.prefixItems[*]` entries, but it
only checks the keywords that entry declares itself. It never descends into the holder's own
`relationship-type.options.prefixItems[*]`, so no rule catches a decision holder that declares
both keywords in its options block. This is the root cause of the disagreement below.

`pattern-nodes-must-be-referenced` does not help with decision-holder placement. Its
recursive query matches a holder regardless of which array it sits in, so it cannot
tell a legal holder from an illegal one.

## How decisions fold into the visualiser's boxes

The pattern visualiser (`calm-hub-ui`) draws each decision as a box. Each rule below
is deliberate behaviour.

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
drawn next to the containers, not around them. Issue #2933 covers nesting.

**A decision whose every candidate is pulled into one shared container loses its box
entirely, prompt included.** This is the one case where container precedence removes
the question from the diagram, not just its candidates. The alternative was an empty
box with nothing inside it. Issue #2933 covers nesting the box inside the container,
so that the question survives.

## A known disagreement: generation offers more than it resolves

Four operations read a decision holder's **question block** - the `oneOf`/`anyOf` array
under `relationship-type.options.prefixItems[i]`, whose elements are choice bundles. Inside
that block the keyword sets cardinality. It is not a candidate declaration site, so the
`nodes`/`relationships` rules above do not apply to it.

| Operation | Surface | Reads the question block as |
|---|---|---|
| `extractOptionsFromBlock` (`options.ts`) | generation, offering | union of both keywords |
| `flattenOneOfAndAnyOf` (`options.ts`) | generation, resolving | `oneOf` wins |
| `extractOptionsMetadata` (`patternTransformer.ts`) | visualisation | `oneOf` wins |
| `pattern-decision-must-reference-selectable-nodes` | validation | union, by JSONPath recursive descent |

**The disagreement is inside `options.ts`.** `extractOptionsFromBlock` builds the prompt from
both keywords. `flattenOneOfAndAnyOf` then applies the answer through
`resolveOperativeChoiceBlock`, which resolves `oneOf` only. So a choice from the `anyOf` half
is offered, accepted, and then discarded. `calm generate` reports success, and the holder is
dropped from the output.

`assertChoicesAreSelectable` does not catch this. It checks the answer's ids against
`listSelectableCandidates`, which reads the candidate declaration site, not the question
block. Ids declared normally there pass, so the guard stays silent.

Neither other surface is a party to this. `extractOptionsMetadata` already matches
generation's resolution step. The validation rule enumerates and never resolves, so union is
correct for it, and it reads the block through a JSONPath `given` rather than a reader
function.

**Which side changes.** Resolution cannot read the union. Within a question block `oneOf`
means pick exactly one and `anyOf` means pick any number, so a block declaring both would
have to be single-select and multi-select at once. Resolution must drop one keyword, and
`oneOf`-wins is already that rule everywhere else. Enumeration is the side that moves:
`extractOptionsFromBlock` should call `resolveOperativeChoiceBlock` too. A prompt that offers
what resolution discards is a defect, not a competing policy.

**What this blocks.** `options.ts` and `patternTransformer.ts` each re-implement finding a
decision holder and reading its question blocks. `isOptionsRelationship` is identical in both.
The helpers beside it are not, and they diverge three ways.

| Divergence | `options.ts` | `patternTransformer.ts` |
|---|---|---|
| A block declaring both keywords | union when offering, `oneOf` wins when resolving | `oneOf` wins |
| Question blocks read per holder | every entry in `options.prefixItems` | the first entry yielding a described choice, then returns |
| A malformed holder | unguarded property access, throws | optional chaining, renders nothing |

The second divergence also breaks generation on its own. Two question blocks under one holder
emit two options, and both take `optionId` from the holder's `unique-id`, so they collide.
`cli/src/command-helpers/generate-options.ts` resolves an answer with `find` and keys answers
by `optionId`, so only the first is addressable. Every pattern in this repository declares one
question block per holder, so this is unreachable today.

One shared reader would close all three. `calm-hub-ui` depends on `@finos/calm-models` and not
on `shared`, so it would live in `calm-models`, beside the readers above. It would have three
callers, and two of them already want the same thing, so the keyword policy above is what
stands in the way.
