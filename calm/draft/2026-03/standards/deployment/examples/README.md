# Deployment Decorator Examples

This directory contains example deployment decorator instances demonstrating various use cases and patterns.

## Examples Overview

| Example | Standard | Demonstrates |
|---------|--------|-------------|
| `simple-deployment.decorator.json` | Base deployment | Successful deployment with all optional fields |
| `kubernetes-deployment.decorator.json` | Kubernetes-specific | Multi-service deployment with Kubernetes details |
| `failed-deployment.decorator.json` | Base deployment | Failed deployment with rollback notes |
| `multi-target-deployment.decorator.json` | Kubernetes-specific | Coordinated deployment across multiple architectures |

## Usage Patterns

### Single Service Deployment

The simplest case - tracking a deployment for one service in one architecture:

```json
{
  "target": ["my-architecture.json"],
  "applies-to": ["my-service"]
}
```

See: `simple-deployment.decorator.json`

### Multi-Service Deployment

Track a single deployment event that affects multiple services (e.g., coordinated release):

```json
{
  "target": ["my-architecture.json"],
  "applies-to": ["service-a", "service-b", "service-c"]
}
```

See: `kubernetes-deployment.decorator.json`

### Cross-Architecture Deployment

Track a deployment that spans multiple architecture documents:

```json
{
  "target": [
    "frontend-architecture.json",
    "backend-architecture.json"
  ],
  "applies-to": ["react-app", "api-gateway", "bff"]
}
```

See: `multi-target-deployment.decorator.json`

### Failed Deployment

Document deployment failures with context for troubleshooting:

```json
{
  "data": {
    "status": "failed",
    "notes": "Deployment failed due to..."
  }
}
```

See: `failed-deployment.decorator.json`

## Platform-Specific Examples

### Kubernetes

When deploying to Kubernetes clusters, add Kubernetes-specific information as a sub-object:

- Include Helm chart version
- Specify cluster and namespace

See: `kubernetes-deployment.decorator.json`

## Best Practices

1. **Unique IDs**: Use descriptive unique-id values that include the service name and deployment identifier
2. **Target Type**: Always include `"target-type": ["architecture"]` as deployment decorators only target architecture files
3. **Timestamps**: Always use ISO 8601 format with timezone (preferably UTC)
4. **Observability Links**: Link to deployment-specific dashboards or filtered log views
5. **Notes**: Include context about what changed, why, and any issues encountered

## Validation

Validate decorator instances using the CALM CLI:

```bash
# Validate a deployment decorator
calm validate --schema https://calm.finos.org/draft/2026-03/standards/deployment/deployment.decorator.standard.json \
  simple-deployment.decorator.json

# Validate a Kubernetes-specific deployment decorator
calm validate --schema https://calm.finos.org/draft/2026-03/standards/deployment/kubernetes.decorator.standard.json \
  kubernetes-deployment.decorator.json
```
