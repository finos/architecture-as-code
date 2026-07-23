# CALM 1.2 — reference schématu Controls, Decorators a Evidence

**Účel:** Reference pro implementaci AIGF governance v CalmStudio/CalmGuard nad specifikací CALM v1.2
**Základní URL schémat:** `https://calm.finos.org/release/1.2/meta/`

---

## Inventář souborů schémat (1.2)

| Soubor | Účel |
|---|---|
| `calm.json` | Schéma top-level CALM dokumentu |
| `core.json` | Uzly, vztahy, metadata, controls, flows, ADR |
| `control.json` | Definice controls a control-detail |
| `control-requirement.json` | Základní schéma pro všechny control requirements |
| `evidence.json` | Propojení evidence zpět na control configy |
| `decorators.json` | **Nové v 1.2** — průřezová metadata |
| `calm-timeline.json` | **Nové v 1.2** — sledování vývoje architektury |
| `timeline.json` | **Nové v 1.2** — definice timeline/momentů |
| `flow.json` | Definice flow/přechodů |
| `interface.json` | Typy rozhraní |
| `units.json` | Definice jednotek (time-unit atd.) |

---

## 1. Schéma Controls (`control.json`)

Controls jsou governance mechanismus CALM. Připojují se na třech úrovních: na celém dokumentu, na uzlu a na vztahu.

### Schéma

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

### Důležité body návrhu

- Klíče controls odpovídají `^[a-zA-Z0-9-]+$` — používají se jako doménové skupiny (např. `"security"`, `"aigf-governance"`, `"compliance"`)
- Každá doména má `description` + `requirements[]`
- Každý requirement má povinné `requirement-url` + buď `config-url`, NEBO inline `config` (oneOf)
- Controls se připojují přes `$ref: "control.json#/defs/controls"` na úrovni dokumentu, uzlu a vztahu

### Konvence doménových klíčů pro AIGF

U všech AIGF control klíčů použij prefix `aigf-` pro namespacing:

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

## 2. Schéma Control Requirement (`control-requirement.json`)

Základní schéma, které všechny definice control requirementů rozšiřují přes `allOf`.

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

### Vzor AIGF Control Requirement

Pro upstream příspěvek se každá AIGF mitigace stane schématem control requirementu:

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

## 3. Schéma Evidence (`evidence.json`)

Propojuje compliance evidence artefakty s controls. Relevantní pro generování audit reportů v CalmGuard.

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

### Příklad AIGF Evidence

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

## 4. Schéma Decorators (`decorators.json`) — nové v 1.2

Decorators připojují doplňující informace k uzlům, vztahům a dalším prvkům **bez úpravy jádrových definic**. Hodí se pro AIGF governance overlay.

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

### Použití AIGF Decorator

**Governance overlay na úrovni architektury:**

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

### Controls vs. Decorators: kdy použít co

| Aspekt | Controls | Decorators |
|---|---|---|
| **Rozsah** | Jeden uzel nebo vztah | Více prvků najednou |
| **Účel** | Vynucení konkrétních požadavků | Připojení doplňujících metadat |
| **Validace** | Schématově validováno přes requirement-url | Volný datový objekt |
| **Úprava** | Mění definici uzlu/vztahu | Nemění jádrové definice |
| **AIGF use case** | Mitigace na úrovni uzlu (mi-18 na agent node) | Architektura-wide governance overlay, threat modely, risk assessmenty |
| **Role CalmGuard** | Ověří existenci controlu a správnost configu | Čte governance metadata pro reportování |

**Doporučení:** Používat obojí. Controls pro vynutitelné mitigační požadavky na jednotlivých uzlech. Decorators pro architekturu-wide governance kontext, threat modely a compliance metadata, která CalmGuard čte pro reportování.

---

## 5. Reálné příklady controls z CALM repozitáře

### Micro-segmentation na Kubernetes clusteru (control na uzlu)

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

### Permitted Connection na vztahu (control na vztahu)

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

### TraderX Domain Packs (konvence seskupení)

Controls se seskupují podle doménového klíče:

| Doménový klíč | Účel |
|---|---|
| `security` | Autentizace, autorizace, šifrování, audit logging, API rate limiting, správa secretů |
| `compliance_and_governance` | Access review, approval workflowy, change management, regulatorní compliance |
| `resilience_and_risk_management` | Dostupnost, disaster recovery, failover, incident response |
| `data_integrity_and_retention` | Konzistence dat, integrita, retence, validace schématu |
| `monitoring_and_observability` | Alerting, logging, tracing, monitoring |
| `performance_and_scalability` | Latence, propustnost, škálovatelnost |

**Pro AIGF používej klíče s prefixem `aigf-`** a vytvoř tak samostatný governance domain pack.

---

## 6. Governance řetězec

```
Requirement Schema (JSON Schema)
    ↓ odkazuje
Control Detail (requirement-url + config-url/config)
    ↓ seskupeno do
Controls Object (klíčované doménou, na uzlech/vztazích)
    ↓ validuje
CalmGuard (kontroluje existenci controls, config splňuje requirement schema)
    ↓ doloženo
Evidence (evidence-paths + control-config-url)
    ↓ překryto
Decorators (architektura-wide governance kontext, threat modely, skóre)
```

Pro integraci AIGF pracuje CalmStudio na úrovni Controls a Decorators (design-time). CalmGuard na úrovni validace a evidence (build-time). CalmSentry/OpsFlow na úrovni sběru evidence (runtime).
