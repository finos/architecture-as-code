# CALM Interface Creation Guide

## Critical Requirements

🚨 **ALWAYS call the interface creation tool before creating any interfaces**

## Official JSON Schema Definition

The complete interface schema from the FINOS CALM v1.0 specification:

```json
{
    "interface-definition": {
        "type": "object",
        "description": "A modular interface definition referencing an external schema",
        "properties": {
            "unique-id": {
                "type": "string",
                "description": "Unique identifier for this interface instance"
            },
            "definition-url": {
                "type": "string",
                "description": "URI of the external schema this interface configuration conforms to"
            },
            "config": {
                "type": "object",
                "description": "Inline configuration conforming to the external interface schema"
            }
        },
        "required": ["unique-id", "definition-url", "config"],
        "additionalProperties": false
    },
    "interface-type": {
        "type": "object",
        "properties": {
            "unique-id": {
                "type": "string"
            }
        },
        "required": ["unique-id"],
        "additionalProperties": true
    },
    "node-interface": {
        "type": "object",
        "properties": {
            "node": {
                "type": "string"
            },
            "interfaces": {
                "type": "array",
                "items": {
                    "type": "string"
                }
            }
        },
        "required": ["node"]
    }
}
```

## oneOf Constraint

Each interface MUST be exactly ONE of:

1. **interface-definition** (modular approach) - References external schema with strict validation
2. **interface-type** (flexible approach) - Allows any properties with `additionalProperties: true`

⚠️ **NEVER mix properties from both approaches!**

**Key Differences**:

- `interface-definition`: `additionalProperties: false` - Only allows `unique-id`, `definition-url`, and `config`
- `interface-type`: `additionalProperties: true` - Allows any properties beyond `unique-id`

## Option 1: interface-definition (Modular)

Required properties:

- `unique-id` (string)
- `definition-url` (string) - Must be an accessible URL to the interface schema definition
- `config` (object) - Must conform to the schema specification provided at the definition-url

Must NOT have: host, port, hostname, url, etc.

```json
{
    "unique-id": "http-api-interface",
    "definition-url": "https://example.com/schemas/http-service.json",
    "config": {
        "host": "api.internal.local",
        "port": 8080,
        "protocol": "HTTP",
        "base-path": "/api/v1"
    }
}
```

## Option 2: interface-type (Flexible)

Required: `unique-id` + any additional properties you need

The `interface-type` schema allows `additionalProperties: true`, meaning you can add any properties that make sense for your interface.

**Examples of flexible interface types:**

```json
{
    "unique-id": "db-connection",
    "host": "database.internal.local",
    "port": 5432
}
```

```json
{
    "unique-id": "api-endpoint",
    "url": "https://api.example.com/v1"
}
```

```json
{
    "unique-id": "message-queue",
    "host": "queue.internal.local",
    "port": 5672,
    "virtual-host": "/prod"
}
```

```json
{
    "unique-id": "web-frontend",
    "hostname": "app.example.com"
}
```

**url-interface:**

```json
{
    "unique-id": "webhook-endpoint",
    "url": "https://api.external.com/webhook/events"
}
```

**oauth2-audience-interface:**

```json
{
    "unique-id": "oauth-protected-api",
    "audiences": ["trading-api", "settlement-service"]
}
```

**container-image-interface:**

```json
{
    "unique-id": "service-container",
    "image": "trading-api:v2.3.1"
}
```

**path-interface:**

```json
{
    "unique-id": "file-path",
    "path": "/data/trading/reports"
}
```

**port-interface:**

```json
{
    "unique-id": "service-port",
    "port": 8080
}
```

## Interface Selection Guide

Use **interface-definition** when:

- Complex protocol configuration needed
- External schema references required
- Standardization across teams

Use **interface-type** when:

- Simple connection requirements
- Basic endpoint references
- Testing or examples (avoids URL validation)

## Validation Rules

1. Choose exactly ONE approach per interface
2. Include all required properties for chosen type
3. Port values must be integers, not strings
4. URLs must be valid format
5. No additional properties beyond those defined
