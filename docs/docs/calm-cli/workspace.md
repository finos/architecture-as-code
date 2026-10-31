---
id: workspace
title: Working with Workspaces
sidebar_label: workspace
---

# Working with Workspaces

The `workspace` command group manages a set of related CALM documents in a git repository. A workspace tracks your documents, keeps their versions and references in step, and pushes them to CALM Hub as one set.

Use [`calm hub`](hub.md) to push or pull one document at a time. Use a workspace when your documents refer to each other, for example an architecture that conforms to a pattern that uses your standards, and you want to change and release them together.

## Concepts

**Workspace** — a named set of CALM documents in a repository. Workspace data is in the `.calm-workspace/` directory at the repository root. A repository can have more than one workspace. `.calm-workspace/workspace.json` records the active workspace.

**Bundle** — the directory of a workspace: `.calm-workspace/bundles/<name>/`. It contains:

- `workspace-manifest.json` — the list of tracked documents. Each entry has the file path, document type and CALM Hub namespace. Entries for narrative documents also have their CALM Hub identity.
- `files/` — copies of documents that you added with `--copy`. By default, the workspace refers to each document at its location in the repository.

**Manifest ID** — the name of a document in the workspace. Other workspace commands use it, for example `calm workspace rm <id>`.

**Document `$id`** — the CALM Hub address of a JSON document, which includes its version. The workspace uses it to know where to push the document:

```
namespace resource:    $BASE_URL/calm/namespaces/$NAMESPACE/$TYPE/$MAPPING/versions/$VERSION
control requirement:   $BASE_URL/calm/domains/$DOMAIN/controls/$CONTROL/requirement/versions/$VERSION
control configuration: $BASE_URL/calm/domains/$DOMAIN/controls/$CONTROL/configurations/$CONFIG/versions/$VERSION
```

`$TYPE` is one of `patterns`, `architectures`, `flows`, `standards` or `interfaces`.

**Snapshot** — a version with a `-SNAPSHOT` suffix, for example `1.1.0-SNAPSHOT`. CALM Hub lets you push a snapshot again with changed content. All other versions are immutable.

### Document Resolution

In a workspace, `calm validate` and `calm generate` load tracked documents from your local files and not from CALM Hub. A reference to a tracked document resolves to the local file when it uses any of these:

- the manifest ID,
- the document's `$id`,
- the CALM Hub path of the document at a different version,
- a full URL of the document.

You can validate a set of changed documents together before you push them.

The CLI finds the workspace from the current directory. It looks up the directory tree, but not above the git repository root. To use a different bundle, set the `CALM_WORKSPACE_BUNDLE` environment variable to the bundle directory.

## Getting Started

```shell
# 1. Create a workspace in the current git repository
calm workspace init payments

# 2. Make a new architecture. The CLI asks for the parts of its $id
calm workspace new architecture "Payment Gateway"

# 3. Add a pattern that you already have
calm workspace add ./patterns/microservice-pattern.json --type pattern

# 4. Look at the dependencies between the documents
calm workspace tree

# 5. Push all the documents to CALM Hub
calm workspace push --calm-hub-url https://calmhub.example.com
```

To use CALM Hub without `--calm-hub-url` on each command, set `calmHubUrl` in `~/.calm.json`. See [Configuring the CLI](configuration.md).

## Versioning Lifecycle

The workspace commands give each change to a document a new version. They also update all references to that document.

1. Change a tracked document.
2. Run `calm workspace check`. It finds documents that are different from CALM Hub at the same version.
3. Run `calm workspace bump`. It gives the changed documents new versions and updates the references to them in the other tracked documents. Documents that refer to a bumped document also get a new version.
4. Run `calm workspace push`. It creates the new versions in CALM Hub.

:::note
`push` never changes a version. It creates the version that each document declares in its `$id`. Run `bump` before `push` when a document has changed.
:::

### Bump Behaviour

- The new version comes from the latest version in CALM Hub, not from the version in the file.
- `bump` updates each `$ref`, `$schema`, `requirement-url` and `config-url` that pointed to the old version, in all tracked documents. It keeps URL fragments.
- `bump` changes a document only one time before you push it. If you change the document again and run `bump` again, the version does not change, because the version in the file is already higher than the version in CALM Hub.
- If you do not supply `--major`, `--minor` or `--patch`, `bump` asks for each changed document. The default is a minor bump. You can change the default with [`bump.defaultIncrement`](#workspace-configuration).
- When a document gets a new version because a document that it refers to changed, `bump` asks for its bump type too. It selects the bump type of that document first. Use `--inherit-change-type` to use that bump type without a prompt.

### Snapshots

Use a snapshot when you want to push a document many times while you work on it:

1. `calm workspace snapshot <id>` adds `-SNAPSHOT` to the version. If CALM Hub already has the version in the file, the command bumps it first.
2. Change the document and run `calm workspace push` as many times as necessary. Each push replaces the snapshot in CALM Hub.
3. `calm workspace release <id>` removes the `-SNAPSHOT` suffix.
4. `calm workspace push` creates the release version.

Only `pattern`, `architecture`, `flow`, `standard` and `interface` documents can be snapshots.

:::warning
A released document must not refer to a snapshot, because the content of a snapshot can change. `check` and `push` fail if a document that is not a snapshot refers to a tracked snapshot, or to a `-SNAPSHOT` version of any document. Release the snapshot first, or refer to a released version.
:::

## Using Workspaces in CI

Use `check` to stop a pull request from merging with changes that do not have a new version. Use `push` when you merge, to publish the new versions:

| Stage | Command | Result |
|---|---|---|
| Pull request | `calm workspace check` | Fails if a changed document needs a new version, or if an architecture or pattern is not valid |
| Merge | `calm workspace push` with `push.failIfModified: true` | Creates the new versions. Fails if a released version in CALM Hub has different content |

Contributors run `calm workspace bump` on their branch, and they commit the result.

### Workspace Configuration

`.calm-workspace/config.json` applies to all workspaces in the repository. Commit it, so that CI uses the same settings:

```json
{
  "push": { "failIfModified": true },
  "bump": { "defaultIncrement": "MINOR" }
}
```

| Field | Values | Default | Description |
|---|---|---|---|
| `push.failIfModified` | `true`, `false` | `false` | When `true`, `push` fails if a document has changed but CALM Hub already has its version. When `false`, `push` skips the document |
| `bump.defaultIncrement` | `MAJOR`, `MINOR`, `PATCH` | `MINOR` | The bump type that `bump` uses when you do not supply one |

## Narrative Documents

A workspace can also track Markdown documents of type `knowledge` (knowledge articles) or `sad` (solution architecture documents). These documents have no `$id`, and the workspace never changes the Markdown.

- The document must have YAML front matter with a `title`. The `title` becomes the manifest ID, unless you supply `--id`.
- `--namespace` is necessary when you add the document.
- The first version is `1.0.0`. The first `push` records the CALM Hub document ID, location and version in the manifest.
- After you change the document, run `bump` before `push`. `bump` changes the version in the manifest.

```shell
calm workspace add ./docs/payments-sad.md --type sad --namespace finos
calm workspace push
calm workspace show                   # shows the CALM Hub location
# Change ./docs/payments-sad.md, then:
calm workspace bump --minor
calm workspace push
```

### Recovering a Narrative Document

To add a narrative document that is already in CALM Hub without making a new one, supply its CALM Hub document ID and version. The local Markdown must be the same as that version in CALM Hub. Differences in line endings (LF or CRLF) are ignored.

```shell
calm workspace add ./docs/payments-sad.md --type sad --namespace finos \
  --calm-hub-document-id 42 --ver 1.2.0
```

If a push stops before the CLI knows whether CALM Hub created the document, the manifest entry stays pending. The next push stops until you resolve it. Look in CALM Hub first:

- **CALM Hub has the document** — run `calm workspace add` with the pending entry's manifest ID, type, namespace and version, and with `--calm-hub-document-id`.
- **CALM Hub does not have the document** — run `calm workspace rm <id>`, then `calm workspace add` again. The document starts again at version `1.0.0`. Fix the CALM Hub URL or the connection problem before you push again.

## Command Reference

All commands that connect to CALM Hub accept `--calm-hub-url <url>`. If you do not supply it, they use `calmHubUrl` from `~/.calm.json`.

### init

Create a workspace, or update it, and make it the active workspace.

```shell
calm workspace init <name> [--dir <path>]
```

- **`--dir <path>`**: The directory in which to create the workspace. The default is the git repository root.

### add

Add an existing document to the active workspace.

```shell
calm workspace add <file> [--id <id>] [--type <type>] [--namespace <namespace>] [--copy]
                          [--calm-hub-document-id <id> --ver <version>] [--calm-hub-url <url>]
```

- **`--id <id>`**: The manifest ID. The default is the `title` of the document (the `name` of a flow), or the front matter `title` for Markdown. If the document has neither, the command asks for an ID.
- **`--type <type>`**: The document type: `pattern`, `architecture`, `interface`, `flow`, `control`, `schema`, `timeline`, `adr`, `knowledge` or `sad`. If you do not supply it, the type comes from the `$id`, or the command asks for it.
- **`--namespace <namespace>`**: The CALM Hub namespace. Necessary for narrative documents. For JSON documents, the default comes from the `$id`.
- **`--copy`**: Copy the file into the bundle `files/` directory. By default, the workspace refers to the file at its location.
- **`--calm-hub-document-id <id>`** and **`--ver <version>`**: Add a narrative document that is already in CALM Hub. Use them together. See [Recovering a Narrative Document](#recovering-a-narrative-document).
- **`--calm-hub-url <url>`**: The CALM Hub URL for narrative document recovery.

What `add` does with the `$id` of a JSON document:

| `$id` | Result |
|---|---|
| None | The command [asks for the parts of a `$id`](#building-a-id), writes it into the file, and adds the document |
| A CALM Hub `$id` | The command does not change it, and gets the namespace from it. The `--type` must agree with the `$id`, or `add` fails |
| Not a CALM Hub `$id` | The command does not change it, and adds the document with a warning. You cannot push the document until you fix its `$id` |

### new

Make a new document from a template in the current directory, and add it to the active workspace.

```shell
calm workspace new [type] [name] [template]
```

- **`type`**: The document type: `pattern`, `architecture`, `interface`, `flow`, `control`, `schema`, `timeline` or `adr`.
- **`name`**: The title of the document. A flow gets it as its `name`.
- **`template`**: The template to use. `pattern` has `empty` and `with-structure`. Other types have `empty`.

The command asks for each argument that you do not supply. It always [asks for the parts of the `$id`](#building-a-id). The file name is `<slug>.<type>.json`. The slug is the mapping ID, or the control or configuration name.

#### Building a `$id`

When `new` or `add` makes a `$id`, it asks for the scope and then each part. The default version is `1.0.0`. The default base URL is `calmHubUrl` from `~/.calm.json`. When the document type sets the resource type, for example `flow`, the command does not ask for the scope or resource type. For a `control`, it asks only if the document is a requirement or a configuration. A `timeline` or `adr` has no CALM Hub resource type, so it asks only for a document ID.

### push

Push all tracked documents to CALM Hub.

```shell
calm workspace push [--calm-hub-url <url>] [--fail-if-modified]
```

- **`--fail-if-modified`**: Fail if a document has changed but CALM Hub already has its version. This option overrides `push.failIfModified`.

| State in CALM Hub | Result |
|---|---|
| The version does not exist | `push` creates it |
| The version exists with the same content | `push` skips the document |
| The version exists with different content | `push` skips the document, or fails with `--fail-if-modified` |
| The version is a snapshot with different content | `push` replaces it |

`push` skips a document, with a warning, if its `$id` is not a CALM Hub `$id`.

### check

Find tracked documents that have changed but do not have a new version, and validate the workspace.

```shell
calm workspace check [--calm-hub-url <url>]
```

`check` exits with a non-zero status when:

- a document is different from CALM Hub at the same version,
- a document that is not a snapshot refers to a snapshot,
- an architecture or pattern is not valid, or validation cannot run.

New documents, documents with a version that is higher than CALM Hub, and changed snapshots do not fail the check.

`check` validates each architecture and pattern with the same `~/.calm.json` settings as `calm validate`. It prints a summary:

```
1 document(s) failed validation:
  my-arch (2 error(s)) — run `calm validate -a .calm-workspace/files/my-arch.json` to see full output
```

### bump

Give each changed document a new version, and update all references to it. See [Bump Behaviour](#bump-behaviour).

```shell
calm workspace bump [--calm-hub-url <url>] [--major | --minor | --patch] [--inherit-change-type]
```

- **`--major`**, **`--minor`**, **`--patch`**: Use this bump type for all changed documents, with no prompts.
- **`--inherit-change-type`**: Give each dependent document the bump type of the document that it refers to, with no prompt.

After it bumps the documents, `bump` validates the workspace and prints the same summary as `check`. Validation failures do not change the exit code of `bump`. If CALM Hub has a snapshot of the new version, `bump` shows a warning, because a push of that version deletes the snapshot.

### snapshot

Make a tracked document a snapshot. See [Snapshots](#snapshots).

```shell
calm workspace snapshot [id] [--calm-hub-url <url>] [--major | --minor | --patch]
```

If you do not supply `id`, the command asks you to select a document. If CALM Hub already has the version in the file, the command bumps the version from the latest release in CALM Hub first. If CALM Hub already has the new snapshot, for example from a colleague, the command shows a warning, because your next push replaces it.

### release

Remove the `-SNAPSHOT` suffix from a tracked document.

```shell
calm workspace release [id] [--calm-hub-url <url>]
```

The command fails if the document refers to a snapshot, or if CALM Hub already has the release version. In the second case, use `bump`.

### tree

Show the dependencies between the tracked documents.

```shell
calm workspace tree
```

```
├─ payments-gateway (./../../../architectures/payments.arch.json)
│  └─ payments-pattern (./../../../patterns/payments.pattern.json)
└─ local-arch (./../../../architectures/local.arch.json)
   └─ payments-pattern (./../../../patterns/payments.pattern.json)
```

Each line shows the manifest ID and the path relative to the bundle, or `pulled` for a copied file. A reference can be a manifest ID, a path relative to the bundle, or the `$id` of a tracked document at any version. The tree does not show references to documents that the workspace does not track.

### list

Show the workspaces in the repository. A `*` marks the active workspace.

```shell
calm workspace list
```

### show

Show the active workspace and its documents, with the type, namespace and CALM Hub location of each document.

```shell
calm workspace show
```

### rm

Remove a document from the active workspace.

```shell
calm workspace rm [id]
```

If you do not supply `id`, the command asks you to select a document.

:::note
`rm` removes only the manifest entry. It does not delete the file, or the document in CALM Hub.
:::

### switch

Make a different workspace active.

```shell
calm workspace switch <name>
```

### clean

Remove the copied files from the bundle and empty its manifest. The bundle directory stays.

```shell
calm workspace clean [--all]
```

- **`--all`**: Clean all workspaces and reset `workspace.json`.

:::warning
`clean` removes all documents from the workspace, not only the copied files. To track the documents again, add them again.
:::
