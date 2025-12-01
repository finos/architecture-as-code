# Day 19: Model Your Actual System Architecture

## Overview
Apply everything you've learned to create a production-ready CALM architecture for a real system you work on.

## Objective and Rationale
- **Objective:** Create a comprehensive CALM architecture for an actual system with 10+ nodes, representing real production infrastructure
- **Rationale:** Move from learning exercises to practical application. This becomes a living document for your team, supporting onboarding, planning, and governance. Create real value from your CALM knowledge.

## Requirements

### 1. Choose Your System

Select a real system to model:
- **Option A:** Production system you currently work on
- **Option B:** Well-known open-source system (Kubernetes, GitLab, WordPress, etc.)
- **Option C:** Realistic fictional system based on your domain expertise

**Criteria:**
- At least 10 distinct components
- Multiple integration types (APIs, databases, message queues)
- Real deployment considerations
- Actual or realistic security requirements

### 2. Plan Your Architecture

Before creating the JSON, sketch out:

**File:** `docs/architecture-planning.md`

**Content:**
```markdown
# Architecture Planning: [System Name]

## System Overview

**Purpose:** [What does this system do?]  
**Scale:** [Users, requests/day, data volume]  
**Team:** [Who owns/maintains it?]

## Components Inventory

| Component | Type | Purpose | Dependencies |
|-----------|------|---------|--------------|
| [Name] | service | [Purpose] | [What it connects to] |
| ... | ... | ... | ... |

## Integration Points

| From | To | Protocol | Purpose |
|------|-----|----------|---------|
| ... | ... | ... | ... |

## Security Considerations

- Authentication: [Method]
- Data classification: [Public/Internal/Confidential]
- Compliance: [Standards that apply]

## Deployment Topology

- Cloud provider: [AWS/Azure/GCP/On-prem]
- Regions: [List]
- Networks: [VPCs, subnets]

## Critical Flows

1. [Primary user flow]
2. [Data processing flow]
3. [Background job flow]
```

### 3. Create the Architecture File

**File:** `architectures/production-[system-name].json`

**Minimum Requirements:**
- ✅ 10+ nodes covering all major components
- ✅ All nodes have complete metadata (owner, team, sla-tier, etc.)
- ✅ 15+ relationships showing all integrations
- ✅ All connects relationships reference specific interfaces
- ✅ Multiple interface types (APIs, databases, message queues, etc.)
- ✅ At least 3 security or compliance controls
- ✅ At least 2 business flows
- ✅ Top-level metadata with comprehensive documentation

**Node Types to Include:**
- `service`: Backend services, APIs
- `webclient`: Frontend applications
- `database`: Data stores
- `system`: Infrastructure (load balancers, message queues, caches)
- `actor`: External users, systems

**Prompt:**
```text
Create a comprehensive CALM architecture file at architectures/production-[system-name].json

System description: [Describe your system in detail]

Include:

1. Top-level metadata:
   - title, description, version, owner
   - team contact information
   - adrs array (can be empty for now)

2. At least 10 nodes representing:
   - Frontend applications
   - Backend services
   - Databases (specify type: PostgreSQL, MongoDB, etc.)
   - Infrastructure components (load balancer, cache, message queue)
   - External systems/actors

3. Each node must have:
   - Descriptive name and description
   - Appropriate node-type
   - Complete metadata (owner, team, sla-tier, environment)
   - Interfaces (host-port or url interfaces)
   - Controls where applicable (especially for data stores and external-facing services)

4. Relationships:
   - Use connects for technical integrations
   - Use interacts for user interactions
   - Reference specific interfaces
   - Specify accurate protocols

5. Security controls:
   - Architecture-level: authentication, encryption
   - Node-level: compliance for regulated components (PCI-DSS, GDPR, HIPAA, etc.)

6. Business flows:
   - Primary user flow
   - Critical business process
   - Use actual relationship unique-ids

Make this production-quality and realistic.
```

### 4. Add Deployment Topology

Document where components run:

**Prompt:**
```text
Add deployment topology to architectures/production-[system-name].json

Create infrastructure nodes:
- Region/datacenter nodes (node-type: system)
- Network zones (DMZ, private, data tier)
- Kubernetes clusters or VM groups

Add deployed-in relationships:
- Each application service deployed-in cluster/zone
- Each database deployed-in data tier
- Each frontend deployed-in DMZ

This shows the physical deployment structure.
```

### 5. Add Comprehensive Metadata

Ensure every node has rich metadata:

**Metadata Fields to Include:**
- `team-owner`: Team name
- `tech-owner`: Person email
- `sla-tier`: bronze/silver/gold/platinum
- `cost-center`: For chargeback
- `repository`: Git repo URL
- `documentation`: Wiki/docs URL
- `monitoring`: Dashboard URL
- `incident-channel`: Slack/Teams channel

**Prompt:**
```text
Enhance all nodes in architectures/production-[system-name].json with comprehensive metadata:

For each node, add:
- team-owner: [appropriate team]
- tech-owner: [email or username]
- sla-tier: [based on criticality]
- repository: [git repo URL]
- monitoring-dashboard: [URL to metrics]

Use realistic values based on the component's role.
```

### 6. Document Integration Patterns

**File:** `docs/integration-catalog-[system-name].md`

**Content:**
```markdown
# Integration Catalog: [System Name]

## REST APIs

| Service | Endpoint | Auth | Rate Limit | Documentation |
|---------|----------|------|------------|---------------|
| ... | ... | ... | ... | ... |

## Databases

| Database | Type | Purpose | Backup Strategy | Encryption |
|----------|------|---------|-----------------|------------|
| ... | ... | ... | ... | ... |

## Message Queues

| Queue | Type | Purpose | Retention | DLQ |
|-------|------|---------|-----------|-----|
| ... | ... | ... | ... | ... |

## External Integrations

| System | Protocol | Purpose | SLA | Contact |
|--------|----------|---------|-----|---------|
| ... | ... | ... | ... | ... |
```

### 7. Create System Runbook

**File:** `docs/runbook-[system-name].md`

**Content:**
```markdown
# Runbook: [System Name]

## Architecture

See: `architectures/production-[system-name].json`

Visualize: [Link to generated docs]

## Critical Components

### [Component 1]
- **Purpose:** [What it does]
- **Location:** [Where deployed]
- **Monitoring:** [Dashboard URL]
- **Logs:** [Log aggregation URL]
- **Alerts:** [Alert channel]
- **Restart:** [How to restart]

## Common Procedures

### Deploy New Version

\`\`\`bash
# Steps
\`\`\`

### Scale Service

\`\`\`bash
# Steps
\`\`\`

### Debug Connection Issues

1. Check architecture: [Link to relationship in CALM]
2. Verify network connectivity
3. Check firewall rules

## Incident Response

### Database Down

**Impact:** [Which services affected - reference CALM relationships]

**Steps:**
1. [Response steps]

## Architecture Flows

### Critical Path: [Flow Name]

See flow documentation in CALM architecture.

Components involved:
- [List from flow transitions]

## Dependencies

External systems this architecture depends on:
- [List from architecture actors/external systems]
```

### 8. Validate Everything

```bash
# Validate architecture
calm validate -a architectures/production-[system-name].json

# If you created a pattern
calm validate -p patterns/[pattern-name].json -a architectures/production-[system-name].json
```

### 9. Generate Comprehensive Documentation

```bash
# Full website
calm docify --architecture architectures/production-[system-name].json --output docs/generated/production-[system-name]

# Custom templates
calm docify --architecture architectures/production-[system-name].json --template-dir templates/comprehensive-bundle --output docs/generated/production-[system-name]-bundle
```

### 10. Create Architecture Visualization

**Steps:**
1. Open `architectures/production-[system-name].json`
2. Open preview (Ctrl+Shift+C)
3. **Take a screenshot** of the full architecture
4. Save to `docs/screenshots/production-architecture.png`

### 11. Share with Your Team

Create a presentation README:

**File:** `docs/ARCHITECTURE-OVERVIEW-[system-name].md`

**Content:**
```markdown
# [System Name] Architecture

## Quick Links

- **Architecture File:** [`architectures/production-[system-name].json`](../architectures/production-[system-name].json)
- **Generated Docs:** [View Documentation](generated/production-[system-name]/index.html)
- **Runbook:** [Operational Guide](runbook-[system-name].md)

## Architecture Diagram

![Architecture Diagram](screenshots/production-architecture.png)

## System Metrics

- **Components:** [Count] nodes
- **Integrations:** [Count] relationships
- **Business Flows:** [Count] documented flows
- **Security Controls:** [Count] controls

## Key Components

[Brief description of major components from your architecture]

## Critical Paths

[List of important flows from your architecture]

## Team Ownership

[Reference metadata from your architecture]

## For Developers

### Integration Guide

See: [Generated integration guide](generated/production-[system-name]-bundle/integration-guide.md)

### Adding New Components

1. Add node to `architectures/production-[system-name].json`
2. Add relationships
3. Update relevant flows
4. Regenerate docs: `./scripts/generate-docs.sh`
5. Submit PR (CI will validate)

## For Operations

### Monitoring

[Dashboard links from node metadata]

### Runbook

See: [Operational runbook](runbook-[system-name].md)

## For Security

### Controls

See: [Security assessment](generated/production-[system-name]-bundle/security-assessment.md)

### Compliance

[List compliance frameworks from controls]
```

### 12. Update Your README

Capture the highlights from Day 19 in your README before committing: mark the checklist, note the new production architecture file, and link to planning docs, the runbook, and generated documentation so stakeholders know where to look.

### 13. Commit Your Production Architecture

```bash
git add architectures/production-*.json docs/ README.md
git commit -m "Day 19: Model production architecture for [system-name]"
git tag day-19
```

## Deliverables

✅ **Required:**
- `architectures/production-[system-name].json` - 10+ node production architecture
- `docs/architecture-planning.md` - Planning document
- `docs/integration-catalog-[system-name].md` - Integration catalog
- `docs/runbook-[system-name].md` - Operational runbook
- `docs/ARCHITECTURE-OVERVIEW-[system-name].md` - Team-facing overview
- `docs/generated/production-[system-name]/` - Generated documentation
- `docs/screenshots/production-architecture.png` - Architecture visualization
- Updated `README.md` - Day 19 marked complete

✅ **Validation:**
```bash
# Validate architecture
calm validate -a architectures/production-*.json

# Check minimum node count
grep -c '"unique-id"' architectures/production-*.json | awk '$1 >= 10'

# Check for controls
grep -q '"controls"' architectures/production-*.json

# Check for flows
grep -q '"flows"' architectures/production-*.json

# Verify documentation exists
test -f docs/runbook-*.md
test -f docs/ARCHITECTURE-OVERVIEW-*.md

# Check generated docs
test -f docs/generated/production-*/index.html

# Check tag
git tag | grep -q "day-19"
```

## Resources
- [CALM Best Practices](https://calm.finos.org/docs/best-practices)
- [Architecture Documentation Guide](https://c4model.com/)

## Tips
- Interview team members to get accurate component details
- Use actual URLs for repositories, dashboards, docs
- Capture tribal knowledge in metadata
- Link to existing ADRs if you have them
- This architecture will evolve - commit to updating it
- Share generated docs with non-technical stakeholders
- Use this as onboarding material for new team members

## Next Steps
Tomorrow (Day 20) you'll add deployment topology to show where components run!
