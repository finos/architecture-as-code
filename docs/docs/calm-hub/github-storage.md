---
id: calm-hub-github-storage
title: GitHub Storage Mode
sidebar_label: GitHub Storage Mode
sidebar_position: 2
---

# GitHub Storage Mode

In GitHub storage mode, CALM Hub serves CALM documents from GitHub repositories. It needs no database. Each namespace maps to one repository and branch. CALM Hub clones each repository, keeps the clone up to date, and serves the files it finds there.

The mode is read-only. To change a document, change the file in the repository. CALM Hub picks up the change on its next sync.

Turn the mode on with `calm.database.mode=github` (environment variable `CALM_DATABASE_MODE=github`).

---

## Configure namespaces

`calm.github.namespaces` lists the namespaces. Separate entries with commas. Each entry has up to four fields, separated by `|`:

```
<namespace>|<owner>/<repo>|<branch>|<group>;<group>
```

| Field | Required | Default | Meaning |
|:------|:---------|:--------|:--------|
| `namespace` | Yes | | The CALM Hub namespace name |
| `owner/repo` | Yes | | The repository, for example `finos/architecture-as-code` |
| `branch` | No | `main` | The branch to serve |
| `groups` | No | `calm.oidc.roles.access` | Groups that can read the namespace, separated by `;`. See [Access control](#access-control) |

```bash
CALM_DATABASE_MODE=github
CALM_GITHUB_NAMESPACES='finos|finos/calm-architectures|main|calm-readers;architects,payments|acme/payments-arch|release|payments-team'
CALM_GITHUB_SERVICE_TOKEN=<token with read access to the repository contents>
```

CALM Hub skips an entry with fewer than two fields and logs a warning. If no entry is configured, CALM Hub starts with no namespaces and logs a warning.

CALM Hub classifies the `.json` and `.md` files in each repository from their content (`moments` or `$schema`) and from their parent directory names (`architectures/`, `patterns/`, `standards/` or `standard-nodes/`, `flows/`, `interfaces/`, `controls/`, `adrs/`, `timelines/`, `decorators/`). A `.json` file under `conventions/<convention-type>/` is a convention, and `conventions/<convention-type>/default.json` is the namespace default for that type.

### Configuration reference

| Property | Environment variable | Default | Description |
|:---------|:---------------------|:--------|:------------|
| `calm.github.namespaces` | `CALM_GITHUB_NAMESPACES` | (none) | Namespace entries, as above |
| `calm.github.service-token` | `CALM_GITHUB_SERVICE_TOKEN` | (none) | Token for `git clone`/`git fetch` and for the GitHub API. Without a token, only public repositories work and the API rate limit is low |
| `calm.github.clone-directory` | `CALM_GITHUB_CLONE_DIRECTORY` | `/tmp/calm-hub-clones` | Each namespace is cloned into a subdirectory with the namespace name |
| `calm.github.oauth.base-url` | `CALM_GITHUB_OAUTH_BASE_URL` | `https://github.com` | Base URL for cloning. CALM Hub clones `<base-url>/<owner>/<repo>.git` |
| `calm.github.api-url` | `CALM_GITHUB_API_URL` | `https://api.github.com` | GitHub REST API base URL, used for version history. For GitHub Enterprise Server, use `https://<host>/api/v3` |
| `calm.github.sync-interval` | `CALM_GITHUB_SYNC_INTERVAL` | `60` | Seconds between syncs |
| `calm.github.git.timeout-seconds` | `CALM_GITHUB_GIT_TIMEOUT_SECONDS` | `30` | Timeout for each clone or fetch |
| `calm.github.max-versions` | `CALM_GITHUB_MAX_VERSIONS` | `100` | Maximum number of versions listed for one document |
| `calm.github.cache.max-size` | `CALM_GITHUB_CACHE_MAX_SIZE` | `10000` | Maximum entries in each in-memory cache of GitHub API responses (version lists and file content) |
| `calm.github.http.connect-timeout` | `CALM_GITHUB_HTTP_CONNECT_TIMEOUT` | `10` | GitHub API connect timeout, in seconds |
| `calm.github.http.request-timeout` | `CALM_GITHUB_HTTP_REQUEST_TIMEOUT` | `30` | GitHub API request timeout, in seconds |
| `calm.oidc.roles.access` | `CALM_OIDC_ROLES_ACCESS` | (none) | Groups that can read a namespace whose entry lists no groups, separated by `;` |
| `calm.oidc.roles.allow-authenticated-read` | `CALM_OIDC_ROLES_ALLOW_AUTHENTICATED_READ` | `false` | When `true`, any authenticated user can read a namespace that has no groups (neither per-namespace nor via `calm.oidc.roles.access`) |

Set the token as an environment variable or secret. Do not put it in a properties file.

---

## How sync works

1. At startup, CALM Hub registers the namespaces and clones the repositories in the background. Startup does not wait for the clones. Until a clone is complete, requests for its namespace return `404`.
2. CALM Hub keeps only the latest commit of each clone (`--depth 1`). If a valid clone is already in the clone directory, for example after a restart, CALM Hub fetches it instead of cloning again.
3. Every `calm.github.sync-interval` seconds, CALM Hub fetches each repository and resets the clone to `origin/<branch>`. A force-push on the branch is applied like any other change. A namespace whose clone failed is cloned again on the next sync.
4. After each clone or sync, CALM Hub rebuilds its in-memory list of documents.

If some repositories fail to clone or fetch, CALM Hub logs an error and serves the namespaces that did succeed.

---

## Versions

In this mode, a version is a commit, not a number.

- The versions of a document are the abbreviated (7-character) SHAs of the commits that changed its file on the configured branch, oldest first. CALM Hub gets them from the GitHub commits API, up to `calm.github.max-versions`.
- If the API returns no history (for example, it cannot be reached or the rate limit is exceeded), the version list has one entry: the SHA of the commit that the clone holds.
- There is no semantic version and no `latest` version. A request for a version that is not a commit SHA returns `404`.
- CALM Hub reads the version that the clone holds from disk. It gets any other version from the GitHub contents API and caches the response.

---

## Read-only

GitHub mode is not the same as the read-only images (`calm.readonly=true`). Those images reject writes with `405` before the request reaches CALM Hub's storage. In GitHub mode, the storage layer refuses writes:

- Endpoints that create, change or delete documents, namespaces, domains or access grants return `501 Not Implemented`. If access control is on, a caller usually gets `403` first, because GitHub mode grants only read access.
- The endpoints that list or read access grants return `501`, because access comes from the identity provider, not from stored grants.
- CALM Hub does not store an audit trail in this mode. Audit events are only written as log lines under the `org.finos.calm.audit` category, and CALM Hub logs a warning about this at startup. Send that category to a durable log store if you need the trail.

---

## Access control

GitHub mode has no stored access grants. Read access to a namespace comes from the caller's groups.

- A caller can read a namespace if one of their groups is in the namespace's `groups` field.
- If the entry lists no groups, `calm.oidc.roles.access` applies instead.
- If neither is set and `calm.oidc.roles.allow-authenticated-read` is `false` (the default), no caller gets access to the namespace through groups. When `allow-authenticated-read` is `true`, any authenticated user can read the namespace.
- A caller can read a control domain if they can read a namespace that has controls in that domain.
- `calm.auth.allow-public-read=true` makes every namespace readable by every caller. With `calm.auth.enabled=false` (local testing only), every namespace is visible.

The caller's groups are the roles in their CALM Hub identity. The `oidc` profile maps the token's `groups` claim to roles (`quarkus.oidc.roles.role-claim-path=groups`). Make sure your identity provider puts the group names in that claim. To change who can read a namespace, change the group membership in the identity provider, or change the namespace entry and restart CALM Hub.

For the general permission model, see the [entitlements guide](../working-with-calm/calm-hub-entitlements.md).

---

## Repository content is untrusted

Anyone who can push to a configured branch controls what CALM Hub serves for that namespace. CALM Hub refuses to read a file that is a symbolic link, and it only reads a file if its real location is inside the namespace's own clone directory. Protect each configured branch as you would any other source of record, for example with branch protection and required reviews.
