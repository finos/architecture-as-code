---
architecture: ../../../getting-started/STEP-3/conference-signup-with-flow.arch.json
url-to-local-file-mapping: ../../../getting-started/url-to-local-file-mapping.json
---
### Show relationships for a specific relationship ID
```mermaid
graph TD;
conference-website[Conference Website] -- Connects --> load-balancer[Load Balancer];
classDef highlight fill:#f2bbae;
```

### Show relationships for a specific node ID
```mermaid
graph TD;
load-balancer[Load Balancer]:::highlight;
conference-website[Conference Website] -- Connects --> load-balancer[Load Balancer];
load-balancer[Load Balancer] -- Connects --> attendees[Attendees Service];
load-balancer[Load Balancer] -- Deployed In --> k8s-cluster[Kubernetes Cluster];
classDef highlight fill:#f2bbae;
```

### Show relationships for a container node
```mermaid
graph TD;
k8s-cluster[Kubernetes Cluster]:::highlight;
load-balancer[Load Balancer] -- Deployed In --> k8s-cluster[Kubernetes Cluster];
attendees[Attendees Service] -- Deployed In --> k8s-cluster[Kubernetes Cluster];
attendees-store[Attendees Store] -- Deployed In --> k8s-cluster[Kubernetes Cluster];
classDef highlight fill:#f2bbae;
```

