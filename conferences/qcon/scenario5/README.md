# Scenario 5: Rapid Platform Adoption — Agent-to-Agent (A2A)

Demonstrates the **Agent-to-Agent (A2A) protocol**: an autonomous rebalancer agent that observes portfolio state, makes decisions, and corrects imbalances without human intervention.

## Run the Demo

```bash
./demo.sh
```

The script handles the full lifecycle — generation, deployment, port-forwarding, UI startup, and agent coordination.

## What the Demo Shows

1. **Verifies** the Minikube cluster (reuses the `secure` profile from Scenario 1)
2. **Generates** Kubernetes manifests from the CALM architecture using `calm template`
3. **Deploys** all services and waits for pods to be ready
4. **Starts port-forwarding** for the A2A server — required for agent communication
5. **Launches the QCon Agent UI** (`jpgough/qcon-agent-ui`) on http://localhost:3000
6. **Floods** the portfolio with trades (`run-flood.sh`)
7. **Starts the rebalancer agent** (`run-rebalancer.sh`) — watch it detect and correct imbalances in the OBSERVE → DECIDE → ACT loop

## Services

| Service | Port | Description |
|---------|------|-------------|
| MCP Server | :8080 | LLM-facing tool interface |
| Trades API | :8081 | REST API for trade CRUD (debug) |
| A2A Server | :9103 | Agent-to-agent coordination |
| Agent UI | :3000 | Web UI for exploring tools |

## Port Forwarding

The A2A port-forward is **required** and started by the demo automatically. To run manually:

```bash
# Required — A2A server:
./port-forward-a2a.sh

# Optional — Trades API debug access:
kubectl port-forward svc/trades 8081:80 --namespace default
```

## Agent UI

The UI runs as a Docker container outside Minikube:

```bash
docker run -d \
  --name qcon-agent-ui \
  -p 3000:80 \
  -e A2A_URL=http://host.docker.internal:9103 \
  jpgough/qcon-agent-ui:latest
```

Open http://localhost:3000 and click **Connect**.

> **Note:** `host.docker.internal` resolves to your host on macOS/Windows. On Linux, use `--network host` with `A2A_URL=http://localhost:9103`.

## Cleanup

```bash
# Stop Agent UI
docker rm -f qcon-agent-ui

# Stop cluster
minikube stop --profile secure
minikube delete --profile secure
```
