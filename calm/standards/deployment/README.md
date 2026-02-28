# Deployment Decorator Standards

This directory contains standardized deployment decorator schemas for tracking deployment information across various platforms and environments.

## Overview

Deployment decorators attach deployment tracking information to architecture elements without modifying the core architecture definition. They enable tracking of deployment status, timing, observability links, and platform-specific details across the architecture lifecycle.

## Base Deployment Decorator

The base deployment decorator standard (`deployment.decorator.schema.json`) defines common deployment attributes applicable across all platforms:

- **start-time**: ISO 8601 timestamp of when the deployment started (required)
- **status**: Current deployment status (pending, in-progress, completed, failed, rolled-back) (required)
- **end-time**: ISO 8601 timestamp of when the deployment completed or failed
- **environment**: Target environment (e.g., production, staging, development)
- **observability**: URI linking to logs, metrics, or observability dashboards
- **notes**: Free-form notes or comments about the deployment

## Platform-Specific Extensions

Platform-specific deployment decorators extend the base deployment standard and add platform-specific attributes:

- **Kubernetes**: Helm charts, clusters, namespaces (example provided)
- **AWS**: ECS services, CloudFormation stacks, regions
- **Azure**: Resource groups, subscriptions, deployment slots
- **Google Cloud**: Projects, regions, deployment managers

## Usage

### Basic Deployment Decorator

```json
{
  "$schema": "https://calm.finos.org/standards/deployment/deployment.decorator.schema.json",
  "unique-id": "api-service-deployment-001",
  "type": "deployment",
  "target": ["my-architecture.json"],
  "applies-to": ["api-service"],
  "data": {
    "start-time": "2026-02-23T10:00:00Z",
    "end-time": "2026-02-23T10:05:00Z",
    "status": "completed",
    "environment": "production",
    "observability": "https://grafana.example.com/d/api-service",
    "notes": "Successful deployment with zero downtime"
  }
}
```

### Kubernetes Deployment Decorator (Example)

```json
{
  "$schema": "https://calm.finos.org/standards/deployment/deployment.decorator.schema.json",
  "unique-id": "k8s-deployment-001",
  "type": "deployment",
  "target": ["my-architecture.json"],
  "applies-to": ["api-service"],
  "data": {
    "start-time": "2026-02-23T10:00:00Z",
    "end-time": "2026-02-23T10:08:00Z",
    "status": "completed",
    "environment": "production",
    "observability": "https://grafana.example.com/d/k8s-prod",
    "notes": "Rolling update with new features",
    "kubernetes": {
      "helm-chart": "my-api:1.2.3",
      "cluster": "prod-us-west-01",
      "namespace": "production"
    }
  }
}
```

## Standard Inheritance

```
decorators.json (base decorator)
  └── deployment.decorator.schema.json (deployment standard)
        └── Platform-specific extensions (add platform sub-objects in data)
```

## Contributing

To contribute new platform-specific deployment decorators:

1. Use the base `deployment.decorator.schema.json` standard
2. Add platform-specific properties in a namespaced sub-object within `data`
3. Provide comprehensive examples demonstrating the platform-specific fields
4. Document all required and optional fields
5. Submit examples to the `examples/` directory
