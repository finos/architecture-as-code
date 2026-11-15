---
id: install
title: Install an Extension
sidebar_label: Install an extension
---

# Install an Extension

Most extensions are a small service that you run next to CALM Hub, in your own network: a sidecar. Your
architectures stay in your organisation. CALM Hub calls the service, and the service reads only what the
user may see. The built-in extensions need no setup: an operator can turn one off with
`calm.extensions."<id>".enabled=false`.

Each sidecar extension follows the same steps. The examples use `c4`. For another extension, change the
id, the port and the variables on its page.

1. **Get the image.** No image is published yet. Build it from a clone of
   [finos/architecture-as-code](https://github.com/finos/architecture-as-code), from the repository root:

   ```shell
   docker build -f calm-hub-extensions/c4/Dockerfile \
     -t <your-registry>/calm-hub-c4:1.0.0 .
   ```

2. **Run it next to CALM Hub, on a private network.** At start-up the service copies its manifest and
   notation into the folder that `CALM_C4_EXPORT_DIR` names. Share that folder with CALM Hub, which reads
   it as `calm.extensions.dir`. CALM Hub reads the folder only when it starts, so start the extension first.
3. **Configure CALM Hub** with the folder, the URL of the service and the identity keys. See
   [Extensions](../calm-hub/index.md#extensions) for all settings, and [Identity keys](../calm-hub/index.md#identity-keys).
4. **With authentication on, give the service an account.** The service reads CALM Hub with its own
   OAuth 2.0 client (the client credentials grant), never with the token of the user. Give the account
   read access to the namespaces that the lens shows.

### Docker Compose

The `jvm` and `native` profiles of
[`calm-hub/deploy/docker-compose.yml`](https://github.com/finos/architecture-as-code/blob/main/calm-hub/deploy/docker-compose.yml)
run both sidecar extensions, and build their images from source. Copy the `c4` service, the
`calm-extensions` volume and the `calm.extensions` settings of CALM Hub from that file.

### Kubernetes

Run the extension as a native sidecar of the CALM Hub pod (Kubernetes 1.29 or later). Kubernetes starts it
before CALM Hub and waits for its start-up probe, so the folder is ready when CALM Hub reads it. CALM Hub
calls it on `localhost`, so it is not exposed, and `allow-http` is not needed.

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
        - { name: CALM_HUB_TOKEN_URL, value: https://idp.example.com/oauth2/token }
        - { name: CALM_HUB_CLIENT_ID, value: calm-hub-c4 }
        - name: CALM_HUB_CLIENT_SECRET
          valueFrom: { secretKeyRef: { name: calm-hub-c4, key: client-secret } }
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

