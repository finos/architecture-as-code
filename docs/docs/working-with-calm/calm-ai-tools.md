---
id: calm-ai-tools
title: CALM AI Tools
sidebar_position: 6
---

# CALM AI Tools

CALM AI Tools give your AI coding assistant a `calm` **agent skill**: a set of instructions that
teaches the assistant the CALM schema, its validation rules and the `calm` CLI, so that it can
create, change and validate CALM architectures with you.

## Overview

The `calm init-ai` command installs the skill into your repository. The skill uses the
[Agent Skills](https://agentskills.io) format, a single `SKILL.md` with supporting reference files,
so the same skill works in every supported assistant. Only the directory in which the assistant
looks for skills differs:

| Assistant | Provider | Installed to |
|---|---|---|
| GitHub Copilot (VS Code, Copilot CLI, coding agent) | `copilot` | `.github/skills/calm/` |
| AWS Kiro | `kiro` | `.kiro/skills/calm/` |
| Claude Code | `claude` | `.claude/skills/calm/` |
| OpenAI Codex (CLI, IDE extension, app) | `codex` | `.agents/skills/calm/` |

## Prerequisites

- **CALM CLI** installed globally: `npm install -g @finos/calm-cli`. The skill runs `calm validate`
  on every document it writes.
- **A Git repository** for your CALM project.
- **An assistant that reads agent skills**: VS Code 1.107 or later with GitHub Copilot Chat,
  Kiro 0.8.0 or later, Claude Code 2.0.74 or later, or Codex.

## Setting up CALM AI support

Run the command in your project directory and choose the assistant you use:

```shell
calm init-ai -p copilot
```

Or target another directory:

```shell
calm init-ai -p kiro --directory /path/to/your/calm-project
```

The command copies the skill into the assistant's skills directory. It creates no other files and
does not change `AGENTS.md`, `CLAUDE.md` or any other instruction file.

## Command options

- **`-p, --provider <provider>`**: the AI coding assistant: `copilot`, `kiro`, `claude` or `codex`.
  Without it, the command prompts for the provider.
- **`-d, --directory <path>`**: target directory (defaults to the current directory).
- **`-v, --verbose`**: enable verbose logging.
- **`-h, --help`**: display help for the command.

```shell
$ calm init-ai -p claude
Selected AI provider: claude
info [calm-ai-tools]:     Setting up the CALM skill for provider "claude" in: /work/my-calm-project
info [calm-ai-tools]:     Git repository detected
info [calm-ai-tools]:     Claude Code integrated with FINOS CALM: skills directory .claude/skills
info [calm-ai-tools]:     ✅ Installed the CALM skill (15 files) in .claude/skills/calm
info [calm-ai-tools]:     🚀 To use: open this repository in your AI assistant and ask it to use the calm skill
```

## What gets installed

```
<skills directory>/calm/
├── SKILL.md         # What CALM is, the workflow, the rules that always apply, how to validate
└── references/      # One file per CALM element, loaded only when the task needs it
    ├── architecture.md
    ├── node.md
    ├── interface.md
    ├── relationship.md
    ├── metadata.md
    ├── control.md
    ├── flow.md
    ├── pattern.md
    ├── standards.md
    ├── timeline.md
    ├── moment.md
    ├── decorator.md
    ├── documentation.md
    └── cli.md
```

The skill loads progressively. The assistant always sees the skill's name and description, which is
how it knows a request is about CALM. When it activates the skill it reads `SKILL.md`, and it reads
a reference file only when the task touches that element. Each reference holds the schema for that
element, a working example and the validation rules, so the assistant produces schema-accurate
JSON without loading the whole CALM specification into its context.

`SKILL.md` makes one step non-negotiable: run `calm validate` and fix every error before the work is
done.

## Using the skill

All four assistants activate the skill on their own when your request matches its description, for
example "add a database node to `trading.architecture.json`". You can also activate it explicitly:

| Assistant | Explicit activation |
|---|---|
| GitHub Copilot | Ask Copilot to "use the calm skill", or reference `.github/skills/calm/SKILL.md` in the chat |
| AWS Kiro | Type `/calm` in the chat |
| Claude Code | Type `/calm` in the REPL |
| Codex | Type `$calm` in the prompt |

### Example prompts

**Creating components:**
```
Create a new node for an API gateway service with REST interfaces
```

**Validation help:**
```
Why is my interface definition failing validation?
```

**Best practices:**
```
What's the recommended way to model a database relationship?
```

**Documentation:**
```
Generate documentation for my CALM architecture
```

## Updating the skill

After you upgrade the CALM CLI, run the command again to refresh the installed skill:

```shell
calm init-ai -p <provider> --directory /path/to/your/calm-project
```

Commit the skill directory with your project so that every contributor, and any cloud coding agent,
gets the same CALM guidance.

## Next steps

- Learn about [Voice Mode](voice-mode) for hands-free architecture modeling
- Try the [Architecture Discovery Skill](../tutorials/build-a-calm-architecture/architecture-discovery-skill-tutorial.md), which builds on this skill
