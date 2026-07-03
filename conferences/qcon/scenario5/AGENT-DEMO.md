# Agent Demo — Minikube Quick Start

Deploy the Trade Management platform on minikube and run the autonomous rebalancer agent via Docker.

## Prerequisites

- [minikube](https://minikube.sigs.k8s.io/docs/start/) installed
- [kubectl](https://kubernetes.io/docs/tasks/tools/) installed
- [Docker](https://www.docker.com/products/docker-desktop/) installed and running

## 1. Start Minikube

```bash
minikube start
```

Verify the cluster is running:

```bash
kubectl cluster-info
```

## 2. Pull and Load Images into Minikube

The Kubernetes manifests use `imagePullPolicy: Never`, so the platform images must be pulled from Docker Hub and loaded into minikube manually.

```bash
docker pull jpgough/trades-rest-server:latest
docker pull jpgough/trades-a2a-server:latest

minikube image load jpgough/trades-rest-server:latest
minikube image load jpgough/trades-a2a-server:latest
```

## 3. Deploy to Minikube

```bash
kubectl apply -k kubernetes/
```

Wait for pods to be ready:

```bash
kubectl get pods -w
```

You should see:

| Pod | Description |
|-----|-------------|
| `trades-*` | REST API — trade CRUD operations |
| `trades-a2a-server-*` | A2A server — agent-to-agent communication |

## 4. Port Forwarding

The services are `ClusterIP`-only. Open a separate terminal for the A2A port-forward:

```bash
kubectl port-forward svc/trades-a2a-server 9103:80
```

### Verify

- Agent Card: http://localhost:9103/.well-known/agent.json

## 5. Run the Rebalancer Agent

The rebalancer agent runs as a Docker container and connects to the A2A server via the port-forward. It continuously monitors the portfolio in an **OBSERVE → DECIDE → ACT** loop (every 8 seconds).

```bash
docker run --rm \
  -e A2A_URL=http://host.docker.internal:9103 \
  jpgough/rebalancer-agent:latest rebalancer
```

> **Note:** `host.docker.internal` resolves to the host machine from inside Docker on macOS and Windows. On Linux, use `--network host` and set `A2A_URL=http://localhost:9103` instead.

To run in the background:

```bash
docker run -d \
  --name rebalancer-agent \
  -e A2A_URL=http://host.docker.internal:9103 \
  jpgough/rebalancer-agent:latest rebalancer

# View logs
docker logs -f rebalancer-agent

# Stop
docker rm -f rebalancer-agent
```

## 6. Run the Flood (Imbalance Injector)

The flood command books a burst of trades to create a portfolio imbalance that the rebalancer agent will then correct.

```bash
docker run --rm \
  -e A2A_URL=http://host.docker.internal:9103 \
  jpgough/rebalancer-agent:latest flood NVDA 20 5000
```

This books 20 trades of 5,000 NVDA shares each (100k total), creating an imbalance that the rebalancer agent will detect and correct.

### Arguments

| Argument | Position | Default | Description |
|----------|----------|---------|-------------|
| `INSTRUMENT` | 1 | `NVDA` | Instrument to flood |
| `COUNT` | 2 | `20` | Number of trades to book |
| `QTY` | 3 | `5000` | Shares per trade |

### Example — Flood 100k NVDA shares

```bash
docker run --rm \
  -e A2A_URL=http://host.docker.internal:9103 \
  jpgough/rebalancer-agent:latest flood NVDA 20 5000
```

## 7. Start the Agent UI

The UI runs as a Docker container and provides a web interface to interact with the A2A server.

```bash
docker run -d \
  --name qcon-agent-ui \
  -p 3000:80 \
  -e A2A_URL=http://host.docker.internal:9103 \
  jpgough/qcon-agent-ui:latest
```

Open http://localhost:3000 and click **Connect**.

### Stop the UI

```bash
docker rm -f qcon-agent-ui
```

## Resetting Demo Data

Restart the trades pod to reset all trade data:

```bash
kubectl rollout restart deploy/trades
```

Wait ~15 seconds for the pod to become ready before re-running the agent.

## Teardown

```bash
docker rm -f rebalancer-agent qcon-agent-ui
kubectl delete -k kubernetes/
minikube stop
```
