# CALM Hub on AKS with Entra ID

Deploys the JVM image (`finos/calm-hub:latest`) into namespace `calm-hub`.
TLS ends at the AKS Application Routing ingress. The pod uses the Quarkus `oidc` profile and checks Entra ID tokens.

MongoDB is not part of the default apply. Use Cosmos DB for MongoDB (vCore), Atlas, or `mongodb/` on the cluster.

## Authentication and authorization

| Layer | What decides | Where it is set |
| --- | --- | --- |
| Sign-in | Entra ID app assignment | Enterprise application, Assignment required |
| API identity | `oid` claim of the ID token | `CALM_OIDC_USERNAME_CLAIM` |
| What the user may do | CALM Hub `userAccess` grant for that object id | Hub admin API, or `bootstrap/` for the first GLOBAL admin |

The UI sends the **ID token**, not the access token. The access token audience is Microsoft Graph. Quarkus checks the ID token signature, issuer, and audience (the app client id).

Hub usernames must match `^[A-Za-z0-9._-]+$`. An Entra UPN (`user@tenant`) contains `@`, so it cannot be stored as a grant. The object id (`oid`) is stable and matches the pattern. The UI still shows the display name from the token.

Hub does not read Entra app roles or group claims. Assign people in Entra so they can sign in. Grant `read`, `write`, or `admin` in Hub against their object id.

## Before apply

1. Enable Application Routing on the cluster:

   ```bash
   az aks approuting enable --resource-group <rg> --name <cluster>
   ```

2. Register an Entra app (single tenant):

   | Setting | Value |
   | --- | --- |
   | Platform | Single-page application |
   | Redirect URI | `https://<host>/` |
   | Front-channel logout URL | `https://<host>/` |
   | Extra redirect URI (VS Code plugin) | `https://<host>/api/calm/auth/plugin-callback` |
   | Implicit grant | Leave unchecked (auth code + PKCE) |
   | Assignment required | Yes |
   | API permissions | `openid`, `profile`, `email` only |

   Do not add a client secret. The registration is a public SPA. Do not request a custom API scope; the Hub validates the ID token.

3. Edit `configmap.yaml`: tenant id, client id, and `CALM_HUB_BASE_URL`.
4. Edit `ingress.yaml`: the same host in `rules` and `tls`.
5. Point DNS at the Application Routing public IP.
6. Create the TLS secret `calm-hub-tls`, or uncomment the Key Vault annotation on the Ingress and remove `spec.tls`.

## Secrets

```bash
kubectl create namespace calm-hub
kubectl -n calm-hub create secret generic calm-hub-mongo \
  --from-literal=connection-string='mongodb://USER:PASSWORD@HOST:27017/calmSchemas?authSource=admin'
```

Cosmos DB vCore example (TLS, standard Mongo indexes):

```text
mongodb+srv://USER:PASSWORD@<account>.mongocluster.cosmos.azure.com/calmSchemas?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false
```

The database name in the URI is `calmSchemas`. The Hub creates its indexes on startup. Cosmos DB for MongoDB (RU) rejects some of those indexes; use vCore, Atlas, or the in-cluster StatefulSet.

## Apply

```bash
kubectl apply -k calm-hub/deploy/azure
kubectl -n calm-hub rollout status deploy/calm-hub
```

Change the image tag in `kustomization.yaml` (`images.newTag`). `latest` is pulled on every new pod.

## First GLOBAL admin

Nobody can create grants until one GLOBAL admin exists. Insert it once, using the Entra object id (`az ad signed-in-user show --query id -o tsv`, or the user blade in the portal):

```bash
kubectl -n calm-hub create secret generic calm-hub-bootstrap \
  --from-literal=username='<entra-object-id>'
kubectl apply -k calm-hub/deploy/azure/bootstrap
kubectl -n calm-hub wait --for=condition=complete job/calm-hub-bootstrap-admin
```

Sign in at `https://<host>/`. Further grants use the same object id as `username`.

## In-cluster MongoDB

Lab only. Create `mongodb-auth` before the StatefulSet. `MONGO_INITDB_*` runs only on an empty volume.

```bash
kubectl -n calm-hub create secret generic mongodb-auth \
  --from-literal=root-password='REPLACE_PASSWORD'
kubectl -n calm-hub create secret generic calm-hub-mongo \
  --from-literal=connection-string='mongodb://calmhub:REPLACE_PASSWORD@mongodb.calm-hub.svc.cluster.local:27017/calmSchemas?authSource=admin'
kubectl apply -k calm-hub/deploy/azure/mongodb
kubectl apply -k calm-hub/deploy/azure
```

## Checks

- `GET /api/calm/auth/config` is anonymous and returns `provider: entra-id`.
- `GET /api/calm/namespaces` without a bearer token returns 401.
- The same call with the signed-in user's ID token returns 200 after the GLOBAL admin grant exists.
- Pods must reach `https://login.microsoftonline.com` on port 443 for discovery and JWKS.
