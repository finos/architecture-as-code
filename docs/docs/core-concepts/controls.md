---
id: controls
title: Controls
sidebar_position: 5
---

# Controls in CALM 

Controls model requirements for domains. For example, a security domain contains a series of control requirements

A control has a name and then consists of a description and the requirements of the control


Controls are made up of:

* control-requirement-url: This is a schema the specifies how the control should be defined
* control-config-url: The location of the implementation of control requirement, this defines how the control was fulfilled.

## Example of control

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
                            "control-requirement-url": "http://calm.finos.org/draft/calm/control-example/pre-prod-review-specification.json",
                            "control-config-url": "http://calm.finos.org/draft/calm/control-example/pre-prod-review-configuration.json"
                        }
                    ]
                }
            }
        }
    ],
    ...
}
```