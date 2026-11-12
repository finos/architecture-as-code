# ADR 0014: Extension commands in the CLI and MCP

**Status**: Proposed. Not built. Runtime tool registration in a native image is
not yet tested.

## Context

Automation and AI agents must reach extension features without a browser. Each
manifest command ([ADR 0012](0012-extension-manifest-registry-and-versioning.md))
names a proxied route and carries input and output schemas.

Facts in the code and the libraries:

- The CLI registers all commands with Commander before it makes any network call.
  The `hub` commands take `-c` and `-f` for configuration.
- `quarkus-mcp-server` has `ToolManager`, which registers a tool at start up with
  an input schema, an output schema and annotations. No Hub code uses it yet.
- MCP tools in Hub do not pass through JAX-RS filters, so they skip the read-only
  filter and the audit filter.
- The MCP 2026-07-28 revision removes sessions and asks for a stable `tools/list`
  order.

gh and kubectl do not let a plugin replace a core command. Azure CLI lets an
extension replace one, with only a warning.

## Decision

**CLI.** Use generic dispatch under `hub`:

- `calm hub extensions list`
- `calm hub extensions describe <id> [<command>]`
- `calm hub ext <id> <command> --input <file|-> [--arg key=value]`

Output is JSON by default. `-c` and `-f` work as for the other `hub` commands.
The CLI does not make subcommands from the network: `--help` would then need a
Hub call before it can read `-c`, and would fail offline. Hub validates the
input, so every client sees one error format. An extension cannot replace a
built-in command.

**MCP.** At start up, Hub registers one tool for each command through
`ToolManager`:

- The name is `ext_<id>_<command>`. Hub checks the length at start up.
- Tools are sorted by name.
- `readOnly` sets `readOnlyHint`. `destructive` and `idempotent` set their hints.
- The input and output schemas come from the manifest.

The tool handler calls the same proxy service as the REST route, so scope,
read-only, audit and limits apply ([ADR 0011](0011-extension-proxy-request-handling.md)).
It checks `calm.mcp.enabled`. Hub does not hide tools from a user with a
`ToolFilter`. It checks the scope when the tool is called.

**Fallback.** If the step-0 spike shows that `ToolManager` registration or its
security context fails in a native image, Hub registers two static tools,
`extensions_list` and `extensions_call`.

## Consequences

- The CLI `--input` object and the MCP `arguments` object are the same object.
  One contract serves scripts and agents.
- Agents see the real schema and the read-only hint for each command. With the
  generic fallback, `extensions_call` must be marked destructive, so each call
  asks the user to confirm.
- A command that a read-only Hub cannot run is not registered as a tool and is
  not listed by the CLI.
- How a programmatic tool handler gets the caller's `SecurityIdentity` is not yet
  known, because `@PermissionsAllowed` cannot be put on a lambda. The spike must
  answer this before this ADR is accepted.
