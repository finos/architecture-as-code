# example-services

A fixture extension for local development. `server.mjs` is its backend: it has no dependencies, and
it answers only requests that carry a valid CALM Hub identity assertion. `identity.mjs` verifies the
assertion with the JWKS only.

Run it from `calm-hub/`:

```bash
mkdir -p ../sandbox/keys
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out ../sandbox/keys/hub-private.pem
openssl pkey -in ../sandbox/keys/hub-private.pem -pubout -out ../sandbox/keys/hub-public.pem

../mvnw quarkus:dev -Pstandalone,server-only \
  -Dcalm.extensions.dir=local-dev/extensions \
  -Dcalm.extensions.example-services.backend-url=http://localhost:8091 \
  -Dcalm.extensions.identity.private-key-location=../sandbox/keys/hub-private.pem \
  -Dcalm.extensions.identity.public-key-locations=../sandbox/keys/hub-public.pem \
  -Dcalm.extensions.allow-without-auth=true

# In another shell
node local-dev/extensions/example-services/server.mjs
curl http://localhost:8080/api/calm/extensions/example-services/api/namespaces/finos/services
```

The standalone profile has auth off, so `allow-without-auth` is needed and every caller is the
`no-auth` principal. Hub warns that `calm.hub.base-url` is not set: its default, `http://localhost:8080`, is the
issuer that `server.mjs` expects. Set `PORT`, `CALM_HUB_URL` or `CALM_HUB_ISSUER` to change the defaults.

Test the verifier and the backend with `node --test local-dev/extensions/example-services/*.test.mjs`.
