# CALM 1.2 Controls, Decorators & Evidence Schema Reference

**Purpose:** Reference for implementing AIGF governance in CalmStudio/CalmGuard against CALM spec v1.2
**Schema base URL:** `https://calm.finos.org/release/1.2/meta/`

---

## Schema File Inventory (1.2)

| File | Purpose |
|---|---|
| `calm.json` | Top-level CALM document schema |
| `core.json` | Nodes, relationships, metadata, controls, flows, ADRs |
| `control.json` | Controls and control-detail definitions |
| `control-requirement.json` | Base schema for all control requirements |
| `evidence.json` | Evidence linking back to control configs |
| `decorators.json` | **New in 1.2** — Cross-cutting metadata attachments |
| `calm-timeline.json` | **New in 1.2** — Architecture evolution tracking |
| `timeline.json` | **New in 1.2** — Timeline/moment definitions |
| `flow.json` | Flow/transition definitions |
| `interface.json` | Interface types |
| `units.json` | Unit definitions (time-unit, etc.) |

---

## 1. Controls Schema (`control.json`)

Controls are CALM's governance mechanism. They attach at three levels: document-wide, per-node, and per-relationship.

### Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://calm.finos.org/release/1.2/meta/control.json",
  "title": "Common Architecture Language Model Controls",
  "defs": {
    "control-detail": {
      "type": "object",
      "properties": {
        "requirement-url": {
          "type": "string",
          "description": "The requirement schema that specifies how a control should be defined"
        },
        "config-url": {
          "type": "string",
          "description": "The configuration of how the control requirement schema is met"
        },
        "config": {
          "type": "object",
          "description": "Inline configuration of how the control requirement schema is met"
        }
      },
      "required": ["requirement-url"],
      "oneOf": [
        { "required": ["config-url"] },
        { "required": ["config"] }
      ]
    },
    "controls": {
      "type": "object",
      "patternProperties": {
        "^[a-zA-Z0-9-]+$": {
          "type": "object",
          "properties": {
            "description": { "type": "string" },
            "requirements": {
              "type": "array",
              "items": { "$ref": "#/defs/control-detail" }
            }
          },
          "required": ["description", "requirements"]
        }
      }
    }
  }
}
```

### Key Design Points

- Control keys match `^[a-zA-Z0-9-]+$` — used as domain groupings (e.g., `"security"`, `"aigf-governance"`, `"compliance"`)
- Each control domain has `description` + `requirements[]`
- Each requirement has mandatory `requirement-url` + either `config-url` OR inline `config` (oneOf)
- Controls attach via `$ref: "control.json#/defs/controls"` at document, node, and relationship levels

### Domain Key Convention for AIGF

Use `aigf-` prefix for all AIGF control keys to namespace them:

```json
"controls": {
  "aigf-mcp-security": {
    "description": "MCP Server Security Governance (AIGF mi-20) — Tier 2",
    "requirements": [{
      "requirement-url": "https://air-governance-framework.finos.org/mitigations/mi-20",
      "config": {
        "tier": 2,
        "proxy-required": true,
        "human-approval": false,
        "anomaly-detection": true
      }
    }]
  },
  "aigf-agent-least-privilege": {
    "description": "Agent Authority Least Privilege Framework (AIGF mi-18)",
    "requirements": [{
      "requirement-url": "https://air-governance-framework.finos.org/mitigations/mi-18",
      "config": {
        "max-permissions": ["read", "search"],
        "escalation-required-for": ["write", "delete", "execute"]
      }
    }]
  }
}
```

---

## 2. Control Requirement Schema (`control-requirement.json`)

Base schema that all control requirement definitions extend via `allOf`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
  "type": "object",
  "properties": {
    "control-id": {
      "type": "string",
      "description": "Unique identifier, used for linking evidence"
    },
    "name": {
      "type": "string",
      "description": "Name providing contextual meaning within a domain"
    },
    "description": {
      "type": "string",
      "description": "Detailed description and developer guidance"
    }
  },
  "required": ["control-id", "name", "description"],
  "examples": [
    {
      "control-id": "CR-001",
      "name": "Access Control",
      "description": "Ensure that access to sensitive information is restricted."
    }
  ]
}
```

### AIGF Control Requirement Pattern

For upstream contribution, each AIGF mitigation becomes a control requirement schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://calm.finos.org/aigf/control-requirement/mcp-security-governance.json",
  "title": "MCP Server Security Governance (AIGF mi-20)",
  "type": "object",
  "allOf": [
    { "$ref": "https://calm.finos.org/release/1.2/meta/control-requirement.json" }
  ],
  "properties": {
    "control-id": { "const": "AIGF-MI-20" },
    "name": { "const": "MCP Server Security Governance" },
    "description": { "const": "Comprehensive security controls for MCP servers in agentic AI systems" },
    "tier": { "enum": [1, 2, 3] },
    "proxy-required": { "type": "boolean" },
    "human-approval": { "type": "boolean" },
    "allowlist-enforced": { "type": "boolean" },
    "anomaly-detection": { "type": "boolean" },
    "mutual-auth": { "type": "boolean" }
  },
  "required": ["control-id", "name", "description", "tier"]
}
```

---

## 3. Evidence Schema (`evidence.json`)

Links compliance evidence artifacts to controls. Relevant for CalmGuard audit report generation.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://calm.finos.org/release/1.2/meta/evidence.json",
  "type": "object",
  "properties": {
    "evidence": {
      "type": "object",
      "properties": {
        "unique-id": {
          "type": "string",
          "description": "CALM unique-id for linking"
        },
        "evidence-paths": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Paths to evidence artifacts"
        },
        "control-config-url": {
          "type": "string",
          "description": "URI of the control configuration this evidence relates to"
        }
      },
      "required": ["unique-id", "evidence-paths", "control-config-url"]
    }
  },
  "required": ["evidence"]
}
```

### AIGF Evidence Example

```json
{
  "evidence": {
    "unique-id": "ev-aigf-mi-20-mcp-audit",
    "evidence-paths": [
      "reports/mcp-security-audit-2026-Q1.pdf",
      "ci/calmguard-aigf-scan-2026-03-14.json"
    ],
    "control-config-url": "https://air-governance-framework.finos.org/mitigations/mi-20"
  }
}
```

---

## 4. Decorators Schema (`decorators.json`) — New in 1.2

Decorators attach supplementary information to nodes, relationships, and other elements **without modifying core definitions**. Ideal for AIGF governance overlays.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://calm.finos.org/release/1.2/meta/decorators.json",
  "title": "Common Architecture Language Model Decorators",
  "defs": {
    "decorator": {
      "type": "object",
      "properties": {
        "unique-id": {
          "type": "string",
          "description": "Unique identifier for this decorator"
        },
        "type": {
          "type": "string",
          "description": "Free-form string identifying the decorator category"
        },
        "target": {
          "type": "array",
          "items": { "type": "string" },
          "minItems": 1,
          "description": "File paths or URLs referencing CALM documents this decorator targets"
        },
        "applies-to": {
          "type": "array",
          "items": { "type": "string" },
          "minItems": 1,
          "description": "unique-ids of nodes, relationships, flows, etc."
        },
        "data": {
          "type": "object",
          "minProperties": 1,
          "description": "Free-form JSON payload"
        }
      },
      "required": ["unique-id", "type", "target", "applies-to", "data"],
      "additionalProperties": false
    }
  }
}
```

### AIGF Decorator Usage

**Architecture-wide governance overlay:**

```json
{
  "unique-id": "aigf-governance-overlay",
  "type": "aigf-governance",
  "target": ["kyc-onboarding-architecture.json"],
  "applies-to": ["llm-service", "agent-node", "mcp-server", "vector-store"],
  "data": {
    "framework": "FINOS AI Governance Framework",
    "version": "2.0",
    "assessed-risks": [
      { "id": "AIR-OP-004", "status": "mitigated", "mitigation": "mi-10" },
      { "id": "AIR-SEC-026", "status": "mitigated", "mitigation": "mi-20" },
      { "id": "AIR-SEC-024", "status": "unmitigated", "recommendation": "mi-18" }
    ],
    "governance-score": 67,
    "assessment-date": "2026-03-14",
    "next-review": "2026-06-14",
    "regulatory-mappings": {
      "eu-ai-act": ["c3-s2-a15", "c3-s2-a14"],
      "iso-42001": ["A-6-1-3", "A-9-2"],
      "nist-sp-800-53r5": ["ac-4", "sc-7"]
    }
  }
}
```

**Threat model decorator:**

```json
{
  "unique-id": "aigf-threat-model",
  "type": "aigf-threat-model",
  "target": ["kyc-onboarding-architecture.json"],
  "applies-to": ["llm-service", "mcp-server"],
  "data": {
    "threats": [
      {
        "risk-id": "AIR-SEC-010",
        "title": "Prompt Injection",
        "attack-vector": "User input to LLM via KYC document analysis",
        "impact": "Unauthorized data extraction from KYC database",
        "likelihood": "medium",
        "mitigations": ["mi-3", "mi-17"]
      },
      {
        "risk-id": "AIR-SEC-026",
        "title": "MCP Server Supply Chain Compromise",
        "attack-vector": "Compromised MCP server in document processing pipeline",
        "impact": "PII exfiltration",
        "likelihood": "low",
        "mitigations": ["mi-20"]
      }
    ]
  }
}
```

### Controls vs Decorators: When to Use Which

| Aspect | Controls | Decorators |
|---|---|---|
| **Scope** | Single node or relationship | Multiple elements at once |
| **Purpose** | Enforce specific requirements | Attach supplementary metadata |
| **Validation** | Schema-validated via requirement-url | Free-form data object |
| **Modification** | Modifies the node/relationship definition | Does NOT modify core definitions |
| **AIGF use case** | Node-level mitigation enforcement (mi-18 on agent node) | Architecture-wide governance overlay, threat models, risk assessments |
| **CalmGuard role** | Validate control exists and config is correct | Read governance metadata for reporting |

**Recommendation:** Use both. Controls for enforceable mitigation requirements on individual nodes. Decorators for architecture-wide governance context, threat models, and compliance metadata that CalmGuard reads for reporting.

---

## 5. Real-World Control Examples from CALM Repo

### Micro-segmentation on Kubernetes Cluster (node control)

```json
{
  "unique-id": "k8s-cluster",
  "name": "Kubernetes Cluster",
  "node-type": "system",
  "controls": {
    "security": {
      "description": "Security requirements for the Kubernetes cluster",
      "requirements": [{
        "requirement-url": "https://calm.finos.org/getting-started/controls/micro-segmentation.requirement.json",
        "config-url": "https://calm.finos.org/getting-started/controls/micro-segmentation.config.json"
      }]
    }
  }
}
```

### Permitted Connection on relationship (relationship control)

```json
{
  "unique-id": "svc-to-db",
  "description": "Service connects to database",
  "protocol": "JDBC",
  "relationship-type": {
    "connects": {
      "source": { "node": "payment-svc" },
      "destination": { "node": "payment-db" }
    }
  },
  "controls": {
    "security": {
      "description": "Security Controls for the connection",
      "requirements": [{
        "requirement-url": "https://calm.finos.org/getting-started/controls/permitted-connection.requirement.json",
        "config-url": "https://calm.finos.org/getting-started/controls/permitted-connection-jdbc.config.json"
      }]
    }
  }
}
```

### TraderX Domain Packs (grouping convention)

Controls are grouped by domain key:

| Domain Key | Purpose |
|---|---|
| `security` | Authentication, authorization, encryption, audit logging, API rate limiting, secrets management |
| `compliance_and_governance` | Access reviews, approval workflows, change management, regulatory compliance |
| `resilience_and_risk_management` | Availability, disaster recovery, failover, incident response |
| `data_integrity_and_retention` | Data consistency, integrity, retention, schema validation |
| `monitoring_and_observability` | Alerting, logging, tracing, monitoring |
| `performance_and_scalability` | Latency, throughput, scalability |

**For AIGF, use `aigf-` prefixed keys** to create a distinct governance domain pack.

---

## 6. The Governance Chain

```
Requirement Schema (JSON Schema)
    ↓ referenced by
Control Detail (requirement-url + config-url/config)
    ↓ grouped into
Controls Object (domain-keyed, on nodes/relationships)
    ↓ validated by
CalmGuard (checks controls exist, config satisfies requirement schema)
    ↓ evidenced by
Evidence (evidence-paths + control-config-url)
    ↓ overlaid by
Decorators (architecture-wide governance context, threat models, scores)
```

For the AIGF integration, CalmStudio operates at the Controls and Decorators level (design-time). CalmGuard operates at the validation and evidence level (build-time). CalmSentry/OpsFlow operates at the evidence collection level (runtime).
