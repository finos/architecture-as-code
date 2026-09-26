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

A lesson is data: seed files for the virtual filesystem, an ordered list of steps, and a
completion panel (see `src/lessons/types.ts`). Today the lab ships one lesson, defined in
`src/lessons/quick-start/lesson.ts` and registered in `src/lessons/index.ts`:

| Field | What it is |
|---|---|
| `seedFiles` | The workspace at the start of the lesson — a map of absolute path → file contents under `HOME_DIR` (`/workspace`). Seeded on first visit and on "Reset lesson". |
| `editorFile` | The file the editor opens and the checks read. |
| `steps` | Ordered steps: `{ id, title, body, hint, check }`. `body` is the instruction (inline code in backticks); `hint` is what the learner can copy — either `{ kind: 'commands', commands }` or, for editing steps, `{ kind: 'file', content }` with the **complete** target file, so paste-replace-save always yields a valid result. |
| `completion` | Heading, message and links shown when every step is ticked. |

A step's `check(state)` is a pure function of a `LessonState`: `doc` is the saved architecture
parsed as JSON (or `null`), `validation` is the engine's result for the saved file (`ok` is true
when there are no errors), and `commands` are the terminal outcomes still fresh for the files they
read (see `src/lessons/checks.ts`). Checks are deliberately state-based rather than event-ordered,
so the order in which a learner edits, saves and validates never wedges a step. Keep checks about
the model (does the document contain the thing the step asked for, and is it valid?), not about
how the learner got there.

To change or extend a lesson, edit its `lesson.ts` and cover the new checks in its `lesson.spec.ts`;
`src/lessons/invariants.spec.ts` checks every registered lesson against the same rules (unique ids,
seeded editor file, hints that actually complete each step, only real `calm` commands in the copy).
Publishing **multiple** lessons end-to-end — a lesson picker, per-lesson progress, and "try it in
your browser" links from the tutorials — is Phase A of
[#2879](https://github.com/finos/architecture-as-code/issues/2879) and is not supported yet.

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
