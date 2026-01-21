# Day 6: Document with Metadata

## Overview
Add metadata to your architecture to document ownership, versioning, and other important contextual information.

## Objective and Rationale
- **Objective:** Add metadata at multiple levels (architecture, nodes, relationships) to make your architecture discoverable, maintainable, and traceable
- **Rationale:** Metadata transforms architecture files from anonymous diagrams into living documentation. It answers: Who owns this? When was it created? What version is it? What tags/categories apply? This is critical for governance, discoverability, and long-term maintenance.

## Requirements

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
    {
      "key": "owner",
      "value": "platform-team@example.com"
    },
    {
      "key": "version",
      "value": "1.0.0"
    }
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
    "description": "Authentication system architecture for Advent of CALM learning",
    "tags": ["learning", "authentication", "microservices"],
    "status": "draft"
  },
  "nodes": [
    ...
  ],
  "relationships": [
    ...
  ]
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

**Review the output:**
- ✅ Service node now has a `metadata` property
- ✅ Metadata is specific to that node (not the whole architecture)

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

### 6. Update Your README

Update your README.md progress:
```markdown
- [x] Day 1: Install CALM CLI and Initialize Repository
- [x] Day 2: Create Your First Node
- [x] Day 3: Connect Nodes with Relationships
- [x] Day 4: Install CALM VSCode Extension
- [x] Day 5: Add Interfaces to Nodes
- [x] Day 6: Document with Metadata
```

### 7. Commit Your Work

```bash
git add architectures/my-first-architecture.json README.md
git commit -m "Day 6: Add metadata at architecture, node, and relationship levels"
git tag day-6
```

## Deliverables 

Your Day 6 submission should include a commit tagged `day-6` containing:

✅ **Required Files:**
- `architectures/my-first-architecture.json` - Valid CALM architecture with:
  - Top-level metadata (owner, version, created, description, tags)
  - At least one node with metadata (service node recommended)
  - At least one relationship with metadata (connects relationship recommended)
- Updated `README.md` - Day 5 marked as complete

## Resources
- [CALM Core Schema - Metadata Definition](https://github.com/finos/architecture-as-code/blob/main/calm/release/1.1/meta/core.json#L309-L322)
- [JSON Schema additionalProperties](https://json-schema.org/understanding-json-schema/reference/object#additionalproperties)

## Tips
- **Use the object format** unless you have a specific reason to use arrays
- **Be consistent**: If you use certain metadata keys at the architecture level, consider using them at the node level too
- **Common metadata properties**:
  - **Ownership**: owner, tech-owner, business-owner, team
  - **Versioning**: version, created, updated, deprecated-date
  - **Classification**: tags, environment, tier, criticality
  - **Compliance**: compliance-level, data-classification, regulatory-requirements
  - **Operations**: monitoring, alerting, sla-tier, support-hours
  - **Cost**: cost-center, budget-code, pricing-tier
- Metadata is **flexible** - you can add any properties that make sense for your organization
- Think about **searchability** - metadata makes architectures discoverable in a CALM Hub

## Common Pitfalls

**"What metadata should I include?"**
- Start with basics: owner, version, created, description
- Add operational metadata: environment, tier, monitoring
- Consider your organization's governance needs
- Think about what would help you find this architecture in 6 months

**"Object vs Array format - which should I use?"**
- **Object**: Simpler, more readable, easier to query → use this 99% of the time
- **Array**: More structured, allows duplicate keys → rarely needed
- Both are valid, but object format is preferred

**"Can I add metadata to interfaces?"**
- Interfaces don't have a dedicated metadata property in CALM 1.1
- But inline interfaces support `additionalProperties: true`, so you can add custom properties directly

**"Should metadata be the same at all levels?"**
- No! Different levels have different concerns:
  - **Architecture-level**: System-wide ownership, version, purpose
  - **Node-level**: Component-specific ownership, tech stack, deployment
  - **Relationship-level**: Connection SLAs, monitoring, circuit breakers

## Quick Reference: Metadata Examples

**Architecture-level:**
```json
{
  "metadata": {
    "owner": "platform-team@example.com",
    "version": "2.1.0",
    "created": "2024-06-01",
    "updated": "2025-01-15",
    "description": "Customer authentication and authorization system",
    "environment": "production",
    "tags": ["security", "identity", "critical"],
    "compliance": ["SOC2", "GDPR"],
    "documentation": "https://wiki.example.com/auth-system"
  }
}
```

**Node-level:**
```json
{
  "metadata": {
    "tech-owner": "identity-team@example.com",
    "repository": "https://github.com/example/auth-service",
    "programming-language": "Java",
    "framework": "Spring Boot",
    "deployment-type": "kubernetes",
    "container-image": "example/auth-service:2.1.0",
    "sla-tier": "tier-1",
    "on-call": "identity-team-oncall"
  }
}
```

## Next Steps
Tomorrow (Day 7) you'll bring everything together by creating a complete e-commerce microservice architecture with multiple nodes, relationships, interfaces, and metadata - a real-world example you can use as a reference!
