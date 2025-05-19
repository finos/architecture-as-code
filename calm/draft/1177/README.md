# CALM Schema Change - Issue #1177

## Remove authentication property on relationship in favor of authentication being modelled as a control requirement

This schema change implements [Issue #1177](https://github.com/finos/architecture-as-code/issues/1177).

### Changes Made

1. Removed the `authentication` property from the relationship schema in `core.json`
2. Removed the `authentication` enum definition from the schema as it's no longer referenced
3. Authentication should now be modeled as a control requirement, as demonstrated in the prototype example

### Rationale

As described in the issue, this change removes the authentication property from relationships in favor of authentication being defined as a control. This allows various properties related to authentication to be defined more flexibly and thoroughly than would be possible with a simple key-value pair.

Defining authentication as a control also drives its use in compliance as authentication is a common area that is looked at when reviewing systems.

### Backward Compatibility

Considering CALM allows the inclusion of additional properties on both nodes and relationships, existing CALM documents with an authentication property on the relationship will still remain valid. Authentication still remains a property that can be added.

- Existing CALM documents remain valid
- No breaking changes
- Migration path: Use control requirements to define authentication instead

### Example

The [prototype example](./prototype/authentication-as-control.json) demonstrates how to model authentication as a control requirement instead of using the deprecated `authentication` property on relationships.

#### Before (using the authentication property):

```json
{
  "relationships": [
    {
      "unique-id": "system-a-to-system-b",
      "description": "System A connects to System B",
      "relationship-type": {
        "connects": {
          "source": { "node": "system-a" },
          "destination": { "node": "system-b" }
        }
      },
      "protocol": "HTTPS",
      "authentication": "OAuth2"
    }
  ]
}
```

#### After (using controls):

```json
{
  "relationships": [
    {
      "unique-id": "system-a-to-system-b",
      "description": "System A connects to System B",
      "relationship-type": {
        "connects": {
          "source": { "node": "system-a" },
          "destination": { "node": "system-b" }
        }
      },
      "protocol": "HTTPS",
      "controls": {
        "authentication": {
          "description": "Authentication between System A and System B",
          "requirements": [
            {
              "control-requirement-url": "https://calm.finos.org/draft/1177/prototype/authentication-control-requirement.json",
              "control-config-url": "https://calm.finos.org/draft/1177/prototype/authentication-control-config.json"
            }
          ]
        }
      }
    }
  ]
}
```

This example includes:

1. [authentication-control-requirement.json](./prototype/authentication-control-requirement.json) - A schema defining the structure and requirements for authentication controls
2. [authentication-control-config.json](./prototype/authentication-control-config.json) - An example configuration that implements the authentication control requirement

By modeling authentication as a control rather than a simple property, users can define more detailed and flexible authentication configurations, which is particularly important for compliance and security reviews.
