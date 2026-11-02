# CALM AI

The `calm` agent skill: the instructions an AI coding assistant follows to create, validate and
document FINOS CALM architectures. `calm init-ai` installs it into a repository for GitHub Copilot,
AWS Kiro, Claude Code or Codex.

The skill follows the [Agent Skills](https://agentskills.io) format, so one `SKILL.md` works in
every assistant that reads that format. Nothing here is provider-specific except the directory in
which each assistant looks for skills.

## Layout

```
calm-ai/
├── ai-assistants/          # One JSON file per provider: where it discovers skills
│   ├── claude.json         #   .claude/skills
│   ├── codex.json          #   .agents/skills
│   ├── copilot.json        #   .github/skills
│   └── kiro.json           #   .kiro/skills
└── skills/calm/
    ├── SKILL.md            # Entry point: concepts, workflow, rules, validation
    └── references/         # One file per CALM element, read on demand
        ├── architecture.md
        ├── cli.md
        ├── control.md
        ├── decorator.md
        ├── documentation.md
        ├── flow.md
        ├── interface.md
        ├── metadata.md
        ├── moment.md
        ├── node.md
        ├── pattern.md
        ├── relationship.md
        ├── standards.md
        └── timeline.md
```

## Progressive disclosure

The skill is loaded in three stages, so the assistant only pays for the context it needs:

| Stage | What loads | When |
|---|---|---|
| Metadata | `name` and `description` from the `SKILL.md` frontmatter | Always. The assistant uses it to decide that a request is about CALM |
| Body | The rest of `SKILL.md`: concepts, workflow, routing table, rules, validation | When the skill is activated |
| References | One `references/<element>.md` file | When the task touches that element. `SKILL.md` names the file to read |

Keep `SKILL.md` short. Detail belongs in a reference file, and each reference must stand on its own:
schema, example, validation rules and the pitfalls for that one element. Cross-reference other
files by name (`` see `metadata.md` ``).

## Installation

`calm init-ai -p <provider>` copies `skills/calm/` to `<skillsDirectory>/calm/` in the target
repository, where `skillsDirectory` comes from `ai-assistants/<provider>.json`. The command is
idempotent: run it again to refresh the skill after a CLI upgrade. The CLI build copies this
directory into `cli/dist/calm-ai/` (`npm run copy-ai-tools`).

User documentation: [CALM AI Tools](https://calm.finos.org/working-with-calm/calm-ai-tools).

## Contributing

**Change a reference**: edit the file under `skills/calm/references/`. Keep the schema excerpts in
step with CALM release 1.3 and keep the mandatory `calm validate` step.

**Add a reference**: add the file, then add a row to the table in `SKILL.md`. The CLI copies every
file under `skills/calm/`, so no code change is needed. `cli/src/cli.e2e.spec.ts` lists the expected
reference files: add the new one there.

**Add a provider**: add `ai-assistants/<provider>.json` with `description` and `skillsDirectory`
(relative to the repository root, no `..`), add the provider to `AI_PROVIDER_CHOICES` in
`cli/src/cli.ts`, and add it to the provider tables in `cli/src/cli.e2e.spec.ts` and
`cli/src/command-helpers/ai-tools.spec.ts`.

Test with `npm test --workspace cli`, then `npm run build:cli` and `calm init-ai -p <provider>`
in a scratch repository.

## Related

- CLI: [cli/AGENTS.md](../cli/AGENTS.md)
- CALM schema: https://calm.finos.org/release/1.3/meta/calm.json
- Agent Skills format: https://agentskills.io
