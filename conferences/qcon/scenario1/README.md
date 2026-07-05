# Scenario 1: Deploy API & MCP Architecture

Deploys the Trades REST API, MCP server, and A2A server onto a secure Minikube cluster with Calico network policies.

## Run the Demo

```bash
./demo.sh
```

The script will:
1. Start Minikube with the `secure` profile and Calico CNI
2. Load Docker images (`jpgough/trades-rest-server`, `jpgough/trades-mcp-server`, `jpgough/trades-a2a-server`) into Minikube
3. Generate Kubernetes manifests from `calm/trades-api-and-mcp.architecture.json` using `calm template`
4. Deploy all services and apply Kubernetes network policies
5. Wait for pods to become ready
6. Prompt you to start port-forwarding

## Port Forwarding

After the demo completes, run in a **separate terminal** from this directory:

```bash
./port-forward.sh
```

This makes all services available locally:

| Service | URL |
|---------|-----|
| MCP Server | http://localhost:8080 |
| Trades API | http://localhost:8081 |
| A2A Server | http://localhost:9103 |

Keep this terminal running throughout Scenarios 1 and 2.

## Connecting Claude to the MCP Server

Once port-forwarding is active:

1. In another terminal, run: `ngrok http 8080`
2. Copy the ngrok HTTPS URL (e.g. `https://<id>.ngrok-free.app`)
3. Configure Claude to use that URL as the MCP server endpoint

## Cleanup

```bash
minikube stop --profile secure
minikube delete --profile secure
```
