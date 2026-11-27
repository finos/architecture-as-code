# C4 extension of CALM Hub

The C4 lens on the **Diagram** tab of CALM Hub. It draws context, container, component and deployment
diagrams of an architecture, with the CALM C4 standard and the `c4-mapping` convention of the namespace.

It is also the worked example of a [diagram lens](../../docs/docs/calm-hub/extension-points.md#diagram-lens).
A lens of your own has the same three parts. No code of the extension runs in the browser: Hub draws the
graph that the service returns.

| Part | File | What it does |
|---|---|---|
| Manifest | [`extension.json`](extension.json) | Declares the `lens` route and the `diagram-lens` entry, with its `level` and `scope` parameters |
| Notation | [`notation.json`](notation.json) | The shapes, edge markers and styles of the diagrams. Hub checks it at start-up |
| Service | [`src/`](src) | Answers `POST /lens/{namespace}/{resourceType}/{resourceId}` with a graph reply (`src/lens.ts`). CALM Hub sends the architecture, its detailed architectures and the C4 mapping in the body (`hubData`), so the service never calls Hub for data |

## Decorators

Hub draws decorator badges on the C4 diagram from the `calm` ids of each element (see
[Decorator views](../../docs/docs/calm-hub/decorator-views.md#how-hub-draws-a-view)):

| C4 element | `calm` ids | Decorators that show on it |
|---|---|---|
| Person, software system, container, component | The CALM node | Those of the node, and of its `composed-of` and `deployed-in` relationships |
| System or container boundary, enterprise boundary, deployment node | The CALM node | The same, on the group |
| Relationship | Each CALM `connects` or `interacts` relationship that it merges or lifts, up to 32 | Those of each relationship. Hub draws a badge only when one of them is `error` or `warn` |
| Implicit software system | None | None. It is not a CALM node |

A node of a detailed architecture is not a node of the open architecture, so it has no `calm` id. Its
prefixed id can be the id of a node of the open architecture, such as `api/db`. The lens then leaves out
that id, so the node's decorators do not show on the detailed node. A decorated node that a level does not
draw, such as a container at context level, shows no badge on another element: Hub says that it is not
shown. An edge that merges or lifts more than 32 relationships names the first 32, so Hub counts a decorator of
another one as not shown too.

## Run it as a sidecar

The service runs next to Hub, on a private network. At start-up it copies `extension.json` and
`notation.json` to `CALM_C4_EXPORT_DIR/c4`. Mount that folder in Hub as `calm.extensions.dir`, so that
the manifest and the service are always the same version. Hub reads the folder only at start-up, so
start the sidecar first.

The `jvm` and `native` profiles of [`calm-hub/deploy/docker-compose.yml`](../../calm-hub/deploy/docker-compose.yml)
do this. Compose builds the image from source, from the repository root:

```shell
docker build -f calm-hub-extensions/c4/Dockerfile -t finos/calm-hub-c4 .
```

Hub needs these settings for the extension (see [Extensions](../../docs/docs/calm-hub/index.md#extensions)):

| Hub setting | Value |
|---|---|
| `calm.extensions.dir` | The shared folder |
| `calm.extensions.c4.backend-url` | The root URL of the sidecar, for example `http://c4:8093`. A path prefix in front of the service breaks every call |
| `calm.extensions.c4.allow-http` | `true` for a plain `http` sidecar on a private network |
| `calm.extensions.identity.*` | The key that signs the identity assertion |
| `calm.extensions.c4.send-identity` | `false` only for an open service (`CALM_OPEN_ACCESS=true`). Hub then needs no identity key for it |

## Settings

| Variable | Default | Use |
|---|---|---|
| `PORT` | `8093` | The port |
| `HOST` | `127.0.0.1` | The address. The image sets `0.0.0.0` |
| `CALM_HUB_URL` | `http://localhost:8080` | The sidecar Hub. The service reads its keys from `/api/calm/auth/jwks` |
| `CALM_HUB_ISSUER` | `CALM_HUB_URL` | The `calm.hub.base-url` of the sidecar Hub, which Hub signs as the issuer |
| `CALM_HUB_TENANTS_FILE` | not set | A JSON list of the Hubs that the service trusts, for a service that serves more than one Hub. It replaces `CALM_HUB_URL` and `CALM_HUB_ISSUER`. See below |
| `CALM_OPEN_ACCESS` | not set | `true` answers any caller, with no identity check. See below |
| `CALM_C4_MAPPING_HOSTS` | not set | The hosts, separated by commas, that a mapping `extends` URL can name outside Hub. They must use `https` |
| `CALM_C4_EXPORT_DIR` | not set | The folder to copy the extension files to |

Unless it is open, the service checks the identity assertion of each request, with the keys of the Hub that
signed it, and checks that `bdh` matches the body. So it trusts only data that a trusted Hub read for the user. It keeps
nothing, and logs only the caller, the path with its query, and the number of nodes.

## Serve more than one Hub

With `CALM_OPEN_ACCESS=true` the service answers any caller. It checks no assertion, because it has nothing
to protect: it keeps no data, and draws only the architecture in the request. Limit the request rate in
front of it. The FINOS-hosted service is meant to run this way.

To serve only some Hubs, for example for a paid service, list them in `CALM_HUB_TENANTS_FILE`. Each entry has the `issuer`, and its keys as
`jwks` or a `jwksUrl`:

```json
[{ "issuer": "https://calm-hub.example.com", "jwksUrl": "https://calm-hub.example.com/api/calm/auth/jwks" }]
```

The service picks the keys by `iss` and fetches only the configured URLs, so a request cannot make it call
another host. An operator of a Hub gets the extension folder from `GET /extension/extension.json` and
`GET /extension/notation.json`, which need no assertion. See
[Install an extension](../../docs/docs/extensions/install.md#use-a-hosted-service).

## Develop

From the repository root:

```shell
npm ci
npm run build --workspace calm-models
npm run lint --workspace calm-hub-extensions/c4
npm test --workspace calm-hub-extensions/c4
npm run build --workspace calm-hub-extensions/c4
```

The tests check each reply against the lens schema of Hub
(`calm-hub/src/main/resources/META-INF/calm-extensions/schema/0/lens.schema.json`).
