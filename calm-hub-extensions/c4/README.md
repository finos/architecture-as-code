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
| Service | [`src/`](src) | Answers `GET /lens/{namespace}/{resourceType}/{resourceId}` with a graph reply (`src/lens.ts`) |

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
| `calm.extensions.c4.backend-url` | The URL of the sidecar, for example `http://c4:8093` |
| `calm.extensions.c4.allow-http` | `true` for a plain `http` sidecar on a private network |
| `calm.extensions.identity.*` | The key that signs the identity assertion |

## Settings

| Variable | Default | Use |
|---|---|---|
| `PORT` | `8093` | The port |
| `HOST` | `127.0.0.1` | The address. The image sets `0.0.0.0` |
| `CALM_HUB_URL` | `http://localhost:8080` | The URL that the service reads Hub at |
| `CALM_HUB_ISSUER` | `CALM_HUB_URL` | The `calm.hub.base-url` of Hub, which Hub signs as the issuer |
| `CALM_HUB_TOKEN_URL` | not set | The OAuth 2.0 token endpoint of the service account. With none, the service calls Hub with no token, as a no-auth Hub needs |
| `CALM_HUB_CLIENT_ID`, `CALM_HUB_CLIENT_SECRET`, `CALM_HUB_SCOPE` | not set | The client credentials of the service account |
| `CALM_C4_MAPPING_HOSTS` | not set | The hosts, separated by commas, that a mapping `extends` URL can name outside Hub. They must use `https` |
| `CALM_C4_EXPORT_DIR` | not set | The folder to copy the extension files to |

The service checks the identity assertion of each request with the JWKS of Hub. Then it reads the
architecture and the C4 mapping with its own service account, never with the token of the user. Give
the account read access to the namespaces that the lens shows. The service reads only the namespace that
Hub checked for the user.

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
