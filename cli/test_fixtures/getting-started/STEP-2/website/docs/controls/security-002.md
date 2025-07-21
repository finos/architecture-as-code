```json
{
  "id": "security-002",
  "name": "Permitted Connection",
  "schema": "https://calm.finos.org/getting-started/controls/permitted-connection.requirement.json",
  "description": "Permits a connection on a relationship specified in the architecture",
  "domain": "security",
  "scope": "Relationship",
  "appliedTo": "load-balancer-attendees",
  "content": {
    "$schema": "https://calm.finos.org/getting-started/controls/permitted-connection.requirement.json",
    "control-id": "security-002",
    "name": "Permitted Connection",
    "description": "Permits a connection on a relationship specified in the architecture",
    "reason": "Required to enable flow between architecture components",
    "protocol": "HTTP"
  }
}