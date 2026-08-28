# CALM Learning Lab

An in-browser learning lab for CALM: a terminal, an editor and a live diagram, with `calm validate`
and `calm diff` running the real CALM engine (`@finos/calm-shared/browser`) — the same validation
the CLI performs, with nothing to install and nothing sent to a server.

Hosted at **<https://lab.calm.finos.org>**. It has its own origin because many CALM users work
behind proxies that block sites accepting free-text input; the documentation at
<https://calm.finos.org> stays reachable, and the lab can be allow-listed on its own.

Learners work through guided lessons in an IDE-style workspace: a lesson rail with steps and
hints, an editor, a terminal, a Problems tab and a live diagram. Every step is checked against
real state — the saved workspace and the engine's validation result — so any valid solution passes.

## Lessons

A lesson is data: seed files for the virtual filesystem, an ordered list of steps, and a
completion panel. Today the lab ships one lesson, defined in `src/lab/lesson.js`:

| Export | What it is |
|---|---|
| `SEED_FILES` | The workspace at the start of the lesson — a map of absolute path → file contents under `HOME_DIR` (`/workspace`). Seeded on first visit and on "Reset lesson". |
| `ARCHITECTURE_FILE` | The file the editor opens and the checks read. |
| `STEPS` | Ordered steps: `{ id, title, body, hintLabel, hint, check }`. `body` is the instruction (inline code in backticks); `hint` is what the learner can copy — for editing steps, the **complete** target file, so paste-replace-save always yields a valid result. |
| `COMPLETION` | Heading, message and links shown when every step is ticked. |

A step's `check(state)` is a pure function of `{ doc, validation, hasValidatedOk }`: `doc` is the
saved architecture parsed as JSON (or `null`), `validation` is the engine's result for the saved
file (`ok` is true when there are no errors), and `hasValidatedOk` records that `calm validate`
has succeeded on the lesson file at least once. Checks are deliberately state-based rather than
event-ordered, so the order in which a learner edits, saves and validates never wedges a step.
Keep checks about the model (does the document contain the thing the step asked for, and is it
valid?), not about how the learner got there.

To change or extend the lesson, edit `src/lab/lesson.js` and cover the new checks in
`src/lab/lesson.spec.js`. Publishing **multiple** lessons — lessons as standalone data files,
a lesson picker, per-lesson progress, and "try it in your browser" links from the tutorials —
is Phase A of [#2879](https://github.com/finos/architecture-as-code/issues/2879) and is not
supported yet.

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
