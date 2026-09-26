# CALM Learning Lab

An in-browser learning lab for CALM: a terminal, an editor and a live diagram, with `calm validate`
and `calm diff` running the real CALM engine (`@finos/calm-shared/browser`) — the same validation
the CLI performs, with nothing to install and nothing sent to a server. The terminal accepts the
CLI's own syntax (`calm validate -a <file>`, `calm diff -a <file> -b <file>`), so every command
works unchanged after installing the CLI.

Hosted at **<https://lab.calm.finos.org>**. It has its own origin because many CALM users work
behind proxies that block sites accepting free-text input; the documentation at
<https://calm.finos.org> stays reachable, and the lab can be allow-listed on its own.

Learners work through guided lessons in an IDE-style workspace: a lesson rail with steps and
hints, an editor, a terminal, a Problems tab and a live diagram. Every step is checked against
real state — the saved workspace and the engine's validation result — so any valid solution passes.

## Lessons

A lesson is a folder under `src/lessons/`. Open one with `?lesson=<id>`
(e.g. `https://lab.calm.finos.org/?lesson=quick-start`) or pick it in the lab.

| Lesson | Tutorial | Status |
|---|---|---|
| `quick-start` | — | Released |

### Write a lesson

1. Create `src/lessons/<id>/lesson.ts` that exports a `Lesson` (see `src/lessons/types.ts`):

   | Field | What it is |
   |---|---|
   | `id` | Lowercase, hyphenated. It is the `?lesson=` value and the storage key. Do not change it after release. |
   | `title` | The lesson's name in the picker. |
   | `summary` | One short sentence. It is the picker option's tooltip and the line under the picker. |
   | `tutorial` | The docs page this lesson adapts, if any. It shows as a "Tutorial ↗" link after the summary. |
   | `editorFile` | The file the editor opens, the diagram shows and the checks read. |
   | `seedFiles` | The workspace at the start: absolute path under `/workspace` → contents. |
   | `chainsFrom` | The lesson whose end state this one starts from. Build the seed with `endFiles(previous)`. |
   | `steps` | Ordered steps, below. |
   | `completion` | Heading, message and links shown when every step is done. |

2. Write each step: `id`, `title`, `body` (inline code in backticks) and a `hint`:
   - `{ kind: 'file', content }` — the **complete** editor file after the step, so paste-and-save
     always works;
   - `{ kind: 'commands', commands }` — the commands to run, from `/workspace`.

3. Write each `check(state)` with the helpers in `src/lessons/checks.ts`. A check reads state, not
   history: `state.doc` (the saved editor file), `state.validation.ok`, and `state.commands` (the
   commands whose files have not changed since they ran). Check what the step asked for, not the
   names in the hint, so any valid answer passes. File paths given to `ranOk` and `ranFailed` are
   absolute: use `state.editorFile` or a `/workspace/...` path.

4. Register the lesson in `src/lessons/index.ts`, add it to the table above, and add
   `src/lessons/<id>/lesson.spec.ts`. For each step, it must have:
   - a passing answer that uses different names from the hint, which the check accepts;
   - at least one wrong answer, which the check rejects.

`src/lessons/invariants.spec.ts` runs every registered lesson through the real shell and engine:
files live under `/workspace`, no step is complete before its hint, each hint completes its step
and prints no error, the end state validates, every `calm` command in the copy runs in the lab's
shell, lesson links name registered lessons, and a chained lesson starts from its predecessor's end
state.

## Development

Run everything from the repository root.

```bash
npm run calm-lab:run                  # Dev server
npm run build:calm-lab                # models → widgets → shared → lab, into calm-lab/dist
npm test --workspace calm-lab         # Unit tests
npm run lint --workspace calm-lab     # ESLint
npm run typecheck --workspace calm-lab  # tsc --noEmit
```

`shared` must be built first — the app imports the compiled browser entry, which
`build:calm-lab` takes care of.

## Notes

Commands the browser cannot honour report why: the shell reads the `BROWSER_COMMAND_SUPPORT`
manifest in `shared` rather than guessing, so `calm docify` explains that it needs a local
filesystem and a headless browser and points at the CLI docs.

See [AGENTS.md](./AGENTS.md) for the browser-engine contract and the conventions this package
follows.

Tracked by [#2879](https://github.com/finos/architecture-as-code/issues/2879) and
[#3029](https://github.com/finos/architecture-as-code/issues/3029).
