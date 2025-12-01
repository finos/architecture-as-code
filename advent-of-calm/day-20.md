# Day 20: Add Deployment Topology

## Overview
Model where your components physically run using deployed-in relationships and infrastructure nodes.

## Objective and Rationale
- **Objective:** Extend your production architecture with deployment topology showing regions, networks, clusters, and physical infrastructure
- **Rationale:** Deployment topology is critical for disaster recovery, capacity planning, security zoning, and operations. Understanding where components run enables multi-region strategies, network isolation policies, and incident response.

## Requirements

### 1. Understand Deployment Topology Modeling

Use CALM to model:
- **Infrastructure nodes:** Regions, availability zones, networks, clusters
- **deployed-in relationships:** Which components run where
- **Hierarchical deployment:** Cluster in region, service in cluster, etc.

**Node types for infrastructure:**
- `system`: Generic infrastructure (regions, networks, clusters)
- Specific metadata to indicate infrastructure type

### 2. Plan Your Deployment Layers

**File:** `docs/deployment-planning.md`

**Content:**
```markdown
# Deployment Topology Planning

## System: [Your Production System]

### Cloud Provider / Infrastructure

- **Provider:** [AWS/Azure/GCP/On-Prem/Hybrid]
- **Account/Subscription:** [Details]

### Geographic Distribution

| Region | Location | Purpose | Components |
|--------|----------|---------|------------|
| [Name] | [Location] | [Primary/DR/Edge] | [List] |

### Network Architecture

| Network Zone | Purpose | CIDR/Range | Access Control |
|--------------|---------|------------|----------------|
| DMZ | External-facing | 10.0.1.0/24 | Public internet |
| Application | Service layer | 10.0.2.0/24 | DMZ only |
| Data | Databases | 10.0.3.0/24 | Application only |

### Compute Clusters

| Cluster | Type | Region | Node Count | Purpose |
|---------|------|--------|------------|---------|
| prod-k8s-east | Kubernetes | us-east-1 | 6 | Main services |
| prod-k8s-west | Kubernetes | us-west-2 | 6 | DR replica |
```

### 3. Add Region and Zone Nodes

**Prompt:**
```text
Add infrastructure nodes to architectures/production-[system-name].json:

1. Add region nodes (node-type: system):
   - unique-id: "region-us-east-1", name: "AWS US East 1", description: "Primary region"
   - unique-id: "region-us-west-2", name: "AWS US West 2", description: "Disaster recovery region"

2. Add availability zone nodes within regions (optional for detail):
   - unique-id: "az-us-east-1a", description: "Availability Zone 1A"
   - etc.

Use metadata to indicate:
   - infrastructure-type: "region" or "availability-zone"
   - cloud-provider: "aws"
   - location: "Virginia, USA"
```

### 4. Add Network Zone Nodes

**Prompt:**
```text
Add network zone nodes to architectures/production-[system-name].json:

For each region, add 3 network zones (node-type: system):
1. DMZ/Public zone:
   - unique-id: "dmz-[region]"
   - description: "Public-facing network zone"
   - metadata: infrastructure-type: "network-zone", security-level: "public"

2. Application zone:
   - unique-id: "app-zone-[region]"
   - description: "Application service network"
   - metadata: infrastructure-type: "network-zone", security-level: "internal"

3. Data zone:
   - unique-id: "data-zone-[region]"
   - description: "Database network (highest security)"
   - metadata: infrastructure-type: "network-zone", security-level: "restricted"

Add composed-of relationships from regions to their zones.
```

### 5. Add Compute Cluster Nodes

**Prompt:**
```text
Add Kubernetes cluster nodes (or VM groups) to architectures/production-[system-name].json:

For each region, add cluster nodes (node-type: system):
- unique-id: "k8s-cluster-[region]"
- name: "Production Kubernetes Cluster"
- description: "Kubernetes cluster for service workloads"
- metadata:
  - infrastructure-type: "kubernetes-cluster"
  - cluster-version: "1.28"
  - node-count: 6
  - instance-type: "m5.xlarge"

Add deployed-in relationships: cluster deployed-in region
```

### 6. Map Services to Deployment Infrastructure

**Prompt:**
```text
Add deployed-in relationships for all application services in architectures/production-[system-name].json:

For each service node:
1. Add deployed-in relationship to appropriate cluster
2. Add deployed-in relationship to appropriate network zone (DMZ/app/data)

Example:
- Frontend services → k8s-cluster-us-east-1 AND dmz-us-east-1
- Backend services → k8s-cluster-us-east-1 AND app-zone-us-east-1
- Databases → data-zone-us-east-1 (not in k8s, on dedicated VMs)

This shows both compute and network placement.
```

### 7. Add Multi-Region Deployment

**Prompt:**
```text
For services that have DR replicas in architectures/production-[system-name].json:

1. Create duplicate service nodes with suffix "-dr":
   - Same configuration
   - Different deployed-in (west region instead of east)
   - Metadata: deployment-role: "disaster-recovery"

2. Add connects relationships between primary and DR:
   - Database replication
   - Service synchronization

This models active-passive or active-active deployment.
```

### 8. Create Deployment Topology Diagram

**File:** `docs/deployment-topology.md`

**Content:**
```markdown
# Deployment Topology

## Overview

This document describes the physical deployment of [System Name].

## Architecture Reference

See: `architectures/production-[system-name].json`

## Region Distribution

### US East 1 (Primary)

\`\`\`
Region: us-east-1
├── Network: DMZ (10.0.1.0/24)
│   ├── Load Balancer
│   └── Frontend Services
├── Network: Application (10.0.2.0/24)
│   └── Kubernetes Cluster
│       ├── API Gateway
│       ├── Order Service
│       ├── Payment Service
│       └── User Service
└── Network: Data (10.0.3.0/24)
    ├── PostgreSQL Primary
    └── Redis Cache
\`\`\`

### US West 2 (DR)

\`\`\`
Region: us-west-2
└── Network: Data (10.1.3.0/24)
    └── PostgreSQL Replica (read-only)
\`\`\`

## Network Flow

1. **User Request:**
   - Enters DMZ (public internet)
   - Hits load balancer in DMZ
   - Routes to frontend in DMZ

2. **API Request:**
   - Frontend calls API gateway in app zone
   - Cross-zone call (DMZ → App)
   - Firewall rules permit this traffic

3. **Data Access:**
   - Services in app zone access data zone
   - Cross-zone call (App → Data)
   - Private network, no public routing

4. **Replication:**
   - Primary DB in us-east-1 data zone
   - Replicates to DR DB in us-west-2 data zone
   - Cross-region, encrypted tunnel

## Security Boundaries

| Zone | Ingress | Egress |
|------|---------|--------|
| DMZ | Internet | App zone only |
| App | DMZ only | Data zone, external APIs |
| Data | App only | Cross-region replication |

## Disaster Recovery

### RTO/RPO

- **RTO:** 4 hours (time to failover)
- **RPO:** 5 minutes (data loss tolerance)

### Failover Procedure

1. Promote DR database to primary
2. Update DNS to point to us-west-2 load balancer
3. Scale up us-west-2 application services

### CALM Reference

See deployed-in relationships to understand which components need failover.

## Capacity

| Cluster | Current | Max | Utilization |
|---------|---------|-----|-------------|
| k8s-us-east-1 | 6 nodes | 20 nodes | 45% |
| k8s-us-west-2 | 2 nodes | 20 nodes | 15% (standby) |

## Cloud Resources

[Reference metadata from infrastructure nodes in CALM]
```

### 9. Create Infrastructure Cost Model

**File:** `docs/infrastructure-costs.md`

**Content:**
```markdown
# Infrastructure Cost Model

Based on deployment topology in `architectures/production-[system-name].json`

## Compute Costs

| Resource | Quantity | Unit Cost | Monthly Cost |
|----------|----------|-----------|--------------|
| K8s nodes (m5.xlarge) | 6 | $140 | $840 |
| DR nodes (m5.xlarge) | 2 | $140 | $280 |
| Database VMs (r5.2xlarge) | 2 | $380 | $760 |

## Network Costs

| Resource | Quantity | Unit Cost | Monthly Cost |
|----------|----------|-----------|--------------|
| Load Balancer | 2 | $20 | $40 |
| Data Transfer (GB) | 5000 | $0.09 | $450 |
| Cross-region replication | 500 GB | $0.02 | $10 |

## Storage Costs

| Resource | Size | Unit Cost | Monthly Cost |
|----------|------|-----------|--------------|
| Database storage | 1 TB | $100 | $100 |
| Backups | 2 TB | $23 | $46 |

## Total Monthly Cost

**$2,526**

## Cost Optimization Opportunities

1. Right-size K8s nodes based on actual usage
2. Use spot instances for non-critical workloads
3. Archive old data to cheaper storage tiers
```

### 10. Validate Deployment Topology

```bash
calm validate -a architectures/production-[system-name].json
```

### 11. Visualize Deployment Topology

**Steps:**
1. Open `architectures/production-[system-name].json`
2. Open preview (Ctrl+Shift+C)
3. View deployed-in relationships showing physical placement
4. **Take screenshot** showing deployment hierarchy
5. Save to `docs/screenshots/deployment-topology.png`

### 12. Generate Deployment Documentation

```bash
calm docify --architecture architectures/production-[system-name].json --template templates/comprehensive-bundle/deployment-checklist.hbs --output docs/generated/deployment-checklist.md
```

### 13. Update Your README

Mark Day 20 complete in the README and summarize the deployment artifacts (planning doc, topology write-up, infrastructure costs, and screenshots) so the topology work is easy to discover later.

### 14. Commit Deployment Topology

```bash
git add architectures/production-*.json docs/deployment-*.md docs/infrastructure-costs.md docs/screenshots README.md
git commit -m "Day 20: Add deployment topology with regions, networks, and clusters"
git tag day-20
```

## Deliverables

✅ **Required:**
- Enhanced `architectures/production-[system-name].json` with:
  - Region nodes
  - Network zone nodes
  - Cluster/infrastructure nodes
  - deployed-in relationships
  - Optional: DR replicas
- `docs/deployment-planning.md` - Deployment planning
- `docs/deployment-topology.md` - Deployment documentation
- `docs/infrastructure-costs.md` - Cost model
- `docs/screenshots/deployment-topology.png` - Topology visualization
- Updated `README.md` - Day 20 marked complete

✅ **Validation:**
```bash
# Validate architecture
calm validate -a architectures/production-*.json

# Check for infrastructure nodes
grep -q 'region-' architectures/production-*.json
grep -q 'infrastructure-type' architectures/production-*.json

# Check for deployed-in relationships
grep -q '"deployed-in"' architectures/production-*.json

# Verify documentation
test -f docs/deployment-topology.md
test -f docs/infrastructure-costs.md

# Check tag
git tag | grep -q "day-20"
```

## Resources
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/)
- [Google Cloud Architecture Framework](https://cloud.google.com/architecture/framework)

## Tips
- Model actual deployment, not ideal state
- Include network security boundaries
- Document DR strategy with deployed-in relationships
- Use metadata to capture cloud-specific details
- Deployment topology helps with:
  - Disaster recovery planning
  - Network security design
  - Cost optimization
  - Capacity planning
- Keep this updated as deployment changes

## Next Steps
Tomorrow (Day 21) you'll model data lineage to show how data moves through your system!
