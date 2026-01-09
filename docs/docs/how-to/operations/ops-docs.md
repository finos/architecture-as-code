---
id: ops-docs
title: Create Operations Docs
sidebar_position: 3
---

# How to Create Operations Documentation

🟡 **Difficulty:** Intermediate | ⏱️ **Time:** 20-30 minutes

Generate comprehensive operations documentation from your CALM architecture, including runbooks, deployment checklists, and incident response guides.

## When to Use This

Use this guide when you need to:
- Create runbooks for operations teams
- Document deployment procedures
- Build incident response guides
- Generate service catalogs

## Quick Start

Create a template that pulls from your architecture:

```markdown
---
architecture: ../architectures/my-system.json
---

# Operations Runbook

## Services

{{table nodes columns="unique-id,name,node-type,description"}}
```

## Step-by-Step

### 1. Create a Service Runbook Template

**File:** `templates/runbook.md`

```markdown
---
architecture: ../architectures/my-system.json
---

# {{metadata.name}} Runbook

## Overview

{{metadata.description}}

**Owner:** {{metadata.owner}}

## Architecture

{{block-architecture this}}

## Service Inventory

{{table nodes columns="unique-id,name,node-type,description"}}

## Service Details

{{#each nodes}}
### {{name}}

- **ID:** `{{unique-id}}`
- **Type:** {{node-type}}
- **Description:** {{description}}

{{#if interfaces}}
#### Endpoints

| Interface | Port |
|-----------|------|
{{#each interfaces}}
| {{unique-id}} | {{port}} |
{{/each}}
{{/if}}

---
{{/each}}
```

### 2. Create Deployment Checklist

**File:** `templates/deployment-checklist.md`

```markdown
---
architecture: ../architectures/my-system.json
---

# Deployment Checklist: {{metadata.name}}

## Pre-Deployment

- [ ] All tests passing
- [ ] Code review approved
- [ ] Change request approved
- [ ] Rollback plan documented
- [ ] Stakeholders notified

## Services to Deploy

{{#each nodes}}
- [ ] {{name}} (`{{unique-id}}`)
{{/each}}

## Post-Deployment

- [ ] Smoke tests passing
- [ ] Monitoring dashboards verified
- [ ] Error rates normal
- [ ] Performance within SLA
```

### 3. Create Incident Response Guide

**File:** `templates/incident-response.md`

```markdown
---
architecture: ../architectures/my-system.json
---

# Incident Response Guide

## Escalation Matrix

| Severity | Response Time | Escalation |
|----------|---------------|------------|
| P1 | 15 min | On-Call → Lead → Director |
| P2 | 1 hour | On-Call → Lead |
| P3 | 4 hours | On-Call |
| P4 | 24 hours | Ticket Queue |

## System Dependencies

Understanding dependencies helps identify blast radius:

{{block-architecture this}}

## Service Contacts

{{#each nodes}}
{{#if metadata.owner}}
- **{{name}}:** {{metadata.owner}}
{{/if}}
{{/each}}

## Common Incidents

### Service Unavailable

**Symptoms:** 5xx errors, health check failures

**Investigation:**
1. Check pod status: `kubectl get pods -l app={{service}}`
2. Review logs: `kubectl logs -l app={{service}}`
3. Check dependencies

**Resolution:**
1. Restart if memory/crash issue
2. Scale up if load-related
3. Rollback if deployment-related
```

### 4. Generate Documentation

```bash
# Generate runbook
calm docify \
  --input templates/runbook.md \
  --output docs/runbook.md \
  --architecture architectures/my-system.json

# Generate all ops docs
for template in templates/*.md; do
  calm docify \
    --input "$template" \
    --output "docs/$(basename "$template")" \
    --architecture architectures/my-system.json
done
```

### 5. Automate in CI/CD

```yaml
# .github/workflows/ops-docs.yml
name: Generate Ops Docs

on:
  push:
    paths:
      - 'architectures/**'
      - 'templates/**'

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install -g @finos/calm-cli
      - run: |
          mkdir -p docs/ops
          for template in templates/ops-*.md; do
            calm docify \
              --input "$template" \
              --output "docs/ops/$(basename "$template")"
          done
      - uses: stefanzweifel/git-auto-commit-action@b863ae1933cb653a53c021fe36dbb774e1fb9403 # v5
```

## Template Patterns

### Health Check Table

```handlebars
## Health Checks

| Service | Endpoint | Expected |
|---------|----------|----------|
{{#each nodes}}
{{#if healthCheck}}
| {{name}} | `{{healthCheck.endpoint}}` | {{healthCheck.status}} |
{{/if}}
{{/each}}
```

### Dependency Matrix

```handlebars
## Dependencies

| Service | Depends On |
|---------|------------|
{{#each nodes}}
| {{name}} | {{#each dependencies}}{{this}}{{#unless @last}}, {{/unless}}{{/each}} |
{{/each}}
```

### On-Call Rotation

```handlebars
## On-Call Contacts

{{#each nodes}}
{{#if metadata.oncall}}
### {{name}}
- **Team:** {{metadata.oncall}}
- **Slack:** #{{metadata.slackChannel}}
{{/if}}
{{/each}}
```

## Best Practices

:::tip Keep Templates Generic
Design templates that work across multiple architectures
:::

:::tip Add Operational Metadata
Enrich your architecture with owner, oncall, and SLA information
:::

:::tip Regenerate on Change
Use CI/CD to keep ops docs synchronized with architecture
:::

:::tip Test Procedures
Regularly validate runbook procedures in non-production
:::

## Related Guides

- [Operations Advisor](ops-advisor) - AI-assisted ops analysis
- [Generate Documentation](../documentation/docify) - Basic docify usage
- [Custom Templates](../documentation/custom-widgets) - Advanced templating
