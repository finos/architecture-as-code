---
sidebar_position: 8
title: Compliance Frameworks
---

# Compliance Frameworks

CALMGuard maps CALM architecture controls to four compliance frameworks relevant to financial services technology. This page describes each framework, its relevance, and how CALMGuard implements the mapping.

## Supported Frameworks

### SOX — Sarbanes-Oxley Act

**Relevance:** Any publicly traded company or company with publicly traded debt must comply with SOX. For technology teams, SOX primarily impacts systems that process, store, or transmit financial data.

**Key sections for technology:**

| Section | Title | Technology Relevance |
|---------|-------|---------------------|
| 302 | Corporate Responsibility | Executive sign-off on financial reporting systems |
| 404 | Internal Control Assessment | IT general controls, change management, access controls |
| 802 | Document Destruction | Data retention for 7+ years |
| 906 | Corporate Responsibility | Criminal penalties for false certifications |

**CALMGuard SOX mapping looks for:**
- Database nodes with data retention controls
- Access control relationships (LDAP nodes)
- Audit logging in service-to-database connections
- Change management controls on critical financial services

---

### PCI-DSS — Payment Card Industry Data Security Standard

**Relevance:** Any system that processes, stores, or transmits cardholder data (credit/debit card numbers, CVVs, PINs) must comply with PCI-DSS v4.0.

**12 Core Requirements:**

| Req | Title | CALM Mapping |
|-----|-------|-------------|
| 1-2 | Network Security Controls | Network nodes, firewall relationships |
| 3-4 | Protect Cardholder Data | Database nodes with encryption controls |
| 5-6 | Vulnerability Management | Service nodes with security controls |
| 7-8 | Access Control | LDAP nodes, actor-to-system relationships |
| 9 | Physical Security | `deployed-in` relationships (datacenter nodes) |
| 10 | Logging and Monitoring | Service controls referencing logging requirements |
| 11 | Security Testing | Pipeline controls (test relationships) |
| 12 | Information Security Policy | Top-level document controls |

**CALMGuard PCI-DSS mapping looks for:**
- `data-asset` nodes with cardholder data classifications
- Connections using `HTTPS` or `mTLS` protocols (unencrypted HTTP is a finding)
- Database nodes missing encryption controls
- Missing logging controls on payment service nodes

---

### NIST-CSF — NIST Cybersecurity Framework

**Relevance:** While voluntary in the US, NIST CSF 2.0 is the de facto standard for cybersecurity programs at financial institutions, often required by regulators (OCC, FDIC) and in contracts.

**6 Core Functions (CSF 2.0):**

| Function | Subcategories | CALM Mapping |
|----------|--------------|-------------|
| GOVERN | Roles, policies, supply chain | Actor nodes, ecosystem boundaries |
| IDENTIFY | Asset management, risk assessment | All node types and their controls |
| PROTECT | Access control, data security | LDAP nodes, protocol choices |
| DETECT | Monitoring, anomaly detection | Service controls for logging/monitoring |
| RESPOND | Incident management | Controls referencing incident response |
| RECOVER | Recovery planning | Backup/DR controls on database nodes |

**CALMGuard NIST-CSF mapping looks for:**
- Nodes without any controls (unmanaged assets)
- Missing monitoring controls on internet-facing services
- Missing backup controls on databases
- No identity management (LDAP) in architectures with external actors

---

### FINOS CCC — Common Cloud Controls

**Relevance:** FINOS CCC is an open-source framework specifically designed for financial services cloud adoption. It maps cloud security controls to regulatory requirements, making it particularly relevant for cloud-native architectures.

**Control Domains:**

| Domain | Description | CALM Mapping |
|--------|-------------|-------------|
| Identity | IAM, MFA, privilege access | Actor and LDAP node controls |
| Data | Encryption at rest/transit | Database and `data-asset` nodes |
| Resilience | HA, DR, failover | `deployed-in` relationships |
| Logging | Audit trails, SIEM | Service controls |
| Vulnerability | Scanning, patching | Service nodes |
| Change | CI/CD, deployment controls | Pipeline relationships |

**CALMGuard CCC mapping looks for:**
- Cloud ecosystem nodes missing IAM controls
- Data assets without encryption-at-rest controls
- Single-zone deployments (`deployed-in` pointing to single network)
- Missing SIEM/logging controls

## Control Mapping Methodology

### How CALM Controls Map to Frameworks

CALMGuard's Compliance Mapper agent reads each node's and relationship's `controls` object and matches them against framework requirements using a combination of:

1. **URL pattern matching**: `requirement-url` values are matched against known framework requirement URLs (e.g., `pcissc.org` → PCI-DSS)

2. **Description analysis**: LLM semantic matching of control descriptions against framework requirements

3. **Gap detection**: Nodes expected to have certain controls (based on `node-type` and data classification) but missing them are flagged as gaps

### Scoring Algorithm

The Risk Scorer agent aggregates Phase 1 results into a 0-100 score:

```
Base score = 100

For each framework:
  framework_weight = 1 / num_selected_frameworks

For each finding:
  deduction = severity_weight * framework_weight
  where severity_weight:
    critical = 25
    high = 10
    medium = 5
    low = 2
    info = 0

final_score = max(0, base_score - sum(deductions))
```

The per-framework breakdown score uses the same algorithm applied to that framework's findings only.

## Adding Custom Frameworks

To add a new compliance framework:

1. Create `skills/my-framework-compliance.md` with framework requirements in Markdown
2. Add the framework to `src/lib/compliance/frameworks.ts`:
   ```typescript
   export const FRAMEWORKS = [
     // ... existing frameworks
     { value: 'MY-FRAMEWORK', label: 'My Framework' },
   ] as const;
   ```
3. Add the skill reference to relevant agent YAML configurations
4. The Compliance Mapper agent will automatically include the new framework
