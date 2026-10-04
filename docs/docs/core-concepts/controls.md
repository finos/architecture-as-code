---
id: controls
title: Controls
sidebar_position: 4
---

# Controls in CALM 

Controls model requirements for domains. For example, a security domain contains a series of control requirements

A control has a name and then consists of a description and the requirements of the control

Controls are made up of:

* requirement-url: This is a schema the specifies how the control should be defined
* config-url: The location of the implementation of control requirement, this defines how the control was fulfilled.

## Example of control applied to a node

```json
{
    ...
    "nodes": [
        {   
            "unique-id": "example-system",
            "node-type": "system",
            "name": "Example System",
            "description": "Example System",
            "controls": {
                "cbom": {
                    "description": "Control requirements for delivering patterns",
                    "requirements": [
                        {
                            "requirement-url": "https://myorg.example.com/controls/security/permitted-connection.requirement.json",
                            "config-url": "https://myorg.example.com/controls/security/permitted-connection.config.json"
                        }
                    ]
                }
            }
        }
    ],
    ...
}
```

## Control requirement

A control requirement lays out what the control is and how it is expected to be enforced.
We can see this here with a control for permitted connections that only allow certain protocols.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://myorg.example.com/controls/security/permitted-connection.requirement.json",
  "title": "Permits a connection between two components in the architecture",
  "type": "object",
  "allOf": [
    {
      "$ref": "https://calm.finos.org/release/1.2/meta/control-requirement.json"
    }
  ],
  "properties": {
    "control-id": {
      "const": "security-002"
    },
    "name": {
      "const": "Permitted Connection"
    },
    "description": {
      "const": "Permits a connection using an approved protocol"
    },
    "protocol": {
      "$ref": "#/defs/protocol"
    }
  },
  "required": [
    "control-id",
    "name",
    "description",
    "protocol"
  ],
  "defs": {
    "protocol": {
      "enum": [
        "HTTPS",
        "SFTP",
        "JDBC",
        "WebSocket",
        "TLS",
        "mTLS",
        "TCP"
      ]
    }
  }
}

```

## Control configuration

The control configuration is the implementation of the requirement, how the requirement is fulfilled.
We can see in this configurtation that it is implementing the control requirement shown above.

```json
{
  "$schema": "https://myorg.example.com/controls/security/permitted-connection.requirement.json",
  "control-id": "security-002",
  "name": "Permitted Connection",
  "description": "Permits a connection using an approved protocol",
  "protocol": "mTLS"
}
```
