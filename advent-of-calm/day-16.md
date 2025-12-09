# Day 16: Generate Operations Documentation with Docify

## Overview

Use CALM docify to generate support documentation and incident report templates directly from your architecture's operational metadata.

## Objective and Rationale

- **Objective:** Create Handlebars templates that generate runbooks, on-call guides, and incident report templates from your architecture metadata
- **Rationale:** Yesterday you enriched your architecture with operational metadata (owners, health endpoints, failure modes, escalation paths). Today, use docify to transform that metadata into ready-to-use operations documents. This ensures your support docs always match your actual architecture - no more stale wikis!

## Requirements

### 1. Understand the Ops Documentation Goal

Your Day 13 architecture now contains:

- Owner and on-call contacts per service
- Health endpoints and runbook links
- Failure modes with symptoms and remediation
- Business impact per flow
- Monitoring dashboard links

Today you'll create templates that extract this into:

1. **Service Runbook** - Per-service troubleshooting guide
2. **On-Call Quick Reference** - Single-page contact sheet
3. **Incident Report Template** - Pre-filled incident form

### 2. Create the Ops Template Directory

```bash
mkdir -p templates/ops
```

### 3. Create the Service Runbook Template

**File:** `templates/ops/service-runbook.md`

**Content:**

```handlebars
# Service Runbooks

Generated from architecture: {{metadata.name}}
Generated on: {{now}}

---

{{#each nodes}}
{{#if (eq node-type "service")}}
## {{name}}

**Unique ID:** `{{unique-id}}`
**Type:** {{node-type}}

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
- **Log Query:** `{{metadata.log-query}}`

### Dependencies

{{#if metadata.dependencies}}
This service depends on:
{{#each metadata.dependencies}}
- {{this}}
{{/each}}
{{else}}
No dependencies documented.
{{/if}}

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

## Quick Links

| Service | Health Check | Dashboard | Runbook |
|---------|--------------|-----------|---------|
{{#each nodes}}
{{#if (eq node-type "service")}}
| {{name}} | `{{metadata.health-endpoint}}` | [Dashboard]({{metadata.dashboard}}) | [Runbook]({{metadata.runbook}}) |
{{/if}}
{{/each}}
```

### 4. Create the On-Call Quick Reference Template

**File:** `templates/ops/oncall-reference.md`

**Content:**

```handlebars
# On-Call Quick Reference

**Architecture:** {{metadata.name}}
**Generated:** {{now}}

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

**Flow Path:**
{{#each transitions}}
{{@index}}. {{relationship-unique-id}}
{{/each}}

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

## Escalation Matrix

| Tier | Response Time | Escalation Path |
|------|---------------|-----------------|
| tier-1 | 15 minutes | Page immediately, all-hands |
| tier-2 | 30 minutes | Page on-call, notify manager |
| tier-3 | 2 hours | Slack notification, next business day OK |
```

### 5. Create the Flow Support Guide Template

Generate support documentation organized by business flows - helping support teams understand end-to-end processes.

**File:** `templates/ops/flow-support-guide.md`

**Content:**

```handlebars
# Business Flow Support Guide

**Architecture:** {{metadata.name}}
**Generated:** {{now}}

This guide documents each business flow, the services involved, and troubleshooting steps for support teams.

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

This flow traverses the following relationships:

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

### Escalation

If this flow is critical (tier-1), escalate immediately to the service owners.

---

{{/each}}

## Quick Reference: All Flows

| Flow | Business Impact | SLA |
|------|-----------------|-----|
{{#each flows}}
| {{name}} | {{metadata.business-impact}} | {{metadata.sla}} |
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
- On-call reference has correct contacts and escalation info
- Flow support guide documents each business flow with its impact and troubleshooting steps

**Take screenshots** of each generated document for your deliverables.

### 8. Integrate with CI/CD for Always Up-to-Date Docs

Now that you can generate documentation from your architecture, integrate it into your CI/CD pipeline so docs are always current.

**Key insight:** Your architecture is the source of truth. When it changes, your docs should automatically regenerate.

**Options for integration:**

1. **On every PR:** Regenerate docs and commit them back
2. **On merge to main:** Regenerate and deploy to documentation site
3. **Scheduled:** Regenerate nightly to catch any drift

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
- Changes to architecture automatically reflected
- Single source of truth for both code and docs

### 9. Commit Your Work

```bash
git add templates/ops/ docs/ops/
git commit -m "Day 14: Generate operations documentation with docify templates"
git tag day-16
```

## Deliverables

✅ **Required:**

- `templates/ops/service-runbook.md` - Handlebars template for service runbooks
- `templates/ops/oncall-reference.md` - On-call quick reference template
- `templates/ops/flow-support-guide.md` - Flow-based support guide template
- `docs/ops/service-runbooks.md` - Generated service runbooks
- `docs/ops/oncall-reference.md` - Generated on-call reference
- `docs/ops/flow-support-guide.md` - Generated flow support guide
- Screenshots of generated documents
- Updated `README.md` - Day 16 marked complete

✅ **Validation:**

```bash
# Verify templates exist
ls templates/ops/*.md

# Verify generated docs exist
ls docs/ops/*.md

# Verify content was generated
grep -q "failure-modes" docs/ops/service-runbooks.md
grep -q "On-Call" docs/ops/oncall-reference.md
grep -q "Business Flow" docs/ops/flow-support-guide.md

# Check tag
git tag | grep -q "day-16"
```

## Resources

- [Handlebars Templating](https://handlebarsjs.com/guide/)
- [CALM Docify Documentation](https://github.com/finos/architecture-as-code/tree/main/cli#docify)
- [Incident Management Templates](https://www.atlassian.com/incident-management/postmortem/templates)
- [Google SRE Runbook Best Practices](https://sre.google/sre-book/effective-troubleshooting/)

## Tips

- Regenerate docs whenever architecture changes - add to CI/CD
- Keep templates generic; let architecture metadata provide specifics
- Add more failure modes as you learn from incidents
- Link incident reports back to architecture to close the feedback loop
- Consider templating different formats (HTML, PDF) for different audiences
- The incident report checkboxes help ensure nothing is missed during stressful incidents

## Next Steps

Tomorrow (Day 17) you'll create your first CALM pattern - turning architecture into reusable, enforceable templates!
