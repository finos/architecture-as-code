# Scenario 3: Gating Deployments

Demonstrates **governance gates** that block deployments unless the architecture uses an approved pattern registered in CALM Hub and conforms to that pattern's control requirements.

## Prerequisites

- Scenario 1 cluster (`minikube --profile secure`) must be running
- **CALM Hub** must be reachable at `http://localhost:8085`

Start CALM Hub if needed:

```bash
cd calm-hub/deploy-qcon && docker-compose up -d
```

The demo will detect if CALM Hub is not running and offer to start it automatically (up to 3 attempts).

## Run the Demo

```bash
./demo.sh
```

## What the Demo Shows

### Step 1 — Generate Deployer

Uses `calm template` with the governance bundle to generate a `generated-deployer/deployer.sh` — a custom deployment script that embeds governance logic for this specific architecture.

### Gate 1 — Pattern Registration Check ❌ then ✅

Checks CALM Hub (`http://localhost:8085`) to verify the pattern referenced by the architecture is registered in the `qcon` namespace.

- First tests `qcon.architecture.json` — its pattern is **not registered** → gate rejects
- Then tests `trades-api-and-mcp-conforming.architecture.json` — its pattern **is registered** → gate passes

### Gate 2 — Architecture Control Validation ❌ then ✅

Runs `calm validate` to confirm the architecture conforms to pattern requirements (all controls declared).

- First tests `trades-api-and-mcp-non-conforming.architecture.json` — missing `permitted-connection` controls → validation **fails**
- Then tests `trades-api-and-mcp-conforming.architecture.json` — all controls present → validation **passes**

## Key Files

### Architectures

| File | Status |
|------|--------|
| `calm/qcon.architecture.json` | ❌ Uses unregistered pattern (Gate 1 fail) |
| `calm/trades-api-and-mcp-non-conforming.architecture.json` | ❌ Missing controls (Gate 2 fail) |
| `calm/trades-api-and-mcp-conforming.architecture.json` | ✅ Registered pattern + all controls present |

### Controls

| File | Purpose |
|------|---------|
| `calm/controls/micro-segmentation.*.json` | Cluster network policy requirement |
| `calm/controls/permitted-connection.*.json` | Explicit connection authorization |
| `calm/controls/mcp-guardrail.*.json` | Restricted trading symbols |

### Bundle

| File | Purpose |
|------|---------|
| `bundle/governance-transformer.js` | Generates deployer with governance validation |
| `bundle/deployer.hbs` | Deployer script template |
| `bundle/index.json` | Bundle configuration |

## Key Takeaways

- **Shift-Left Governance**: Controls are checked before deployment, not after
- **Central Registry**: CALM Hub enforces that only pre-approved patterns can be deployed
- **Pattern Conformance**: Architecture must satisfy all required controls defined in the pattern
- **Clear Remediation**: Each gate failure shows exactly what is missing and how to fix it

## Cleanup

```bash
# Stop CALM Hub
cd calm-hub/deploy-qcon && docker-compose down

# Remove generated deployer
rm -rf generated-deployer/
```

