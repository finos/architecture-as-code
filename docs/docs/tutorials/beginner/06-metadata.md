---
id: 06-metadata
title: "6. Document with Metadata"
sidebar_position: 6
---

# Tutorial 6: Document with Metadata

🟢 **Difficulty:** Beginner | ⏱️ **Time:** 20-30 minutes

## Overview

Add metadata to your architecture to document ownership, versioning, and other important contextual information.

## Learning Objectives

By the end of this tutorial, you will:
- Understand metadata levels in CALM (architecture, node, relationship)
- Add metadata using both object and array formats
- Document ownership, versioning, and operational context
- Make your architectures discoverable and maintainable

## Prerequisites

Complete [Tutorial 5: Add Interfaces to Your Nodes](05-interfaces) first.

## Step-by-Step Guide

### 1. Understand CALM Metadata

Metadata in CALM can be added at three levels:
1. **Architecture-level**: Overall metadata for the entire system
2. **Node-level**: Metadata specific to individual components
3. **Relationship-level**: Metadata about connections

**CALM supports two metadata formats:**

**Format 1: Object (Most Common)**
```json
{
  "metadata": {
    "owner": "platform-team@example.com",
    "version": "1.0.0",
    "created": "2025-01-01",
    "environment": "production",
    "cost-center": "CC-12345",
    "tags": ["critical", "customer-facing"]
  }
}
```

**Format 2: Array of Objects**
```json
{
  "metadata": [
    { "key": "owner", "value": "platform-team@example.com" },
    { "key": "version", "value": "1.0.0" }
  ]
}
```

**When to use which:**
- **Object format**: Simpler, more readable, best for most cases
- **Array format**: When you need duplicate keys or want a more structured format

### 2. Add Architecture-Level Metadata

Open `architectures/my-first-architecture.json` in VSCode.

**Prompt:**
```text
Update architectures/my-first-architecture.json to add top-level metadata.

The metadata should include:
- owner: your email or team name
- version: "1.0.0"
- created: today's date
- description: a brief description of what this architecture represents
- tags: an array of relevant tags (e.g., ["learning", "authentication", "demo"])

Use the object format for metadata.

Ensure the file still validates against CALM 1.1.
```

**Review the output:**
- ✅ `metadata` property added at the root level (same level as `nodes` and `relationships`)
- ✅ Contains owner, version, created, description, and tags
- ✅ Uses object format (not array)

**Example result:**
```json
{
  "$schema": "https://calm.finos.org/release/1.1/meta/calm.json",
  "metadata": {
    "owner": "jane.doe@example.com",
    "version": "1.0.0",
    "created": "2025-01-15",
    "description": "Authentication system architecture for CALM learning",
    "tags": ["learning", "authentication", "microservices"],
    "status": "draft"
  },
  "nodes": [...],
  "relationships": [...]
}
```

### 3. Add Node-Level Metadata

Add metadata to your service node to document technical ownership.

**Prompt:**
```text
Update the service node in architectures/my-first-architecture.json to add metadata.

The node metadata should include:
- tech-owner: the team that maintains this service
- repository: a placeholder URL to the code repository
- deployment-type: "container" or "serverless" or similar
- sla-tier: "tier-1", "tier-2", etc.

Use the object format for metadata.
```

**Example result:**
```json
{
  "unique-id": "auth-service",
  "node-type": "service",
  "name": "Authentication Service",
  "description": "Handles user authentication",
  "interfaces": [...],
  "metadata": {
    "tech-owner": "identity-team@example.com",
    "repository": "https://github.com/example/auth-service",
    "deployment-type": "container",
    "sla-tier": "tier-1",
    "programming-language": "Java"
  }
}
```

### 4. Add Relationship-Level Metadata

Add metadata to a relationship to document SLA or monitoring information.

**Prompt:**
```text
Update the connects relationship in architectures/my-first-architecture.json to add metadata.

The relationship metadata should include:
- latency-sla: "< 100ms" or similar
- monitoring: true
- circuit-breaker: true or false

Use the object format for metadata.
```

**Example result:**
```json
{
  "unique-id": "service-to-db",
  "description": "Service connects to database for user data",
  "relationship-type": {
    "connects": {...}
  },
  "metadata": {
    "latency-sla": "< 50ms",
    "monitoring": true,
    "circuit-breaker": true,
    "retry-policy": "exponential-backoff"
  }
}
```

### 5. Try the Array Format (Optional)

Experiment with the array format to understand the difference.

**Prompt:**
```text
Show me how the metadata on my service node would look using the array format instead of the object format. Explain when I would choose one over the other.
```

### 6. Validate Your Architecture

```bash
calm validate -a architectures/my-first-architecture.json
```

## Key Concepts

### Metadata Levels

| Level | Scope | Example Properties |
|-------|-------|-------------------|
| Architecture | Entire system | owner, version, environment |
| Node | Single component | tech-owner, repository, sla-tier |
| Relationship | Single connection | latency-sla, monitoring, circuit-breaker |

### Why Metadata Matters

Metadata transforms architecture files from anonymous diagrams into living documentation:
- **Discoverability**: Find who owns what
- **Traceability**: Track versions and changes
- **Governance**: Meet compliance requirements
- **Operations**: Know where to look when things break

### Common Metadata Properties

| Property | Purpose |
|----------|---------|
| `owner` | Who is responsible |
| `version` | Current version |
| `created` / `modified` | Timestamps |
| `environment` | dev/staging/prod |
| `cost-center` | Financial allocation |
| `tags` | Categorization |
| `repository` | Source code location |
| `sla-tier` | Service level |

## Resources

- [CALM Metadata Schema](https://github.com/finos/architecture-as-code/blob/main/calm/release/1.1/meta/core.json)
- [JSON Schema Documentation](https://json-schema.org/)

## Tips

- Use consistent metadata keys across your architectures
- Document metadata conventions in your team's guidelines
- Object format is usually easier to read and write
- Consider what questions stakeholders might ask about your architecture

## Next Steps

In [Tutorial 7](07-complete-architecture), you'll consolidate everything by building a complete e-commerce microservice architecture!
