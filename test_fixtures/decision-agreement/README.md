# Decision agreement fixtures

`calm generate` and the pattern visualiser read a pattern's decisions independently.
Nothing made them answer the same way, which is how the defects in PR #2932 arose.

Each case here is one pattern plus the decisions and results both surfaces must produce.
`calm-hub-ui` does not depend on `shared`, so no test can import both sides. The fixture
is the contract instead.

| Side | Reads | Asserts |
|---|---|---|
| `shared` | `extractOptions`, `selectChoices` + `instantiate` | `decisions`, then `answered[].nodes` |
| `calm-hub-ui` | `parsePatternData` + `extractDecisionPoints`, `getVisibleNodeIds` | the same two |

`answered` cases name a choice for **every** decision. An unanswered decision is left out
on purpose: the visualiser shows all its candidates ("what is still possible") and
generation contributes none ("what you asked for"). Which one is correct is an open
product question, so no test pins it.
