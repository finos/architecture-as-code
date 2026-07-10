# CALM Hub — EC2 deployment

Runs [`finos/calm-hub:latest-read-only-native`](https://hub.docker.com/r/finos/calm-hub) — the
self-contained CALM Hub image (NitriteDB baked in, no external database, no auth) — on a single
EC2 host, auto-updated by [Watchtower](https://github.com/nickfedor/watchtower) whenever a new
image is published to Docker Hub.

Uses the [`nickfedor/watchtower`](https://hub.docker.com/r/nickfedor/watchtower) image — the
actively maintained continuation of the original `containrrr/watchtower` project, which was
archived in December 2025. The original image's frozen Docker client can no longer talk to
current Docker daemons (it negotiates down to an API version below the daemon's minimum), so do
not switch back to `containrrr/watchtower`.

This folder supersedes the previous on-box `setup.sh` / `restart.sh` scripts, which lived only on
the instance and had to be run by hand.

## Quick start (fresh EC2 box)

SSH into the box as `ec2-user`, then:

```bash
# 1. Install git (Amazon Linux 2023 uses yum/dnf, not apt)
sudo yum install -y git

# 2. Shallow-clone the monorepo (we only need calm-hub/ec2)
git clone --depth 1 https://github.com/finos/architecture-as-code.git
cd architecture-as-code/calm-hub/ec2

# 3. Bootstrap Docker + Compose and start the stack
chmod +x install.sh
./install.sh

# 4. Verify
curl -fsS http://localhost/q/swagger-ui >/dev/null && echo "CALM Hub is up"
sudo docker compose ps
```

`install.sh` is idempotent — re-run it any time (e.g. after a reboot) and it will skip steps that
are already done.

### Lighter checkout (optional)

If you'd rather not pull the whole monorepo history, use a sparse checkout instead of step 2 above:

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/finos/architecture-as-code.git
cd architecture-as-code
git sparse-checkout set calm-hub/ec2
cd calm-hub/ec2
```

## How auto-update works

`docker-compose.yml` runs two containers:

- **`calm-hub`** — the app, bound to host port 80. Labelled
  `com.centurylinklabs.watchtower.enable=true`.
- **`watchtower`** — polls Docker Hub every `WATCHTOWER_POLL_INTERVAL` seconds (default 120s,
  i.e. 2 min) for a newer digest of the running image. When it finds one, it pulls the new image,
  stops the old `calm-hub` container, and recreates it with the same config (port, labels, restart
  policy). `--cleanup` removes the superseded image afterwards.
- `--label-enable` scopes Watchtower to *only* the labelled container — it will never touch
  anything else you later add to this box.

**Security note:** Watchtower is granted the Docker socket (`/var/run/docker.sock`), which is
root-equivalent control of the host — anything with access to that socket can run, inspect, or
remove any container, mount the host filesystem, and effectively escalate to root. `--label-enable`
limits *which containers Watchtower will act on*, not what the socket itself grants; it does not
sandbox Watchtower's own privileges. Only deploy this stack on a dedicated, otherwise-locked-down
box — don't run other untrusted workloads alongside it.

**This swap is not zero-downtime.** The old container stops before the new one starts, causing a
brief (<1s) gap in availability. Maintainers have accepted this tradeoff rather than adding a
reverse proxy for blue-green swaps.

There is no `/q/health` endpoint in calm-hub (no `smallrye-health` dependency), and the
`read-only-native` image is distroless (no shell/curl inside the container), so readiness is
always probed from the host against `/q/swagger-ui`, which is always enabled and comes up as soon
as Quarkus finishes booting.

## Pinning / rolling back a version

Every CI run of
[`docker-publish-calm-hub-readonly-native.yml`](../../.github/workflows/docker-publish-calm-hub-readonly-native.yml)
publishes both `latest-read-only-native` and an immutable `sha-<short>-read-only-native` tag. To
pin to a specific known-good build (or roll back a bad one):

```bash
cp .env.example .env   # first time only
sed -i 's|^CALM_HUB_IMAGE=.*|CALM_HUB_IMAGE=finos/calm-hub:sha-1a2b3c4-read-only-native|' .env
sudo docker compose up -d
```

(Edit the existing `CALM_HUB_IMAGE` line rather than appending a new one — `.env.example` already
defines it, so `echo ... >> .env` would leave two conflicting lines in the file.)

A pinned sha tag never changes upstream, so Watchtower has nothing new to pull and effectively
stops auto-updating `calm-hub` until you set `CALM_HUB_IMAGE` back to `latest-read-only-native` in
`.env` (or delete `.env` to use the default).

## Notifications (optional)

Watchtower supports [shoutrrr](https://shoutrrr.dev/) notification URLs (Slack, email,
webhooks, etc.) via the `WATCHTOWER_NOTIFICATIONS` / `WATCHTOWER_NOTIFICATION_URL` environment
variables. Not configured by default — the intent here is plain hands-off auto-deploy. Add them to
the `watchtower` service's `environment:` in `docker-compose.yml` if you want a record of each
update.

## Operations

```bash
# Container status
sudo docker compose ps

# App logs
sudo docker logs -f calm-hub

# Watchtower logs (shows poll activity and any updates it performs)
sudo docker logs -f watchtower

# Force an immediate redeploy (pull + recreate), rather than waiting for the next poll
./redeploy.sh

# Pick up a change to docker-compose.yml / .env / this repo checkout
git pull
sudo docker compose up -d

# Stop everything
sudo docker compose down
```

## Assumptions

- TLS is terminated upstream (ALB / CloudFront / Cloudflare, etc.) — this stack serves plain HTTP
  on port 80. There is no TLS termination on the box itself.
- The `latest-read-only-native` image is self-contained: no external database or auth provider is
  required.
