# Deployment Decorator Standards

This directory contains standardized deployment decorator schemas for tracking deployment information across various platforms and environments.

## Overview

Deployment decorators attach deployment tracking information to architecture elements without modifying the core architecture definition. They enable tracking of deployment status, timing, observability links, and platform-specific details across the architecture lifecycle.

## Base Deployment Decorator

The base deployment decorator schema (`deployment.decorator.schema.json`) defines common deployment attributes applicable across all platforms:

- **deployment-start-time**: ISO 8601 timestamp of when the deployment started (required)
- **deployment-status**: Current deployment status (in-progress, completed, failed, rolled-back, pending) (required)
- **deployment-end-time**: ISO 8601 timestamp of when the deployment completed or failed
- **deployment-environment**: Target environment (e.g., production, staging, development)
- **deployment-observability**: URI linking to logs, metrics, or observability dashboards
- **deployment-notes**: Free-form notes or comments about the deployment

## Platform-Specific Extensions

Platform-specific deployment decorators extend the base deployment schema and add platform-specific attributes:

- **Kubernetes**: Helm charts, clusters, namespaces
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
    "deployment-start-time": "2026-02-23T10:00:00Z",
    "deployment-end-time": "2026-02-23T10:05:00Z",
    "deployment-status": "completed",
    "deployment-environment": "production",
    "deployment-observability": "https://grafana.example.com/d/api-service",
    "deployment-notes": "Successful deployment with zero downtime"
  }
}
```

### Kubernetes Deployment Decorator

```json
{
  "$schema": "https://calm.finos.org/standards/deployment/kubernetes.decorator.schema.json",
  "unique-id": "k8s-deployment-001",
  "type": "deployment",
  "target": ["my-architecture.json"],
  "applies-to": ["api-service"],
  "data": {
    "deployment-start-time": "2026-02-23T10:00:00Z",
    "deployment-end-time": "2026-02-23T10:08:00Z",
    "deployment-status": "completed",
    "deployment-environment": "production",
    "deployment-observability": "https://grafana.example.com/d/k8s-prod",
    "deployment-notes": "Rolling update with new features",
    "kubernetes": {
      "helm-chart": "my-api:1.2.3",
      "cluster": "prod-us-west-01",
      "namespace": "production"
    }
  }
}
```

## Schema Inheritance

```
decorators.json (base decorator)
  └── deployment.decorator.schema.json (deployment attributes)
        ├── kubernetes.decorator.schema.json (Kubernetes-specific)
        ├── aws-ecs.decorator.schema.json (AWS ECS-specific)
        └── azure.decorator.schema.json (Azure-specific)
```

## Contributing

To contribute new platform-specific deployment decorators:

1. Extend `deployment.decorator.schema.json` using `allOf`
2. Add platform-specific properties in a namespaced sub-object within `data`
3. Set `additionalProperties: false` on your platform sub-object to lock down the schema
4. Provide comprehensive examples and test cases
5. Document all required and optional fields
