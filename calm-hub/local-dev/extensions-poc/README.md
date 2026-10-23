# CALM Hub extensions: proof of concept

A throwaway demo for [#3396](https://github.com/finos/architecture-as-code/issues/3396). It is not for merge.

An external service supplies a top-level screen in CALM Hub. Hub sends the service a signed identity of the signed-in user, never the user's token. The service sends back JSON blocks, and Hub draws them with its own components, so the screen matches Hub in light and dark mode.

```
browser ──► nginx basic auth ──► Hub UI dev server ──► CALM Hub (proxy-auth) ──► team-services extension
            :8088                :5180                  :8090                     :8091
            sets Remote-User                            signs X-Calm-Hub-Identity  checks it with Hub's JWKS
```

## Before you start

| Need | Check | Why |
|---|---|---|
| Node 26 | `node --version` | The repository requires it. Use `nvm use` |
| Java 21 or later | `java -version` | Builds and runs Hub |
| Docker Desktop | `docker info` | Runs nginx. nginx reaches the host through `host.docker.internal` |
| `jq`, `openssl`, `curl` | `jq --version` | The seed script uses `jq`. `start.sh` makes a key and users with `openssl` |
| Free ports 8088, 8090, 8091, 5180 | `lsof -iTCP -sTCP:LISTEN -nP` | A normal local Hub on 8080 and Vite on 5173 can stay up |

## Get the code

Use a separate worktree. `npm ci` replaces `node_modules`, so do not run it in a checkout that you use for other work.

```bash
cd architecture-as-code
git fetch https://github.com/finos/architecture-as-code.git poc/3396-extension-screen
git worktree add ../aac-extensions-poc FETCH_HEAD
cd ../aac-extensions-poc
```

Run all the commands below from the root of that worktree.

## Build (one time, about five minutes)

```bash
npm ci
npm run build --workspace calm-models
./mvnw -pl calm-hub package -Pserver-only -DskipTests -Djacoco.skip=true -Dquarkus.profile=standalone,proxy-auth
```

Hub selects `proxy-auth` at build time (`ProxyAuthenticationMechanism` is `@IfBuildProfile`). A jar built without `-Dquarkus.profile=standalone,proxy-auth` does not read the `Remote-User` header. `-Pserver-only` skips the bundled UI, because the demo serves the UI from Vite.

## Seed (one time)

```bash
calm-hub/local-dev/extensions-poc/seed.sh
```

This starts Hub with no auth on `127.0.0.1:8090`, loads the standard seed data (`calm-hub/nitrite/init-nitrite.sh`) into `.generated/hub-data`, then stops Hub. The demo links to the `finos.fluxnova` architectures in that data.

## Start

```bash
calm-hub/local-dev/extensions-poc/start.sh
```

Wait for `Ready`, then open http://localhost:8088. Ctrl-C stops all of it, including nginx.

| User | Password | Sees |
|---|---|---|
| `alice` | `calm` | Tech lead in payments-core: four services, an incident and a missing architecture |
| `bob` | `calm` | Engineer in risk-engineering: two services |
| `zed` | `calm` | Not in a team: a short message |

Open the screen from the **EXTENSIONS** section on the landing page, or from the menu (**Extensions > Team services**) on any other page.

## What to try

| Try | Expect |
|---|---|
| Sign in as `alice`, then as `bob` (use a private window) | Different content. Hub's menu shows "Signed in as" the same user |
| Click an architecture in the table or a card | The architecture opens in Hub |
| Turn on dark mode | The screen follows the theme |
| `curl -u alice:calm -H 'Remote-User: mallory' http://localhost:8088/api/calm/ui/config` | `"name":"alice"`. nginx replaces the header |
| `curl -i http://localhost:8091/screen` | `401`. The extension rejects a call with no identity |
| `curl -u alice:calm http://localhost:8088/api/calm/extensions` | The extension list, without the backend address |

## How it works

| Part | Where | Does |
|---|---|---|
| Login proxy | `nginx.conf`, `docker-compose.yml` | Basic auth. Sets `Remote-User` and removes the `Authorization` header |
| Hub | `calm-hub/src/main/java/org/finos/calm/extensions/`, `ExtensionResource`, `JwksResource` | Loads the manifests at start up. Signs the identity. Calls the extension. Checks the reply |
| Hub UI | `calm-hub-ui/src/extensions/`, `src/components/extensions/`, `IntroBrowse.tsx` | Menu group, landing section, `#/ext/<id>` route, one component for each block type |
| Extension | `team-services/server.mjs` | Checks the identity. Builds the blocks for that user from `directory.mjs`. No dependencies |

Hub listens on `127.0.0.1` only. In `proxy-auth` mode Hub trusts the `Remote-User` header, so any caller that reaches Hub directly can act as any user.

## The extension interface

To add an extension, add a folder to `extensions/` and restart `start.sh`.

### Manifest: `extensions/<id>/extension.json`

```json
{
  "id": "team-services",
  "hubApi": 0,
  "name": "Team services",
  "description": "The services that your team owns",
  "provider": "Platform Engineering",
  "backend": { "url": "http://localhost:8091" },
  "routes": [{ "method": "GET", "path": "/screen", "scope": "authenticated", "readOnly": true }],
  "contributes": { "screen": { "title": "Team services", "route": "/screen" } }
}
```

| Field | Rule |
|---|---|
| `id` | Lower case letters, digits and `-`. Must equal the folder name |
| `hubApi` | Must be `0` |
| `name` | Required |
| `backend.url` | Absolute `http` or `https` URL. Hub never sends it to the browser |
| `routes[].scope` | `authenticated` (any signed-in user) or `global_admin` |
| `contributes.screen.route` | Must name a `GET` route in `routes` |

Hub stops at start up if a manifest breaks a rule. The log names the file and the rule.

### Identity: the `X-Calm-Hub-Identity` header

Hub calls `GET <backend.url><route>` with this header and `Accept: application/json` only. No header from the browser reaches the extension.

The header is an RS256 JWT:

| Claim | Value |
|---|---|
| `iss` | `calm-hub` (`calm.extensions.identity.issuer`) |
| `sub` | The user name |
| `aud` | The extension `id` |
| `exp` | 60 seconds after `iat` (`calm.extensions.identity.ttl-seconds`) |

The extension must check the signature, `iss`, `aud` and `exp`. Get the keys from `GET /api/calm/auth/jwks`, which needs no login. If a `kid` is unknown, get the keys again. `verifyIdentity` in `team-services/server.mjs` does this in less than 30 lines.

### Screen reply

Reply `200` with JSON:

```json
{ "hubApi": 0, "title": "Team services", "blocks": [ { "type": "markdown", "text": "Hello **alice**." } ] }
```

| Block | Fields |
|---|---|
| `markdown` | `text`: GitHub-flavoured markdown. Hub does not render raw HTML |
| `keyValue` | `items`: `[{ "label", "value" }]` |
| `stats` | `items`: `[{ "label", "value" }]` |
| `table` | `columns`: `["…"]`. `rows`: arrays of cells. A cell is text, a number, a badge or a link |
| `cards` | `items`: `[{ "title", "subtitle"?, "link"? }]` |
| `alert` | `text`, `tone`? |
| `links` | `items`: an array of links |

| Value | Format |
|---|---|
| Badge | `{ "badge": "Healthy", "tone": "positive" }` |
| Tone | `positive`, `negative`, `warning`, `info` or `neutral` |
| External link | `{ "label": "Runbook", "href": "https://…" }`. Only `http` and `https` |
| Hub link | `{ "label": "…", "hub": { "namespace", "type", "id", "version" } }`, for example type `architectures` |

Hub rejects a reply (and the screen shows "not available") when the status is not `200`, the body is not a JSON object with a `blocks` array, or the body is larger than 1 MiB. Hub does not follow redirects. In place of a block type that it does not know, Hub UI shows a short note.

## Hub configuration

| Key | Default | Use |
|---|---|---|
| `calm.extensions.dir` | not set | The folder with one subfolder for each extension. Not set means no extensions |
| `calm.extensions.identity.private-key-location` | not set | PKCS#8 PEM RSA key. Required when an extension is enabled |
| `calm.extensions.identity.issuer` | `calm-hub` | `iss` claim |
| `calm.extensions.identity.ttl-seconds` | `60` | Identity lifetime |
| `calm.extensions.http.connect-timeout` | `5` | Seconds |
| `calm.extensions.http.request-timeout` | `10` | Seconds |
| `calm.extensions.http.max-response-bytes` | `1048576` | Largest reply |

`start.sh` also sets `calm.auth.allow-public-read=true`, so that new users can read the seed data without grants.

## Troubleshooting

| Problem | Cause and fix |
|---|---|
| `seed.sh` or `start.sh`: no such file | You are in a checkout without the proof-of-concept branch. Use the worktree from [Get the code](#get-the-code) |
| `Build Hub first` | Run the build step in this worktree |
| Port already in use | Stop the other process. The ports are fixed in the scripts and the config files in this folder |
| 502 from nginx | Vite is not ready yet. Wait for `Ready`. If it stays, read `.generated/logs/vite.log` |
| The screen says "not available" | Read `.generated/logs/team-services.log` and `.generated/logs/hub.log` |
| Hub stops at start up with `Invalid extension manifest` | Fix the rule that the message names |
| No Extensions section or menu group | Hub loaded no screen extension. Search `hub.log` for `Loaded extensions` |
| Empty catalogue | Run `seed.sh` (Hub must be stopped first) |

Logs are in `.generated/logs/`. To start again from nothing, stop `start.sh`, delete `.generated/`, then run `seed.sh` and `start.sh`.
