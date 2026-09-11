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

A pattern declares a node at three kinds of site:

| Site | Meaning |
|---|---|
| a `prefixItems` entry | one node, at that position |
| `prefixItems[i].oneOf` | alternatives for that position |
| `prefixItems[i].anyOf` | alternatives for that position |

A pattern declares a relationship at the same three sites.

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

`oneOf` and `anyOf` do not differ for CALM alternatives. Each alternative pins a distinct
`unique-id`, so an element matches at most one of them, and "exactly one" and "at least one"
become the same test. The visualiser prints the keyword as the label on the decision box, so
the choice is visible to a reader. It changes no validation.

## What validation guarantees

Tests: [`shared/src/spectral/rules-pattern.spec.ts`](shared/src/spectral/rules-pattern.spec.ts)
and the rule tests beside it in `shared/src/spectral/functions/pattern/`.

`calm validate` reads every node and every relationship a pattern declares. It reads all
three declaration sites listed above.

`calm validate` reports these faults:

| Fault | Severity |
|---|---|
| Two declarations that can appear together share a `unique-id` | error |
| Two alternatives of one entry share a node or relationship `unique-id` | error |
| One name is used for more than one kind of thing | error |
| The source of a connects relationship refers to a node that the pattern does not declare | error |
| A connects relationship refers to an interface that the named node does not declare | error |
| A `prefixItems` entry declares both `oneOf` and `anyOf` | error |
| No relationship and no decision refers to a declared node | warning |

`calm validate` does not read the destination of a connects relationship. A typo there is
not reported.

`calm validate` reads one level of alternatives. It does not read alternatives declared
inside another alternative. The keyword check reads node and relationship entries, not
interface entries.

Do not give a `prefixItems` entry its own `properties` as well as alternatives. `calm
generate` keeps the selected alternative and discards the entry's own `properties`, so
whatever the entry declares is lost. `calm validate` reports a duplicate `unique-id` when
the two halves share one. That catches the common case. It does not name the fault.

A pattern that declares alternatives inside an `allOf` branch is not supported. Two `allOf`
branches that declare the same property discard one of the two declarations.
