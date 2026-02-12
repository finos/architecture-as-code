# Deployment Decorators Prototype

Prototype schemas for tracking architecture deployments through CALM decorators.

## Files

- **deployment.decorator.schema.json** — Base deployment decorator schema, extends `decorators.json` with required `deployment-start-time`, `deployment-status`, and optional `deployment-observability`
- **kubernetes.decorator.schema.json** — Extends the deployment decorator with Kubernetes-specific fields: `helm-chart`, `cluster`, `namespace`
- **example.architecture.json** — Simple one-node architecture (Azure AKS cluster) used to demonstrate decorators
- **kubernetes.deployment.json** — Example Kubernetes deployment decorator instance applied to the AKS cluster node

## Schema Inheritance

```
decorators.json (base decorator structure)
  └── deployment.decorator.schema.json (deployment data attributes)
        └── kubernetes.decorator.schema.json (K8s-specific attributes)
```

## Related

- [CALM Deployments Proposal (#1908)](https://github.com/finos/architecture-as-code/issues/1908)
