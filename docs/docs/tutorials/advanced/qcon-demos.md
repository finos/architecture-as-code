---
id: qcon-demos
title: "QCon Demos: An End-to-End Story"
sidebar_position: 1
---

# QCon CALM Demos: An End-to-End Story

🔴 **Difficulty:** Advanced | ⏱️ **Time:** ~30–60 minutes for the full flow

## Overview

A scripted, five-scenario walkthrough of several CALM-based scenarios, originally presented at the QCon Conference. Together the scenarios trace the lifecycle of a real platform, from initial deployment, through control and governance, to fully autonomous agents, with every step grounded in a CALM architecture.

Run the scenarios in sequence (each builds on state left by the previous one) using the orchestrator script.

## The Five Scenarios

| # | Scenario | What it Demonstrates |
|---|----------|----------------------|
| 1 | **Deploy API & MCP Architecture** | Generate Kubernetes manifests from a CALM architecture using `calm template`, then deploy a Trades REST API, an MCP server, and an A2A server onto a Minikube cluster. |
| 2 | **Introducing Controls and Governance** | Add a declarative MCP guardrail control to the architecture, regenerate, and watch CALM controls turn into Kubernetes ConfigMaps that the running MCP server picks up. |
| 3 | **Gating Deployments** | Block deployments unless the architecture references an approved pattern registered in CALM Hub *and* conforms to that pattern's required controls. |
| 4 | **Scaling Deployments and Operational Change** | Roll out a platform-wide change (resource limits on every workload) by releasing a new template bundle version, without touching a single team-owned architecture file. |
| 5 | **Rapid Platform Adoption** | Spin up an autonomous rebalancer agent that communicates via the Agent-to-Agent (A2A) protocol — OBSERVE → DECIDE → ACT, no human in the loop. |

## Concepts at Work

| Concept | Where It Shows Up |
|---------|-------------------|
| `calm template` — architecture-to-infrastructure generation | All scenarios |
| CALM **Patterns** — reusable, validated architecture templates | Scenarios 3, 4 |
| CALM **Controls** — declarative governance requirements | Scenarios 2, 3 |
| **Template bundles** — platform-owned generation logic, versioned independently from architectures | Throughout (foregrounded in scenario 4) |
| **CALM Hub** — registry for patterns, namespaces, and entitlements | Scenario 3 |
| `calm validate` — architecture conformance to its pattern | Scenario 3 |
| **MCP (Model Context Protocol)** | Scenarios 1, 2 |
| **A2A (Agent-to-Agent) protocol** | Scenario 5 |
| Kubernetes manifests, network policies, ConfigMaps | Scenarios 1–4 |

## Prerequisites

- **`minikube`** — local Kubernetes cluster
- **`kubectl`** — cluster management
- **`docker`** + **`docker-compose`** — for CALM Hub (scenario 3) and the Agent UI (scenario 5)
- **`calm` CLI** — `npm install -g @finos/calm-cli`
- **`jq`** — JSON processing
- **`bat`**, **`tree`** — optional, nicer terminal display (each falls back gracefully if missing)
- **Node.js 22+** for the CLI itself

Verify the CLI is ready:

```bash
calm --version   # 1.46.0 or later
```

## Kick Off the Demo

Clone the [architecture-as-code repository](https://github.com/finos/architecture-as-code) and run the orchestrator script from the repo root:

```bash
cd conferences/qcon
./demo-flow.sh
```

You'll be asked to choose a mode at startup:

- **Concise mode** (default) — every command is shown, narration is trimmed. Good for live presentations.
- **Story mode** — fuller narration explaining *why* each step matters. Good for self-paced learning.

The orchestrator demo script walks you through scenarios 1 through 5 with `Press Enter` prompts between sections. If a step fails (for example, CALM Hub isn't reachable when scenario 3 starts), you'll be offered the option to retry, auto-start the missing service via Docker Compose, or quit.

### Port-Forwarding for Scenarios 2–5

After scenario 1 deploys the services to Minikube, open a **second terminal** and start port-forwarding so the later scenarios can reach the cluster:

```bash
cd conferences/qcon/scenario1
./port-forward.sh
```

Services are then available at:

- MCP Server — `http://localhost:8080`
- Trades API — `http://localhost:8081`
- A2A Server — `http://localhost:9103`

Leave that terminal running until the demo is finished.

### Connecting Claude to the MCP Server (Optional)

Once scenario 1 or 2 is running with port-forwarding active:

1. In a separate terminal, expose the MCP server with `ngrok http 8080`
2. Copy the ngrok HTTPS URL
3. Configure Claude to use that URL as its MCP server endpoint

After scenario 2, the guardrail is enforced: queries for restricted symbols (`VOD`, `GME`, `AMC`) are rejected.

## Cleanup

```bash
# stop Kubernetes
kubectl delete -k conferences/qcon/scenario4/generated/kubernetes
minikube stop --profile secure
minikube delete --profile secure

# stop CALM Hub
cd calm-hub/deploy-qcon && docker-compose down

# stop the Agent UI
docker rm -f qcon-agent-ui
```

## Learn More

- [README in `conferences/qcon/`](https://github.com/finos/architecture-as-code/tree/main/conferences/qcon) — the source-of-truth doc this page is derived from, plus per-scenario READMEs
- [CALM Patterns](../intermediate/17-patterns) — the building block scenario 3 leans on
- [CALM Controls](../intermediate/08-controls) — the governance primitive used in scenarios 2 and 3
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Agent-to-Agent Protocol](https://google.github.io/A2A/)
