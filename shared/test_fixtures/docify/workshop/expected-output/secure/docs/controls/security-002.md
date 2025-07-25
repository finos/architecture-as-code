```json
{
  "id": "security-002",
  "name": "Permitted Connection",
  "schema": "https://calm.finos.org/workshop/controls/permitted-connection.requirement.json",
  "description": "Permits a connection on a relationship specified in the architecture",
  "domain": "security",
  "scope": "Relationship",
  "appliedTo": "attendees-attendees-store",
  "content": {
    "$schema": "https://calm.finos.org/workshop/controls/permitted-connection.requirement.json",
    "control-id": "security-002",
    "name": "Permitted Connection",
    "description": "Permits a connection on a relationship specified in the architecture",
    "reason": "Permitted to allow the connection between application and database",
    "protocol": "JDBC"
  }
}