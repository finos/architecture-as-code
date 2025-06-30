# CALM Control Example (JSON – release/1.0-rc1)

This example demonstrates a valid CALM control configuration using an extended control-requirement schema. The requirement defines the expected structure, and the configuration complies with it.

---

## 🛡️ Control with Custom Schema: Micro-segmentation

### ✅ Control Requirement Schema (reference only)
URL: https://calm.finos.org/workshop/controls/micro-segmentation.requirement.json

### ✅ Control Configuration
```json
{
  "$schema": "https://calm.finos.org/workshop/controls/micro-segmentation.requirement.json",
  "$id": "https://calm.finos.org/workshop/controls/micro-segmentation.config.json",
  "control-id": "security-001",
  "name": "Micro-segmentation of Kubernetes Cluster",
  "description": "Micro-segmentation in place to prevent lateral movement outside of permitted flows",
  "permit-ingress": true,
  "permit-egress": false
}
```

---

## 🔗 Control with Protocol-Based Whitelisting

### ✅ Control Requirement Schema (reference only)
URL: https://calm.finos.org/workshop/controls/permitted-connection.requirement.json

### ✅ Control Configuration: JDBC
```json
{
  "$schema": "https://calm.finos.org/workshop/controls/permitted-connection.requirement.json",
  "control-id": "security-002",
  "name": "Permitted Connection",
  "description": "Permits a connection on a relationship specified in the architecture",
  "reason": "Permitted to allow the connection between application and database",
  "protocol": "JDBC"
}
```

### ✅ Control Configuration: HTTP
```json
{
  "$schema": "https://calm.finos.org/workshop/controls/permitted-connection.requirement.json",
  "control-id": "security-002",
  "name": "Permitted Connection",
  "description": "Permits a connection on a relationship specified in the architecture",
  "reason": "Required to enable flow between architecture components",
  "protocol": "HTTP"
}
```