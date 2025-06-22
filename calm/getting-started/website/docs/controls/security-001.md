```json
{
  "id": "security-001",
  "name": "Micro-segmentation of Kubernetes Cluster",
  "schema": "https://calm.finos.org/getting-started/controls/micro-segmentation.requirement.json",
  "description": "Micro-segmentation in place to prevent lateral movement outside of permitted flows",
  "domain": "security",
  "scope": "Node",
  "appliedTo": "k8s-cluster",
  "content": {
    "$schema": "https://calm.finos.org/getting-started/controls/micro-segmentation.requirement.json",
    "$id": "https://calm.finos.org/getting-started/controls/micro-segmentation.config.json",
    "control-id": "security-001",
    "name": "Micro-segmentation of Kubernetes Cluster",
    "description": "Micro-segmentation in place to prevent lateral movement outside of permitted flows",
    "permit-ingress": true,
    "permit-egress": false
  }
}