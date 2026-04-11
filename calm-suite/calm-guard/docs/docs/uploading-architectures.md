---
sidebar_position: 3
title: Uploading Architectures
---

# Uploading Architectures

## What is CALM?

CALM (Common Architecture Language Model) is an open standard from [FINOS](https://www.finos.org) for describing software architectures in machine-readable JSON. It provides a structured way to document:

- **Nodes**: components (services, databases, actors, networks)
- **Relationships**: how nodes connect and interact
- **Controls**: compliance and security requirements
- **Flows**: end-to-end business process flows

Think of CALM as "architecture-as-code" — the same philosophy as infrastructure-as-code, but for your system's logical architecture.

**Learn more:** [FINOS CALM Specification](https://github.com/finos/architecture-as-code)

## CALM Document Structure

A CALM document is a JSON object with four top-level arrays:

```json
{
  "nodes": [...],
  "relationships": [...],
  "controls": {...},
  "flows": [...]
}
```

### Nodes

Each node represents an architecture component:

```json
{
  "unique-id": "payment-service",
  "node-type": "service",
  "name": "Payment Service",
  "description": "Processes payment transactions",
  "interfaces": [...],
  "controls": {
    "pci-requirement": {
      "description": "PCI-DSS 3.2 - Protect stored cardholder data",
      "requirements": [{
        "requirement-url": "https://pcissc.org/standards/pci-dss/requirement-3"
      }]
    }
  }
}
```

**Supported node types:** `actor`, `ecosystem`, `system`, `service`, `database`, `network`, `ldap`, `webclient`, `data-asset`

### Relationships

Relationships connect nodes and describe how they interact:

```json
{
  "unique-id": "rel-payment-db",
  "relationship-type": "connects",
  "connects": {
    "source": { "node": "payment-service" },
    "destination": { "node": "payment-database" }
  },
  "protocol": "JDBC"
}
```

**Supported relationship types:** `interacts`, `connects`, `deployed-in`, `composed-of`, `options`

**Supported protocols:** `HTTP`, `HTTPS`, `SFTP`, `JDBC`, `WebSocket`, `AMQP`, `TLS`, `mTLS`, `TCP`, `LDAP`, and more

## Using Demo Architectures

CALMGuard ships with two demo architectures in the `examples/` directory. To use them:

1. Launch CALMGuard (`pnpm dev`)
2. On the main page, select an architecture from the dropdown:
   - **Trading Platform** — equities trading with market data, order management, risk checks
   - **Payment Gateway** — payment processing with fraud detection and settlement
3. Click **Analyze** to begin

## Custom CALM Document Upload

### Current Status

In the current version, custom CALM documents are loaded programmatically via the `examples/` directory. Drag-and-drop upload is a planned feature.

**To analyze your own architecture:**

1. Create a valid CALM JSON file following the structure above
2. Place it in the `examples/` directory
3. Add it to the examples list in `src/lib/calm/examples.ts`
4. Restart the dev server — your architecture will appear in the dropdown

### Validating Your CALM Document

You can validate a CALM document against the schema without running the full analysis:

```bash
# Using the API directly
curl -X POST http://localhost:3000/api/calm/parse \
  -H "Content-Type: application/json" \
  -d '{"calm": <your-calm-json-here>}'
```

Response on success:
```json
{
  "success": true,
  "data": {
    "nodes": [...],
    "relationships": [...],
    "nodeCount": 8,
    "relationshipCount": 12
  }
}
```

Response on validation failure:
```json
{
  "error": "Invalid CALM document",
  "details": {
    "issues": [
      {
        "path": ["nodes", 0, "node-type"],
        "message": "Invalid enum value. Expected 'actor' | 'service' | ..."
      }
    ]
  }
}
```

## Compliance Controls in CALM

The real power of CALM for compliance comes from embedding control references directly in nodes and relationships:

```json
{
  "unique-id": "trading-db",
  "node-type": "database",
  "name": "Trading Database",
  "controls": {
    "sox-financial-records": {
      "description": "SOX Section 802 - Financial record retention for 7 years",
      "requirements": [{
        "requirement-url": "https://pcaobus.org/sox/section802"
      }]
    },
    "pci-data-protection": {
      "description": "PCI-DSS Requirement 3 - Protect stored cardholder data",
      "requirements": [{
        "requirement-url": "https://pcissc.org/standards/pci-dss/requirement-3"
      }]
    }
  }
}
```

CALMGuard's Compliance Mapper agent reads these controls and maps them to the 4 supported frameworks (SOX, PCI-DSS, NIST-CSF, FINOS CCC), scoring your architecture's compliance posture against each.
