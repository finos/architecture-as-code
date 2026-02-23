# Deployment Decorator Examples

This directory contains example deployment decorator instances demonstrating various use cases and patterns.

## Examples Overview

| Example | Schema | Demonstrates |
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
    "deployment-status": "failed",
    "deployment-notes": "Deployment failed due to..."
  }
}
```

See: `failed-deployment.decorator.json`

## Platform-Specific Examples

### Kubernetes

Use the Kubernetes decorator schema when deploying to Kubernetes clusters:

- Include Helm chart information
- Specify cluster and namespace
- Track workload type and replicas
- Reference ConfigMaps and Secrets

See: `kubernetes-deployment.decorator.json`

## Best Practices

1. **Unique IDs**: Use descriptive unique-id values that include the service name and deployment identifier
2. **Timestamps**: Always use ISO 8601 format with timezone (preferably UTC)
3. **Observability Links**: Link to deployment-specific dashboards or filtered log views
4. **Notes**: Include context about what changed, why, and any issues encountered
5. **Environment Clarity**: Always specify the target environment when relevant

## Validation

Validate decorator instances using the CALM CLI:

```bash
# Validate a deployment decorator
calm validate --schema https://calm.finos.org/standards/deployment/deployment.decorator.schema.json \
  simple-deployment.decorator.json

# Validate a Kubernetes deployment decorator
calm validate --schema https://calm.finos.org/standards/deployment/kubernetes.decorator.schema.json \
  kubernetes-deployment.decorator.json
```
