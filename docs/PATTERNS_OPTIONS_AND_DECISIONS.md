# Patterns, Options and Decisions — how the mechanism works across the codebase

This is a developer/maintainer guide. It explains what CALM pattern **decisions**
(also called **options**) are, how a pattern expresses "choose zero or more from a
set of candidates", and — most importantly — how three completely separate parts of
the codebase each read that same mechanism for their own purposes. It is not part of
the published documentation site (it sits alongside `DEVELOPER_GUIDE.md`, outside the
Docusaurus `docs/docs/` content root), so it is free to talk about internal code.

If you are about to change how decisions are validated, generated, or drawn, read
this first. The single most common mistake is to fix one of the three consumers and
forget the other two, because nothing ties them together in the code — they only
share the *shape of the JSON they each independently read*.

Throughout, we use one running example: a pattern for an **online shop**. Every shop
must have a **web application** and a **database**. On top of that, a shop *may*
optionally include a **cache** and/or a **message queue**, in any combination —
neither, one, the other, or both.

---

## 1. What a pattern actually is

A CALM **pattern** is not a diagram and not an architecture. It is a **JSON Schema**:
a set of rules describing what a valid architecture is allowed to look like. An
**architecture** is a concrete JSON document describing one specific system.

The relationship between the two is the relationship between a blank form template
and a filled-in copy of that form. The pattern is the template with its rules ("this
field must be a number; you must pick one of these three options"), and an
architecture is one completed copy. Validating an architecture against a pattern is
therefore ordinary JSON Schema validation.

Inside a pattern, the two things we care about are **nodes** (the boxes — services,
databases, actors) and **relationships** (the arrows — "connects to", "deployed in").
Both live in JSON arrays. So when a pattern describes its nodes, it is really
describing *the rules for a JSON array of nodes*: how many entries it may have, and
what each entry is allowed to be.

---

## 2. The two ways a pattern can describe a list — the crux of everything

JSON Schema gives you two different ways to describe what is allowed inside an array.
The entire options feature, and every subtle behaviour in it, comes from the
difference between these two. Spend time here.

### `prefixItems` — a positional checklist

`prefixItems` describes an array **position by position**, like a numbered checklist.
It says "the first entry must match *this* rule, the second entry must match *that*
rule," and so on. It is fundamentally about fixed positions.

If you want a position to be a *choice*, you put a `oneOf` (meaning "exactly one of
the following") inside that slot, listing the alternatives:

```jsonc
"nodes": {
  "prefixItems": [
    { "oneOf": [ /* web app in Node */, /* web app in Python */ ] }  // slot 0: pick one
  ]
}
```

Notice what this construct actually means: there is *definitely* a node in slot 0, and
you must choose which kind it is. It is a **mandatory slot with a choice inside it**.
It cannot naturally say "maybe there is a node here, maybe there isn't", because
position-based lists are rigid — position three is always position three.

### `items` — an open catalog

`items` (the catalog sense) works completely differently. Instead of describing
positions, it describes **one single rule that every entry in the array must obey, no
matter how many entries there are**. So you can say "every element must be one of the
following approved things" and separately constrain the count with `minItems` /
`maxItems`:

```jsonc
"nodes": {
  "prefixItems": [ /* web app */, /* database */ ],   // always present
  "items": { "oneOf": [ /* cache */, /* queue */ ] }, // an approved-but-optional menu
  "minItems": 2                                        // at least the two mandatory nodes
}
```

Because `items` does not pin anything to a position, you are free to include none of
its candidates, some of them, or all of them. This is the natural way to express our
online shop: the web app and database are mandatory (`prefixItems`), and the cache and
queue form an optional catalog (`items`). Before this feature, the tooling understood
only the `prefixItems` half of that sentence and was blind to the `items` half.

---

## 3. What a "decision" actually is

A pattern that merely *allows* optional things does not help a human choose. That is
what the **decision** mechanism (a.k.a. **options**) is for.

A decision is written as a special entry in the **relationships** array. This is the
part that trips people up, so be precise: **this "relationship" is not a real
connection between two nodes.** It does not mean "A talks to B". It is a piece of
*metadata* riding along in the relationships array because that is a convenient place
to keep it. What it contains is a human-facing prompt and a list of possible answers:

```jsonc
{
  "properties": {
    "unique-id": { "const": "optional-add-ons" },
    "description": { "const": "Which optional add-ons do you want?" },
    "relationship-type": { "properties": { "options": { "prefixItems": [ { "anyOf": [
      { "properties": { "description": { "const": "Add a cache" }, "nodes": { "const": ["cache"] } } },
      { "properties": { "description": { "const": "Add a queue" }, "nodes": { "const": ["queue"] } } }
    ] } ] } } }
  }
}
```

The critical mechanical detail: a **choice does not contain the node**, it contains
the **id** of a node defined elsewhere. The choice "Add a cache" simply says
`nodes: ["cache"]`, and the actual `cache` node lives over in the nodes array. The
decision and the candidate are linked purely by that shared id string.

This indirection — decisions point at candidates by id rather than containing them —
is the most important thing to understand, because every one of the three processes
below has to *resolve* that id back to the real node, and each does it differently.

---

## 4. The three processes, and how each reads the very same decision

Here is the mental model to walk away with. You have **one** decision written **once**
in the pattern. Three entirely separate pieces of code, living in different packages
and run at different times, each pick that pattern up and read that decision for their
own purposes. **They do not share code.** They each independently walk the JSON. That
is why a single conceptual feature — "understand `items`" — had to be implemented
three separate times, and why bugs cluster at the seams.

### 4a. Validation — a static check of the pattern itself

**Where:** `shared/src/spectral/` (rules in `rules-pattern.ts`, helper functions in
`functions/pattern/`).

Validation checks the pattern *before* anyone builds anything from it, the way a
spell-checker catches typos: are all node ids unique, does every id a decision points
to actually exist, is every decision-referenced node wrapped in a choice block, and so
on. It is built on **Spectral**, a tool for writing rules that walk a JSON document.

Those rules navigate the pattern using little address strings (think file paths into
the JSON) such as `$.properties.nodes.prefixItems[*].properties.unique-id.const`. The
historical blindness lived exactly here: every address string was written to walk down
through `prefixItems`, and none knew to also walk through `items`. So catalog
candidates were not *rejected* — they were genuinely *invisible*. If you gave the cache
and the queue the same id, the "ids must be unique" rule sailed past it, because the
rule only looked in the `prefixItems` neighbourhood and the duplicate was in the
`items` neighbourhood. The fix was mechanical: add parallel address strings that also
walk `items.oneOf`/`items.anyOf`, so the existing rules now visit both neighbourhoods.

That mechanical fix had to be applied to *every* validation helper that resolves an id
against the node/relationship arrays, not just one — this is exactly the "fix one
consumer, forget the rest" trap this document warns about, and it is easy to miss a
call site. The helpers updated are: `ids-are-unique.ts` (duplicate detection), the
`pattern-nodes-must-be-referenced` rule's `given` (unused-node warning),
`node-id-exists.ts` (does a referenced node exist — used by the `connects`,
`deployed-in`/`composed-of`, and actor/container rules, and by decision `nodes.const`
references), and `interface-id-exists-on-node.ts` (does a referenced interface exist on
the node). `is-defined-in-oneof-or-anyof.ts` was deliberately left unchanged: its check
only fires when an id is *also* present as a plain `prefixItems` name, which a
catalog-only id never is, so it correctly no-ops for catalog candidates rather than
false-positiving.

### 4b. Generation — pattern + human choices → concrete architecture

**Where:** `shared/src/commands/generate/` (`generate.ts` orchestrates;
`components/options.ts` reads and narrows decisions; `components/instantiate.ts`
materializes; `components/flatten-allof.ts` pre-flattens `allOf`).

Generation takes a pattern plus a human's answers and produces a concrete
architecture. It runs as a small pipeline:

1. **Read the decisions** out of the pattern (`extractOptions`) so it knows what to
   ask ("cache? queue?").
2. **Narrow** the pattern to the answers (`selectChoices` → `flattenCalmItems`): for
   every choice the human *did* pick, keep the corresponding candidate; for every
   alternative they did *not* pick, throw it away. After narrowing there are no open
   choices left — the pattern is collapsed to exactly what was selected.
3. **Materialize** (`instantiate`): turn the narrowed schema's `const` values into
   concrete instance data — the actual architecture document.

The narrowing step used to reach specifically for `prefixItems`. The chosen approach
for `items` is deliberately economical: during narrowing, the selected catalog
candidates are **moved into `prefixItems`** and the now-empty `items` is deleted. In
other words, once the human has decided exactly which extras they want, those extras
really *are* just a fixed list, so converting the open-catalog form into the positional
form is legitimate — and it means the materialization step did not have to change at
all, because by the time it runs everything is `prefixItems` again.

There is one seam worth remembering (see Limitation 1 below): narrowing only runs when
choices are actually supplied. Generating with no choices at all skips it, so an
array described *only* by `items` never gets converted, and `instantiate` must be able
to cope with an array that has no `prefixItems`.

### 4c. Visualisation — draw the pattern as boxes and arrows

**Where:** `calm-hub-ui/src/visualizer/components/reactflow/utils/patternTransformer.ts`.

Visualisation draws the pattern on screen in CALM Hub so a human can see its shape,
including where the choices are. The concept that matters is the **decision group**:
the visual box drawn around a set of alternatives to say "these are the options for one
choice."

When the visualiser reads the pattern and sees a `oneOf`/`anyOf` block, it gathers
those alternatives, stamps each with a shared "you belong to decision group N" label,
and later draws a box around everyone carrying that label. Separately it reads the
decision's prompt and choice descriptions and attaches them to the group so the box can
show the question. The same blindness applied: the grouping code only looked inside
`prefixItems` slots, so an `items` catalog produced no group, no box, and — because the
prompt is attached to a group that was never created — the decision silently failed to
render. The fix teaches extraction to build a group from the `items` catalog too
(`getItems`, `extractNodeDecisionGroup`), and reworks how a decision's referenced ids
are resolved onto a group (`foldOptionsMetadataIntoDecisionGroups`). This was the
largest and most delicate of the three changes, because grouping is genuinely stateful
— nodes move between groups, groups are created, empty groups are cleaned up.

---

## 5. Current limitations and sharp edges

None of these affect any pattern that exists in the repository today; they are corners
you can reach only by writing unusual patterns. They are recorded here so the next
person is not surprised.

1. **(Fixed) An all-optional array generated with no selections.** A nodes array
   declared *entirely* through an `items` catalog (no mandatory `prefixItems` nodes),
   generated without choosing anything, used to emit `nodes: {}` (an object) instead of
   `nodes: []` (an array), because narrowing never ran and `instantiate` fell back to
   object-instantiation. `instantiate.ts` now returns `[]` for any array with no
   `prefixItems`. Covered by a regression test in `instantiate.spec.ts`.

2. **One decision spanning two `prefixItems` slots now renders as a single box.** The
   visualiser folds *all* of a decision's referenced nodes into one group. Every real
   pattern maps each decision to one slot, so nothing changes today; but if a single
   decision's choices reach across two separate `oneOf` slots, the old code drew two
   boxes (labelling only one) and the new code draws one unified box. This is arguably
   more correct — a single decision should be a single box — but it is a visible
   change, so mention it in review when it first occurs.

2b. **Two decisions drawing from one shared `items` catalog merge into a single box.**
   `extractNodesFromPattern` assigns every candidate in a nodes `items` catalog to a
   single decision group (`node-decision-items`) at extraction time. If two *separate*
   options relationships reference disjoint subsets of that one catalog (e.g. a "pick a
   cache" decision and a "pick a queue" decision both drawn from one catalog), both fold
   into that single group, so the visualiser draws one merged box and only the
   last-processed decision's prompt/choices survive. The nodes are still all drawn; only
   the grouping/labelling is wrong. Rendering a single catalog as multiple independent
   decisions needs per-decision group keying and is tracked with the decision-group
   rework in the visual-nesting follow-up. The one-catalog-one-decision case (the common
   shape) is unaffected.

3. **(Fixed) A catalog node that is also a container child draws inside the container.**
   If a node is both an optional pick *and* declared to live inside a container (via
   `deployed-in`/`composed-of`), the container now takes precedence, so the node renders
   nested inside its container rather than in the choice box. Earlier the decision group
   won; `createReactFlowNodes` now computes `parentMap.get(...) || node.decisionGroupId`
   and additionally suppresses any decision box left empty because all its members were
   pulled into containers, so no empty box is drawn. Covered by two tests in
   `patternTransformer.test.ts`. (This precedence only exists for *pattern*
   visualisation; architectures are drawn by the separate `calmTransformer.ts`, which
   has no decision-group concept because all choices are already resolved.)

4. **`minItems`/`maxItems` are not rewritten during narrowing.** If a pattern author
   sets, say, `maxItems: 2` thinking only of the mandatory nodes, and a user then picks
   optional add-ons, the array grows past that limit *while being assembled*. The final
   architecture is still correct, because it is validated against the *original*
   pattern (whose `items` + `minItems` accept the extras) — but authors should size any
   `maxItems` to account for optional picks, or omit it.

5. **`items` is not merged across `allOf` branches.** `flatten-allof.ts` deep-merges
   `prefixItems` by position but merges `properties` shallowly, so if the definition of
   a single node array is split across two `allOf` branches, the later branch's array
   definition replaces the earlier one wholesale (not just its `items`) — the earlier
   branch's candidates are silently lost. Realistic patterns declare a node array once
   in one place, so this does not arise; it is flagged in a code comment in
   `flatten-allof.ts`.

---

## 6. If you change this mechanism — a checklist

Because the three consumers do not share code, a change to decision handling is not
complete until you have considered all three:

- **Validation** (`shared/src/spectral/`): will the new shape be seen by the JSONPath
  address strings in `rules-pattern.ts` and the `functions/pattern/*` helpers? A new
  place to declare candidates usually needs new `given`/JSONPath entries.
- **Generation** (`shared/src/commands/generate/`): can `extractOptions` read the
  decision, can `selectChoices`/`flattenCalmItems` narrow it, and does `instantiate`
  materialize the result into valid instance JSON (an array, not an object)?
- **Visualisation** (`calm-hub-ui/.../patternTransformer.ts`): does extraction build a
  decision group for the new shape, and does the fold step attach the prompt to it
  without stranding metadata or drawing empty boxes?
- **Tests**: `shared` is consumed by the CLI and the VSCode extension, so run the full
  `npm test` from the repo root after touching `shared`, not just the shared workspace.
