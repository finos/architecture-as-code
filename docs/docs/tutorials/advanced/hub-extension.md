---
id: hub-extension
title: "Build and Install a CALM Hub Extension"
sidebar_position: 2
---

# Build and Install a CALM Hub Extension

🔴 **Difficulty:** Advanced | ⏱️ **Time:** ~45 minutes

## Overview

A CALM Hub extension adds features to CALM Hub without a fork. It is an HTTP service that you
write. CALM Hub calls it, and draws its replies in the Hub UI, the CLI and MCP. No extension code
runs in the browser.

This tutorial uses the **release-tracker** demo in
[`calm-hub/local-dev/demo-extensions/release-tracker`](https://github.com/finos/architecture-as-code/tree/main/calm-hub/local-dev/demo-extensions/release-tracker).
It uses each UI extension point and one command:

| Part | What you see |
|---|---|
| `screen` | A **Releases** page in the **Extensions** group of the side menu |
| `landing-card` | A **Release tracker** card on the home page |
| `designer-tab`, `action` | The **Extensions** tab of an architecture |
| `detail-panel` | The **Extensions** section of the node details |
| `decorator-views` | **Release risk** badges on the diagram |
| `commands` | `calm hub ext release-tracker list-releases`, and the MCP tool `ext_release-tracker_list-releases` |

For the fields of each part, see the [extension point reference](../../calm-hub/extension-points.md).

## Prerequisites

- A clone of `finos/architecture-as-code`, with `npm ci` done at the root
- Node.js 26 (see `.nvmrc`) and JDK 21
- `openssl` and `curl`
- Docker, only for the [Docker option](#with-docker) of step 4
- The CALM CLI, built from the clone: `npm run build:cli`. This tutorial runs it as
  `node cli/dist/index.js`. If you use `npm run link:cli`, type `calm` instead

Run the commands from `calm-hub/`, unless the step says otherwise.

## Step 1: Write the Manifest

The manifest, `extension.json`, tells CALM Hub what the extension has. CALM Hub reads it one time,
at start-up. The folder name must equal the `id`.

```json
{
  "id": "release-tracker",
  "version": "0.1.0",
  "hubApi": 0,
  "name": "Release tracker",
  "provider": "Demo",
  "routes": [
    { "id": "screen", "method": "GET", "path": "/screen", "scope": "authenticated", "readOnly": true },
    { "id": "card", "method": "GET", "path": "/card", "scope": "authenticated", "readOnly": true },
    { "id": "releases", "method": "GET", "path": "/releases", "scope": "authenticated", "readOnly": true }
  ],
  "commands": {
    "list-releases": {
      "route": "releases",
      "description": "List recent releases and their status",
      "input": { "type": "object", "properties": {} }
    }
  },
  "contributes": {
    "screen": [{ "id": "releases", "title": "Releases", "route": "screen" }],
    "landing-card": [{ "id": "releases", "title": "Release health", "route": "card" }]
  }
}
```

This is a part of the demo manifest. The full file also declares the designer tab, detail panel,
action and decorator view. The designer tab route is `/tab/{resourceType}/{resourceId}`: a path
parameter cannot contain a slash, so the route cannot use `{resource}` (`architectures/1`).

| Field | Purpose |
|---|---|
| `routes` | Every call that CALM Hub can send to the backend. CALM Hub refuses all other paths. `scope` is the permission that the caller must have. When two routes match a path, the route with more literal segments wins. CALM Hub does not start if they have the same number |
| `commands` | Commands for the CLI and MCP. Each names a route |
| `contributes` | What the Hub UI shows. Each entry names a route, except `decorator-views` |
| `readOnly` | `true` when the route changes nothing. CALM Hub does not audit it, and a read-only Hub still allows it. A `GET` route must change nothing in any case: see [Write the routes](../../calm-hub/extension-access.md#write-the-routes) |

CALM Hub does not start if the manifest is not valid. The error names the file and the field.

## Step 2: Write the Backend

The backend is a plain HTTP server. For each UI route, it returns **blocks**: JSON that the Hub UI
draws. For example, the landing card route returns:

```json
{
  "hubApi": 0,
  "title": "Release health",
  "blocks": [
    { "type": "stats", "items": [{ "label": "In flight", "value": 1 }, { "label": "Rolled back (30 days)", "value": 1 }] }
  ]
}
```

A command route can return any JSON. See the [blocks reference](../../calm-hub/extension-blocks.md).

### Verify the identity assertion

CALM Hub never sends the caller's token or cookies to the backend. It sends a short-lived JWT in
the `X-Calm-Hub-Identity` header, signed with its own key. The backend must refuse each request
that does not have a valid assertion, because a caller that can reach the backend directly can
send any request.

The demo uses
[`identity.mjs`](https://github.com/finos/architecture-as-code/blob/main/calm-hub/local-dev/extensions/example-services/identity.mjs),
which has no dependencies. It needs only the public JWKS of CALM Hub:

```js
import { createVerifier } from '../../extensions/example-services/identity.mjs';

const verifyAssertion = createVerifier({
    issuer: 'http://localhost:8080',      // calm.hub.base-url
    audience: 'release-tracker',          // your extension id
    fetchJwks: async () => (await fetch('http://localhost:8080/api/calm/auth/jwks')).json(),
});

// For each request. pathAndQuery is relative to the backend URL: req.url only when the
// backend URL has no path. body is the raw request body, read before the check.
const claims = await verifyAssertion(req.headers['x-calm-hub-identity'],
    { method: req.method, pathAndQuery: req.url, body });
// claims.sub is the user. If this throws, reply 401.
```

| Check | Why |
|---|---|
| `typ` is `calm-ext+jwt` | Refuses other JWTs that the same key could sign |
| `alg` is `RS256` or `ES256`, and equals the `alg` of the key with that `kid` | Stops an attacker who changes the algorithm, for example to `none` or `HS256` |
| Load the JWKS again for an unknown `kid` | Accepts a new key after the operator rotates it |
| The signature | Proves that CALM Hub made the assertion |
| `iss` is the CALM Hub base URL | Refuses assertions from another Hub |
| `aud` is your extension id | Refuses an assertion that CALM Hub made for another extension |
| `exp` is not past, `iat` is not in the future | Limits the time that a stolen assertion is useful |
| `htm` and `htp` equal the method, path and query that you received, relative to the backend URL | Binds the assertion to this request, so that nobody can use it for another route |
| `bdh` is the SHA-256 of the body, and is absent with no body | Stops a change to the body of a request |
| Each `jti` is used one time | Stops a replay of the same request |

`identity.mjs` allows 30 seconds of clock skew. For the other claims, see
[Extension access](../../calm-hub/extension-access.md#the-identity-assertion).

## Step 3: Create the Signing Keys

CALM Hub needs a key pair to sign the assertions. Keep the keys out of the repository: the
`sandbox/` folder is in `.gitignore`.

```bash
mkdir -p ../sandbox/keys
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out ../sandbox/keys/hub-private.pem
openssl pkey -in ../sandbox/keys/hub-private.pem -pubout -out ../sandbox/keys/hub-public.pem
```

CALM Hub accepts a P-256 key (ES256) or an RSA key of 2048 bits or more (RS256). It refuses a shared
secret.

## Step 4: Configure CALM Hub

CALM Hub needs five settings for this extension:

| Setting | Value |
|---|---|
| `calm.extensions.dir` | The folder that holds one folder for each extension |
| `calm.extensions."release-tracker".backend-url` | The base URL of the backend |
| `calm.extensions.identity.private-key-location` | The private key from step 3 |
| `calm.extensions.identity.public-key-locations` | The public key from step 3 |
| `calm.extensions.allow-without-auth` | `true`, for local development only. See below |

CALM Hub loads every manifest in `calm.extensions.dir`, and does not start if an enabled extension
has routes but no backend URL. If you add another extension to the folder, give it a backend URL, or
turn it off with `calm.extensions."<id>".enabled=false`.

The standalone profile has authentication off. CALM Hub then refuses to start with an extension
that has routes, because every caller would be a global admin. For local development only, set
`calm.extensions.allow-without-auth=true`. In production, turn authentication on instead.

### With system properties

```bash
../mvnw quarkus:dev -Pstandalone,server-only \
  -Dcalm.extensions.dir=local-dev/demo-extensions \
  -Dcalm.extensions.release-tracker.backend-url=http://localhost:8092 \
  -Dcalm.extensions.identity.private-key-location=../sandbox/keys/hub-private.pem \
  -Dcalm.extensions.identity.public-key-locations=../sandbox/keys/hub-public.pem \
  -Dcalm.extensions.allow-without-auth=true \
  -Dcalm.mcp.enabled=true
```

`calm.mcp.enabled` is for step 7. When CALM Hub is ready, the log shows
`Enabled extensions: [control-evaluation, deployment, release-tracker]`. The first two are
built-in decorator views.

### With environment variables

Each setting is also an environment variable. In the name, the quotes, the dots and each `-` become `_`, and the letters become capitals:

```bash
export CALM_EXTENSIONS_DIR=local-dev/demo-extensions
export CALM_EXTENSIONS__RELEASE_TRACKER__BACKEND_URL=http://localhost:8092
export CALM_EXTENSIONS_IDENTITY_PRIVATE_KEY_LOCATION=../sandbox/keys/hub-private.pem
export CALM_EXTENSIONS_IDENTITY_PUBLIC_KEY_LOCATIONS=../sandbox/keys/hub-public.pem
export CALM_EXTENSIONS_ALLOW_WITHOUT_AUTH=true
export CALM_MCP_ENABLED=true
../mvnw quarkus:dev -Pstandalone,server-only
```

In `application.properties`, quote the extension id: `calm.extensions."release-tracker".backend-url=...`.

### With Docker

The published `finos/calm-hub:latest-read-only-static` image has no extensions until a build that
includes them is published. Until then, build the image from your checkout. The script runs the
Maven build and the unit tests first, so it takes some minutes:

```bash
bash build-readonly-image.sh
```

The image runs as user `185`, so that user must be able to read the keys. `openssl genpkey` writes
the private key with mode `600`, and CALM Hub then stops at start with `Cannot read the key file`.
With a strict umask such as `077`, the folder and the public key are closed to other users too.
For local development only, let all users read the folder and the keys:

```bash
chmod 755 ../sandbox/keys
chmod 644 ../sandbox/keys/hub-private.pem ../sandbox/keys/hub-public.pem
```

Do not do this in production: give the key to user `185`, for example with a secret mount.

Give the container the same environment variables, and mount the manifests and the keys. This
example uses the host network (Linux only), so that the container and the backend reach each other
on `localhost`:

```bash
docker run --rm --network host \
  -v "$PWD/local-dev/demo-extensions:/extensions:ro" \
  -v "$PWD/../sandbox/keys:/keys:ro" \
  -e CALM_EXTENSIONS_DIR=/extensions \
  -e CALM_EXTENSIONS__RELEASE_TRACKER__BACKEND_URL=http://localhost:8092 \
  -e CALM_EXTENSIONS_IDENTITY_PRIVATE_KEY_LOCATION=/keys/hub-private.pem \
  -e CALM_EXTENSIONS_IDENTITY_PUBLIC_KEY_LOCATIONS=/keys/hub-public.pem \
  -e CALM_EXTENSIONS_ALLOW_WITHOUT_AUTH=true \
  calm-hub:read-only-static
```

The read-only images sign `iss` with `https://hub.calm.finos.org`, so start the backend with
`CALM_HUB_ISSUER=https://hub.calm.finos.org`. A read-only Hub leaves out the routes that change
data and are not `readOnly`, so the **Request release review** action does not show, and a direct
`POST` to its route gets `405`. If the backend
is on another host, use `https`, or set `calm.extensions."<id>".allow-http=true` for a trusted
internal network.

## Step 5: Start the Backend and Test It

In another shell, from `calm-hub/`:

```bash
node local-dev/demo-extensions/release-tracker/server.mjs
```

Call a route through CALM Hub, and then call the backend directly:

```bash
curl http://localhost:8080/api/calm/extensions/release-tracker/api/card
# {"hubApi":0,"title":"Release health","blocks":[{"type":"stats",...

curl -i http://localhost:8092/card
# HTTP/1.1 401 Unauthorized: there is no assertion
```

## Step 6: See Each Contribution in the Hub UI

The `server-only` profile does not build the UI. Start the UI dev server from the repository root:
`npm start --workspace calm-hub-ui`. It opens on `http://localhost:5173` and sends API calls to
CALM Hub on port 8080.

The designer tab, detail panel and decorator view need an architecture. Create a namespace, an
architecture and a `release-risk` decorator. This needs a Hub that you can write to, so it does
not work on a read-only image:

```bash
curl -X POST http://localhost:8080/api/calm/namespaces \
  -H 'Content-Type: application/json' -d '{"name":"demo","description":"Demo"}'

curl -X POST http://localhost:8080/api/calm/namespaces/demo/architectures \
  -H 'Content-Type: application/json' \
  -d '{"name":"shop","description":"Demo shop","architectureJson":"{\"nodes\":[{\"unique-id\":\"web-app\",\"node-type\":\"webclient\",\"name\":\"Web app\",\"description\":\"Web app\"},{\"unique-id\":\"order-service\",\"node-type\":\"service\",\"name\":\"Order service\",\"description\":\"Orders\"}],\"relationships\":[]}"}'
# Location: .../namespaces/demo/architectures/1/versions/1.0.0

curl -X POST http://localhost:8080/api/calm/namespaces/demo/decorators \
  -H 'Content-Type: application/json' \
  -d '{"unique-id":"risk-order-service","type":"release-risk","target":["/api/calm/namespaces/demo/architectures/1/versions/1-0-0"],"target-type":["architecture"],"applies-to":["order-service"],"data":{"risk":"high","summary":"2.4.0 is rolling out"}}'
```

The decorator `target` writes the version with `-`, not `.`. Do not send `creationDateTime` or
`updateDateTime`: CALM Hub sets them, and refuses a decorator that has them with `400`.

| Where | What you see |
|---|---|
| Home page | The **Release tracker** card with two figures. Click it to open the screen |
| Side menu, **Extensions** | **Releases**: an alert, figures, a table of releases, text and links |
| Architecture `demo` / `1`, **Extensions** tab | A **Release tracker** section with the **Request release review** button and the **Releases** tab content. The button asks you to confirm, because its route is not `readOnly` |
| Click the `order-service` node | The **Extensions** section of the node details, with the owner, last release and risk |
| Diagram | A red **High** badge on `order-service`, and a **Release risk · Release tracker** row in the legend |

The backend log shows each call, for example
`GET /tab/architectures/1?namespace=demo&resource=architectures%2F1&resourceId=1&resourceType=architectures&version=1.0.0 for no-auth: 200`.
CALM Hub sorts the query parameters by name.

## Step 7: Run the Command

From the repository root, list the extensions, describe the command, and run it:

```bash
node cli/dist/index.js hub extensions list -c http://localhost:8080 -f pretty
node cli/dist/index.js hub extensions describe release-tracker list-releases -c http://localhost:8080
node cli/dist/index.js hub ext release-tracker list-releases -c http://localhost:8080
# Prints the releases as indented JSON
```

With `calm.mcp.enabled=true`, the same command is the MCP tool `ext_release-tracker_list-releases`.
Connect an MCP client to `http://localhost:8080/mcp`, or call it with `curl`:

```bash
curl -s -X POST http://localhost:8080/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"ext_release-tracker_list-releases","arguments":{}}}'
```

The reply has the result as text and as `structuredContent`. Extension tools come after the
built-in tools in `tools/list`, so a client sees them on a later page.

## Next Steps

- Write your own manifest with the [extension point reference](../../calm-hub/extension-points.md)
- Show decorators from your own tools with [decorator views](../../calm-hub/decorator-views.md), with no backend
- Read [Extension access](../../calm-hub/extension-access.md) before you run an extension in production
- See all settings in [CALM Hub Extensions](../../calm-hub/index.md#extensions)
