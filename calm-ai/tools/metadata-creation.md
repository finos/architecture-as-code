# CALM Metadata Creation Guide

## Critical Requirements

🚨 **ALWAYS call the metadata creation tool before adding metadata**

## Official JSON Schema Definition

The complete metadata schema from the FINOS CALM v1.0 specification:

```json
{
    "metadata": {
        "oneOf": [
            {
                "type": "array",
                "items": {
                    "type": "object"
                }
            },
            {
                "type": "object",
                "additionalProperties": true
            }
        ]
    }
}
```

## Metadata Structure Options

Metadata can be defined in TWO ways:

### Option 1: Single Object

```json
"metadata": {
    "version": "1.0.0",
    "owner": "Platform Team",
    "environment": "production"
}
```

### Option 2: Array of Objects

```json
"metadata": [
    {
        "version": "1.0.0",
        "owner": "Platform Team"
    },
    {
        "environment": "production",
        "deployed": "2025-01-15"
    }
]
```

## Metadata Locations

Metadata can be added to:

- Architecture level (top-level)
- Node level
- Relationship level
- Flow level

## Metadata Examples by Level

### Document Level (Architecture)

Metadata at the document level describes the overall architecture:

```json
{
    "calm-version": "1.0.0",
    "architecture-version": "1.0.0",
    "metadata": {
        "title": "Trading Platform Architecture",
        "version": "2.1.0",
        "created": "2025-01-15T10:00:00Z",
        "last-updated": "2025-09-22T14:30:00Z",
        "owner": "Platform Architecture Team",
        "business-domain": "Capital Markets",
        "compliance": ["SOX", "FINRA", "GDPR"],
        "environment": "production",
        "review-cycle": "quarterly",
        "next-review": "2025-12-15"
    },
    "nodes": [...],
    "relationships": [...]
}
```

### Node Level

Metadata for individual components/services:

```json
{
    "unique-id": "trading-api-service",
    "node-type": "service",
    "name": "Trading API Service",
    "description": "Core trading operations API",
    "metadata": {
        "version": "3.2.1",
        "owner": "Trading Team",
        "runtime": "Java 17",
        "framework": "Spring Boot 3.1",
        "deployed-on": "Kubernetes",
        "namespace": "trading-prod",
        "replicas": 5,
        "cpu-request": "1000m",
        "memory-request": "2Gi",
        "cpu-limit": "2000m",
        "memory-limit": "4Gi",
        "health-check": "/actuator/health",
        "metrics-endpoint": "/actuator/prometheus",
        "log-level": "INFO",
        "business-criticality": "high",
        "data-classification": "confidential",
        "last-deployed": "2025-09-20T08:15:00Z",
        "deployment-strategy": "rolling-update"
    },
    "interfaces": [...]
}
```

### Relationship Level

Metadata for connections between components:

```json
{
    "unique-id": "api-to-database-connection",
    "relationship-type": "connects",
    "from": "trading-api-service",
    "to": "trading-database",
    "description": "Trading API connects to primary database",
    "metadata": {
        "protocol": "TCP/PostgreSQL",
        "port": 5432,
        "connection-pool-size": 20,
        "connection-timeout": "30s",
        "idle-timeout": "10m",
        "max-lifetime": "30m",
        "ssl-enabled": true,
        "ssl-mode": "require",
        "monitoring": "connection-pool-metrics",
        "failover": "read-replica-available",
        "backup-strategy": "daily-snapshots",
        "performance-sla": "< 100ms p95",
        "established": "2025-01-15T10:00:00Z",
        "last-tested": "2025-09-22T06:00:00Z"
    }
}
```

### Flow Level

Metadata for data/process flows:

```json
{
    "unique-id": "trade-execution-flow",
    "description": "End-to-end trade execution process",
    "metadata": [
        {
            "business-process": "Trade Execution",
            "owner": "Trading Operations",
            "sla": "< 500ms end-to-end",
            "throughput": "10,000 trades/second peak",
            "availability": "99.99%",
            "recovery-time": "< 30 seconds"
        },
        {
            "monitoring": {
                "metrics": ["latency", "throughput", "error-rate"],
                "alerts": ["high-latency", "failed-trades", "circuit-breaker"],
                "dashboards": ["trading-overview", "performance-metrics"]
            }
        },
        {
            "compliance": {
                "audit-trail": "required",
                "data-retention": "7 years",
                "encryption": "AES-256",
                "access-controls": "RBAC",
                "regulations": ["MiFID II", "FINRA", "SOX"]
            }
        }
    ],
    "steps": [...]
}
```

## Common Use Cases

**Operational Information (Single Object):**

```json
"metadata": {
    "version": "2.3.1",
    "owner": "API Team",
    "runtime": "Java 17",
    "deployed-on": "Kubernetes",
    "replicas": 3,
    "last-deployed": "2025-06-20T14:30:00Z"
}
```

**Compliance & Governance (Single Object):**

```json
"metadata": {
    "compliance": "SOX, FINRA",
    "data-classification": "Confidential",
    "last-reviewed": "2025-06-15",
    "business-owner": "Trading Operations",
    "criticality": "high"
}
```

**Infrastructure Details (Array Format):**

```json
"metadata": [
    {
        "infrastructure": {
            "cpu-limit": "2000m",
            "memory-limit": "4Gi",
            "health-check": "/actuator/health"
        }
    },
    {
        "monitoring": {
            "system": "Prometheus + Grafana",
            "logging": "ELK Stack"
        }
    }
]
```

## Validation Rules

1. Can use either format:
    - Single object: `"metadata": { ... }`
    - Array of objects: `"metadata": [{ ... }, { ... }]`
2. Single object allows any properties (`additionalProperties: true`)
3. Array items must be objects: `{}`
4. No restrictions on object properties or structure
5. Empty objects/arrays are valid: `"metadata": {}` or `"metadata": []`

## Best Practices

- Use single object format for simple, flat metadata
- Use array format when grouping related metadata logically
- Use consistent naming conventions
- Include timestamps in ISO 8601 format
- Consider automation and tooling consumption
- Validate against CALM schema
