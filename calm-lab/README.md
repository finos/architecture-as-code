# CALM Learning Lab

An in-browser learning lab for CALM: a terminal, an editor and a live diagram, with `calm validate`
and `calm diff` running the real CALM engine (`@finos/calm-shared/browser`) — the same validation
the CLI performs, with nothing to install and nothing sent to a server.

Hosted at **<https://lab.calm.finos.org>**. It has its own origin because many CALM users work
behind proxies that block sites accepting free-text input; the documentation at
<https://calm.finos.org> stays reachable, and the lab can be allow-listed on its own.

The lesson takes about ten minutes: read a CALM architecture, add a service node, connect it up,
and validate the result.

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
