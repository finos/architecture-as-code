---
id: 16-ops-docs
title: "Generate Operations Documentation"
sidebar_position: 10
---

# Generate Operations Documentation

🟡 **Difficulty:** Intermediate | ⏱️ **Time:** 45-60 minutes

## Overview

Use CALM docify to generate support documentation and incident report templates directly from your architecture's operational metadata.

## Learning Objectives

By the end of this tutorial, you will:
- Create three Handlebars templates for operations documentation
- Generate service runbooks, on-call references, and flow support guides with `calm docify`
- Understand how to integrate documentation generation into a CI/CD pipeline
- See how architecture becomes the single source of truth for operations docs

## Prerequisites

Complete [Use CALM as Your Operations Advisor](./15-ops-advisor) first. You will need your `architectures/ecommerce-platform.json` enriched with operational metadata from Day 15.

## Step-by-Step Guide

### 1. Understand the Ops Documentation Goal

Your Day 15 architecture now contains:
- Owner and on-call contacts per service
- Health endpoints and runbook links
- Failure modes with symptoms and remediation
- Business impact per flow
- Monitoring dashboard links

Today you'll create templates that extract this into:
1. **Service Runbook** — Per-service troubleshooting guide
2. **On-Call Quick Reference** — Single-page contact sheet
3. **Flow Support Guide** — Flow-organized support guide for support teams

### 2. Create the Ops Template Directory

```bash
mkdir -p templates/ops
```

### 3. Create the Service Runbook Template

**File:** `templates/ops/service-runbook.md`

```handlebars
# Service Runbooks

Generated from architecture: {{metadata.name}}

---

{{#each nodes}}
{{#if (eq node-type "service")}}
## {{name}}

**Unique ID:** `{{unique-id}}`

### Ownership

| Field | Value |
|-------|-------|
| Owner | {{metadata.owner}} |
| On-Call Slack | {{metadata.oncall-slack}} |
| Tier | {{metadata.tier}} |
| Runbook | {{metadata.runbook}} |

### Health & Monitoring

- **Health Endpoint:** `{{metadata.health-endpoint}}`
- **Dashboard:** {{metadata.dashboard}}

### Known Failure Modes

{{#if metadata.failure-modes}}
{{#each metadata.failure-modes}}
#### {{symptom}}

| Aspect | Details |
|--------|---------|
| **Likely Cause** | {{likely-cause}} |
| **How to Check** | {{check}} |
| **Remediation** | {{remediation}} |
| **Escalation** | {{escalation}} |

{{/each}}
{{else}}
No failure modes documented yet.
{{/if}}

---

{{/if}}
{{/each}}
```

### 4. Create the On-Call Quick Reference Template

**File:** `templates/ops/oncall-reference.md`

```handlebars
# On-Call Quick Reference

**Architecture:** {{metadata.name}}

## Service Contacts

| Service | Owner | On-Call Channel | Tier |
|---------|-------|-----------------|------|
{{#each nodes}}
{{#if (eq node-type "service")}}
| {{name}} | {{metadata.owner}} | {{metadata.oncall-slack}} | {{metadata.tier}} |
{{/if}}
{{/each}}

## Database Contacts

| Database | DBA Contact | Backup Schedule | Restore Time |
|----------|-------------|-----------------|--------------|
{{#each nodes}}
{{#if (eq node-type "database")}}
| {{name}} | {{metadata.dba-contact}} | {{metadata.backup-schedule}} | {{metadata.restore-time}} |
{{/if}}
{{/each}}

## Critical Flows & Business Impact

{{#each flows}}
### {{name}}

- **Business Impact:** {{metadata.business-impact}}
- **SLA:** {{metadata.sla}}
- **Degraded Behavior:** {{metadata.degraded-behavior}}
- **Customer Communication:** {{metadata.customer-communication}}

---

{{/each}}

## Monitoring Links

{{#if metadata.monitoring}}
| Resource | Link |
|----------|------|
| Grafana Dashboard | {{metadata.monitoring.grafana-dashboard}} |
| Kibana Logs | {{metadata.monitoring.kibana-logs}} |
| PagerDuty | {{metadata.monitoring.pagerduty-service}} |
| Status Page | {{metadata.monitoring.statuspage}} |
{{/if}}
```

### 5. Create the Flow Support Guide Template

**File:** `templates/ops/flow-support-guide.md`

```handlebars
# Business Flow Support Guide

**Architecture:** {{metadata.name}}

---

{{#each flows}}
## {{name}}

**Description:** {{description}}

### Business Impact

| Aspect | Details |
|--------|---------|
| **Impact** | {{metadata.business-impact}} |
| **SLA** | {{metadata.sla}} |
| **Degraded Mode** | {{metadata.degraded-behavior}} |
| **Customer Message** | {{metadata.customer-communication}} |

### Flow Path

| Step | Relationship | Description |
|------|--------------|-------------|
{{#each transitions}}
| {{sequence-number}} | `{{relationship-unique-id}}` | {{description}} |
{{/each}}

### Troubleshooting Checklist

When this flow is degraded:

1. Check the health endpoints for each service in the flow
2. Review circuit breaker status between services
3. Check message broker queue depths (if async)
4. Review recent deployments to services in this flow
5. Check database replication lag

---

{{/each}}
```

### 6. Generate the Operations Documents

```bash
# Generate service runbooks
calm docify -a architectures/ecommerce-platform.json \
  -t templates/ops/service-runbook.md \
  -o docs/ops/service-runbooks.md

# Generate on-call quick reference
calm docify -a architectures/ecommerce-platform.json \
  -t templates/ops/oncall-reference.md \
  -o docs/ops/oncall-reference.md

# Generate flow support guide
calm docify -a architectures/ecommerce-platform.json \
  -t templates/ops/flow-support-guide.md \
  -o docs/ops/flow-support-guide.md
```

### 7. Review Generated Documents

Open each generated document and verify:
- Service runbooks contain all your services with their failure modes
- On-call reference has correct contacts
- Flow support guide documents each business flow with its impact and troubleshooting steps

### 8. Integrate with CI/CD for Always Up-to-Date Docs

Your architecture is the source of truth. When it changes, docs should regenerate automatically.

**Example GitHub Actions step:**

```yaml
- name: Generate operations documentation
  run: |
    calm docify -a architectures/ecommerce-platform.json \
      -t templates/ops/service-runbook.md \
      -o docs/ops/service-runbooks.md
    calm docify -a architectures/ecommerce-platform.json \
      -t templates/ops/oncall-reference.md \
      -o docs/ops/oncall-reference.md
    calm docify -a architectures/ecommerce-platform.json \
      -t templates/ops/flow-support-guide.md \
      -o docs/ops/flow-support-guide.md
```

**Benefits:**
- Documentation never goes stale
- No manual effort to keep docs updated
- Changes to architecture are automatically reflected
- Single source of truth for both architecture and docs

### 9. Commit Your Work

```bash
git add templates/ops/ docs/ops/
git commit -m "Day 16: Generate operations documentation with docify templates"
git tag day-16
```

## Key Concepts

### Template → Generated Doc Flow

```
Architecture JSON (source of truth)
    │
    ├── templates/ops/service-runbook.md (Handlebars template)
    │                    │
    │                    ▼  calm docify
    │              docs/ops/service-runbooks.md (generated)
    │
    ├── templates/ops/oncall-reference.md
    │                    │
    │                    ▼  calm docify
    │              docs/ops/oncall-reference.md
    │
    └── templates/ops/flow-support-guide.md
                         │
                         ▼  calm docify
                   docs/ops/flow-support-guide.md
```

### CI/CD Integration Options

| Strategy | Trigger | When to Use |
|----------|---------|-------------|
| On every PR | Architecture file changed | Catch stale docs before merge |
| On merge to main | Always | Keep published docs current |
| Scheduled | Nightly | Safety net for out-of-band changes |

## Resources

- [Handlebars Templating](https://handlebarsjs.com/guide/)
- [CALM Docify Documentation](https://github.com/finos/architecture-as-code/tree/main/cli#docify)
- [Google SRE Runbook Best Practices](https://sre.google/sre-book/effective-troubleshooting/)

## Next Steps

In the [next tutorial](./17-patterns), you'll create your first CALM Pattern — turning architecture templates into reusable, enforceable scaffolds that can both generate new architectures and validate existing ones!
