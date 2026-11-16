---
id: install
title: Install an Extension
sidebar_label: Install an extension
---

# Install an Extension

Most extensions are a small service that CALM Hub calls. CALM Hub reads the data that the extension needs,
with the scope of the user, and sends it in the call. The service needs no account in CALM Hub and no route
back to it. The built-in extensions need no setup: an operator can turn one off with
`calm.extensions."<id>".enabled=false`.

You can use an extension in two ways:

| | Use a hosted service | Run it yourself |
|:--|:--|:--|
| You run | Nothing but CALM Hub | The service, next to CALM Hub |
| Your architectures | Go to the provider in each call. The service keeps nothing | Stay in your network |
| Updates | The provider updates the service. You update the extension folder | You update the image |

FINOS does not host the FINOS extensions yet. Until it does, run them yourself.

## Use a hosted service

1. **Get the extension folder.** A service serves its manifest and notation, with no sign-in, at
   `<service>/extension/extension.json` and `<service>/extension/notation.json`. Put both files in
   `<calm.extensions.dir>/<id>/`.
2. **Configure CALM Hub** with the folder and `calm.extensions."<id>".backend-url` set to the service. For
   an open service, also set `calm.extensions."<id>".send-identity=false`: CALM Hub then needs no identity
   keys for it. A provider that registers Hubs needs the identity keys instead. See
   [Extensions](../calm-hub/index.md#extensions) and [Identity keys](../calm-hub/index.md#identity-keys).
   Restart CALM Hub.

   ```properties
   calm.extensions.dir=/extensions
   calm.extensions.c4.backend-url=https://<service>
   calm.extensions.c4.send-identity=false
   ```

   Set `backend-url` to the root of the service. The C4 and ea-layers services answer at `/lens/...` and
   `/extension/...`, and they check the path that CALM Hub signs against the path that they get. So a proxy
   that keeps a path prefix in front of the service, such as `https://example.com/c4/`, breaks every call.

When the provider changes its manifest or notation, download the folder again.

A provider that charges, or that limits who uses it, answers only the Hubs that it registered. Give it the
`calm.hub.base-url` of your CALM Hub, which CALM Hub signs as the issuer, and its public keys
(`GET /api/calm/auth/jwks`) or that URL.

## Run it yourself

Each extension that you run follows the same steps. The examples use `c4`. For another extension, change
the id, the port and the variables on its page.

1. **Get the image.** No image is published yet. Build it from a clone of
   [finos/architecture-as-code](https://github.com/finos/architecture-as-code), from the repository root:

   ```shell
   docker build -f calm-hub-extensions/c4/Dockerfile \
     -t <your-registry>/calm-hub-c4:1.0.0 .
   ```

2. **Run it next to CALM Hub, on a private network: a sidecar.** At start-up the service copies its
   manifest and notation into the folder that `CALM_C4_EXPORT_DIR` names. Share that folder with CALM Hub,
   which reads it as `calm.extensions.dir`. CALM Hub reads the folder only when it starts, so start the
   extension first. The sidecar reads the keys of CALM Hub from `CALM_HUB_URL`, and expects
   `CALM_HUB_ISSUER` as the issuer.
3. **Configure CALM Hub** with the folder, the URL of the service and the identity keys. See
   [Extensions](../calm-hub/index.md#extensions) for all settings, and [Identity keys](../calm-hub/index.md#identity-keys).

To serve any CALM Hub from one service, set `CALM_OPEN_ACCESS=true`. The service then checks no identity:
it keeps no data and draws only the architecture in the call, so an open service gives a caller nothing
but a drawing of its own data. Limit the request rate in front of it.

To serve only some CALM Hubs, list them in the file that `CALM_HUB_TENANTS_FILE` names:

```json
[
  { "issuer": "https://calm-hub.bank-a.example", "jwksUrl": "https://calm-hub.bank-a.example/api/calm/auth/jwks" },
  { "issuer": "https://calm-hub.bank-b.example", "jwks": { "keys": [ … ] } }
]
```

The service fetches keys only from the URLs in this file. With inline `jwks`, it never calls that CALM Hub.

### Docker Compose

The `jvm` and `native` profiles of
[`calm-hub/deploy/docker-compose.yml`](https://github.com/finos/architecture-as-code/blob/main/calm-hub/deploy/docker-compose.yml)
run both sidecar extensions, and build their images from source. Copy the `c4` service, the
`calm-extensions` volume and the `calm.extensions` settings of CALM Hub from that file.

### Kubernetes

Run the extension as a native sidecar of the CALM Hub pod (Kubernetes 1.29 or later). Kubernetes starts it
before CALM Hub and waits for its start-up probe, so the folder is ready when CALM Hub reads it. CALM Hub
calls it on `localhost`, so `allow-http` is not needed. Set `HOST=127.0.0.1` on the extension, so that other pods
cannot reach it.

```yaml
spec:
  volumes:
    - name: calm-extensions
      emptyDir: {}
  initContainers:
    - name: c4
      image: <your-registry>/calm-hub-c4:1.0.0
      restartPolicy: Always
      env:
        - { name: CALM_HUB_URL, value: http://localhost:8080 }
        # The calm.hub.base-url of CALM Hub
        - { name: CALM_HUB_ISSUER, value: https://calm-hub.example.com }
        - { name: CALM_C4_EXPORT_DIR, value: /extensions }
      startupProbe:
        httpGet: { path: /healthz, port: 8093 }
      volumeMounts:
        - { name: calm-extensions, mountPath: /extensions }
  containers:
    - name: calm-hub
      image: finos/calm-hub:latest
      env:
        - { name: CALM_EXTENSIONS_DIR, value: /extensions }
        - { name: CALM_EXTENSIONS__C4__BACKEND_URL, value: http://localhost:8093 }
        # Also set the identity keys from a Secret:
        # CALM_EXTENSIONS_IDENTITY_PRIVATE_KEY_LOCATION
        # CALM_EXTENSIONS_IDENTITY_PUBLIC_KEY_LOCATIONS
      volumeMounts:
        - { name: calm-extensions, mountPath: /extensions, readOnly: true }
```

