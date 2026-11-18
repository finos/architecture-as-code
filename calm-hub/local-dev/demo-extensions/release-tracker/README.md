# release-tracker

A demo extension for local development. It uses every UI extension point: a screen, a landing card,
an action, a designer tab, a detail panel and a decorator view. Use it to check the CALM Hub UI
layout. `server.mjs` is its backend: it has no dependencies, and it uses the identity verifier of
[example-services](../../extensions/example-services/identity.mjs). The data is made up. The designer tab
route uses `{resourceType}/{resourceId}`, because CALM Hub refuses `%2F` in a path. Test the routes
with `node --test calm-hub/local-dev/demo-extensions/release-tracker/routes.test.mjs`.

It is not in `local-dev/extensions`, because it has routes: a Hub that loads it without its backend
URL does not start, and the UI then shows "CalmHub failed to load".

| Contribution | Where the UI shows it |
|---|---|
| `screen` | The Extensions group of the side menu, and the home page card |
| `landing-card` | The home page card: the first 3 figures of its `stats` block |
| `action`, `designer-tab` | The Extensions tab of an architecture or pattern |
| `detail-panel` | The Extensions section of the node details |
| `decorator-views` | Badges on the diagram for `release-risk` decorators |

Run it from `calm-hub/`, with the keys from the [example-services README](../../extensions/example-services/README.md):

```bash
../mvnw quarkus:dev -Pstandalone,server-only \
  -Dcalm.standalone.seed-demo-data=true \
  -Dcalm.extensions.dir=local-dev/demo-extensions \
  -Dcalm.extensions.release-tracker.backend-url=http://localhost:8092 \
  -Dcalm.extensions.identity.private-key-location=../sandbox/keys/hub-private.pem \
  -Dcalm.extensions.identity.public-key-locations=../sandbox/keys/hub-public.pem \
  -Dcalm.extensions.allow-without-auth=true

# In another shell
node local-dev/demo-extensions/release-tracker/server.mjs
```

`calm.standalone.seed-demo-data=true` adds the `demo` namespace and its architectures, which the screen
links. It seeds only a database with no namespaces: to start again, delete the data directory
(`~/.calm-hub/data` by default).

The detail panel has data for the nodes `web-app`, `api-gateway`, `user-service`, `order-service`,
`database` and `message-queue`. To see the overlay, add a decorator of type `release-risk` with
`data.risk` set to `low`, `medium` or `high`, and `data.summary` set to a short text.

Test the backend with `node --test local-dev/demo-extensions/release-tracker/server.test.mjs`, from
`calm-hub/`. Set `PORT` or `CALM_HUB_URL` (where the backend gets the JWKS) to change the defaults. The backend
accepts one issuer, by default `http://localhost:8080`. Set `CALM_HUB_ISSUER` to the `calm.hub.base-url` of your
Hub to change it.
