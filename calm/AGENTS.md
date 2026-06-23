# CALM Schema - AI Assistant Guide

## Project Overview

The `calm/` directory holds the **CALM JSON Meta Schema** — the authoritative definition of
the Common Architecture Language Model. Everything here is specification, not application code:
JSON Schema documents under `meta/`, reference components (`controls/`, `interfaces/`), worked
examples, and the governance process that controls how the schema evolves.

Also include all rules from [the root level AGENTS.md](../AGENTS.md).

The human-facing governance process lives in [`README.md`](README.md) and is authoritative.
This guide is the machine-facing summary of *how to make a schema change correctly* — read it
before editing anything under `calm/`.

## Directory Layout

```
calm/
├── draft/<issue-number>/      # In-progress schema changes (freely editable)
│   ├── meta/                  #   the proposed schema documents
│   └── prototype/             #   examples demonstrating the change
├── release/<version>/         # Published, IMMUTABLE releases (1.0, 1.1, 1.2, …)
│   └── meta/                  #   the published schema documents
├── release/<version>-rcN/      # Release candidates (e.g. 1.0-rc1) — siblings of the release, during testing
├── controls/                  # Golden-source standardised control definitions
├── interfaces/                # Golden-source standardised interface definitions
├── architecture/              # Reference architectures (e.g. calm-1.json, calm-2.json)
└── getting-started/           # Tutorial material
```

## Critical Rules for Schema Changes

### 1. Never edit a released schema

Everything under `calm/release/<version>/` is **immutable** once published. Each schema is pinned
by its `$id` (e.g. `https://calm.finos.org/release/1.2/meta/interface.json`), and existing
architectures resolve against those URLs. Editing a released schema is a silent breaking change.

To change the schema, you create or edit a **draft** — never a release.

### 2. All schema work goes in `calm/draft/<issue-number>/`

- A schema change starts with a GitHub issue (see step 1 of the workflow below).
- The proposed schema lives in `calm/draft/<issue-number>/meta/`.
- Worked examples demonstrating the change live in `calm/draft/<issue-number>/prototype/`.
- Drafts are **freely editable** — iterate without restriction; acceptance as a draft is not a
  guarantee it will be released.

### 3. Provide prototype examples

A schema change without an example is incomplete. Add at least one example architecture under
`prototype/` that exercises the new or changed construct, so reviewers and tooling can validate it.

## Schema Change Workflow

1. **Propose** — open a GitHub issue using the
   [Schema Change Proposal template](https://github.com/finos/architecture-as-code/issues/new?template=Schema_change_proposal.md).
2. **Draft** — implement the change in `calm/draft/<issue-number>/meta/`, with examples in
   `calm/draft/<issue-number>/prototype/`.
3. **Review** — schema PRs require approval from at least one member of the
   [`calm-schema-governance`](https://github.com/orgs/finos/teams/calm-schema-governance) team.
4. **Validate** — when selected for release, the draft must pass validation against the CALM CLI
   and CALM Hub, including backward-compatibility checks.
5. **Release** — a Release Candidate is published under `calm/release/`, tested by the community
   for four weeks, then promoted to an official release with a changelog (and migration guide for
   breaking changes).

See [`README.md`](README.md) for the full governance detail, roles, and release policy.

## Tooling Impact

Schema changes ripple into the TypeScript tooling — account for these when proposing a change:

- **Validation rules** — structural JSON Schema constraints are enforced by the meta schema, but
  cross-reference and semantic checks (e.g. "a referenced interface exists on the target node")
  live in Spectral rules under `shared/src/spectral/`. A schema change that adds a referential
  constraint usually needs a matching Spectral rule and tests.
- **Bundled schemas** — `shared` resolves schemas via its schema directory; a new schema version
  must be wired in there for the CLI and Hub to recognise it.
- **CLI + Hub** — both must validate cleanly against a new schema before it is released.

When tightening a constraint (e.g. adding `additionalProperties: false`, adding a `required`
field, or narrowing a type), treat it as **potentially breaking**: only existing draft schemas may
change freely; the same change against a release requires a new version and migration guidance.
