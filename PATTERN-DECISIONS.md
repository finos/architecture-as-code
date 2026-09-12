# Pattern decisions

A CALM pattern can offer a choice. This document records what each tool guarantees about
that choice. It describes behaviour only. It does not describe how a tool is built.

Each section names the tests that hold its guarantees. A guarantee below with no test is a
gap.

## Terms

| Term | Meaning |
|---|---|
| alternative | One entry in a `oneOf` or an `anyOf` array. |
| decision | A relationship that carries `relationship-type.properties.options`. A decision asks which alternatives to include. |

A pattern declares a node at five kinds of site:

| Site | Meaning |
|---|---|
| a `prefixItems` entry | one node, at that position |
| `prefixItems[i].oneOf` | alternatives for that position |
| `prefixItems[i].anyOf` | alternatives for that position |
| `items.oneOf` | nodes an architecture may add, none of them required |
| `items.anyOf` | nodes an architecture may add, none of them required |

`maxItems` counts the whole array and the `prefixItems` entries fill it from the front, so
a pattern that wants `items` must leave room for them.

A node declared under `items` must sit inside `oneOf` or `anyOf`. `items` applies one
schema to every position after the entries, so a node declared directly would force every
added node to be that same node. An `items` schema that declares a node directly is not
read.

A pattern declares a relationship at the same five sites.

`prefixItems` and `items` differ in how many of their declarations reach one architecture.
A `prefixItems` entry is one position, so exactly one of its alternatives is built. `items`
describes every position after the last entry, so an architecture may build any number of
its members, or none.

## Rules that hold across all tools

An id names one kind of thing. A name used for a node is never also used for a relationship
or an interface, anywhere in the pattern.

A decision names a node or a relationship by its `unique-id`. Two alternatives of one entry
must therefore have different node ids and different relationship ids. If they did not, no
answer could select one and not the other.

A decision never names an interface on its own, because a relationship names an interface
beside its node. Two alternatives may expose the same interface id, because only one of
them is ever built.

Declare one keyword, not both. An element must satisfy every keyword declared beside it, so
declaring both `oneOf` and `anyOf` makes some alternatives impossible to select.

Neither keyword controls how many alternatives an architecture includes. A `prefixItems`
entry is one position, so it takes one alternative. `minItems` and `maxItems` on the array
set the bounds.

`prefixItems` is positional. An architecture lists the elements a pattern declares there
first, and in the order the pattern declares them. Members built from `items` follow. An
architecture that reorders the positional elements does not match the pattern.

`oneOf` and `anyOf` do not differ for CALM alternatives. Each alternative pins a distinct
`unique-id`, so an element matches at most one of them, and "exactly one" and "at least one"
become the same test. The visualiser prints the keyword as the label on the decision box, so
the choice is visible to a reader. It changes no validation.

## What validation guarantees

`calm validate` reads every node and every relationship a pattern declares. It reads all
five declaration sites listed above.

`calm validate` reports these faults:

| Fault | Severity |
|---|---|
| Two declarations that can appear together share a `unique-id` | error |
| Two alternatives of one entry share a node or relationship `unique-id` | error |
| One name is used for more than one kind of thing | error |
| The source of a connects relationship refers to a node that the pattern does not declare | error |
| A connects relationship refers to an interface that the named node does not declare | error |
| A `prefixItems` entry or an `items` block declares both `oneOf` and `anyOf` | error |
| A decision is declared in `items` rather than in `prefixItems` | error |
| `maxItems` leaves no room for an `items` member | error |
| No relationship and no decision refers to a declared node | warning |

`calm validate` does not read the destination of a connects relationship. A typo there is
not reported.

Declare a decision as a plain entry in `relationships.prefixItems`. An architecture
contains every relationship declared at a fixed position there, so the decision is always
asked. A decision declared in `items`, or as one alternative of an entry, can be left out,
and an answer never gets to decline it. `calm validate` reports the `items` case only.

Two `items` members may both be built, so they must not share a `unique-id`, and two nodes
declared there must not share an interface id. Two alternatives of one `prefixItems` entry
may, because only one of them is built.

An `items` block cannot limit how many times one member is used. `items` constrains every
position after the entries, so two positions may both match the same member, and the
architecture then holds one `unique-id` twice. `calm validate` cannot report that from the
pattern, because the pattern is correct. The architecture check
`unique-ids-must-be-unique-in-architecture` reports it against the architecture.

Leave `minItems` out rather than writing `minItems: 0`. Zero is the default, and
`pattern-has-no-empty-properties` reads a zero as a placeholder and reports an error.

`calm validate` reads one level of alternatives. It does not read alternatives declared
inside another alternative. The keyword check reads node and relationship sites, not
interface entries.

Do not give a `prefixItems` entry its own `properties` as well as alternatives. Both halves
apply to the same element. If each half pins a `unique-id`, no element can satisfy both, so
nothing can ever fill that position. If they do not conflict, `calm generate` keeps the
selected alternative and discards the entry's own `properties`, so whatever the entry
declares is lost. `calm validate` reports this only when the two halves share a `unique-id`,
and then it reports a duplicate rather than naming the fault.

A pattern that declares alternatives inside an `allOf` branch is not supported. Two `allOf`
branches that declare the same property discard one of the two declarations.

## What generation guarantees

`calm generate` does not read `items`. It builds one node per `prefixItems` entry and
nothing else, so a node declared in `items` never reaches the architecture. `calm validate`
accepts the pattern, and the missing node is silent.
