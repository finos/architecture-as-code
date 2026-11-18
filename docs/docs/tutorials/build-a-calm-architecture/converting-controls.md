---
id: converting-controls
title: Converting Your Controls to CALM
sidebar_label: Converting Controls to CALM
---

# Converting Your Controls to CALM

Most organisations already have a control catalogue: a policy document, a spreadsheet, a GRC tool, or a framework such as NIST SP 800-53. This guide shows how to express those controls in CALM, so that `calm validate` checks that each architecture documents how it meets them.

Read [Controls](../../core-concepts/controls.md) and the [Controls tutorial](../intermediate/08-controls.md) first. This guide uses one example control from start to end: **ENC-01 Encryption in transit**.

## What CALM checks

`calm validate` checks the configuration that an architecture documents against the requirement schema of the control. It does not check the running system. Collect runtime evidence with your usual tools, and use the `control-id` to link that evidence to the control in the architecture.

## Map your catalogue to CALM

| In your catalogue | In CALM |
|---|---|
| Control ID | `control-id`, fixed with `const` in the requirement schema |
| Control name | `name`, fixed with `const` in the requirement schema |
| Parameters, for example a minimum TLS version or a retention period | Extra properties in the requirement schema, limited with `enum`, `minimum` or `pattern` |
| How a system meets the control | The `config` (inline) or `config-url` (separate file) of the control in the architecture |
| Control family | The key under `controls`, for example `security`. Use letters, digits and hyphens |
| Scope | Where you put the control: the architecture, a node, a relationship or a flow |

## Step 1: Select the controls

Not every control is about architecture. Controls for staff training or HR processes do not belong in a CALM architecture. Start with a small number of controls that apply to a component, a connection or a data flow, and that reviewers check by hand today.

## Step 2: Write a requirement schema for each control

A requirement schema is a JSON Schema that says what an architecture must state to meet the control. Extend the CALM [control requirement](https://calm.finos.org/release/1.3/meta/control-requirement.json) schema, which requires `control-id`, `name` and `description`:

```json title="controls/enc-01.requirement.json"
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://controls.example.com/security/enc-01.requirement.json",
  "title": "ENC-01 Encryption in transit",
  "type": "object",
  "allOf": [
    { "$ref": "https://calm.finos.org/release/1.3/meta/control-requirement.json" }
  ],
  "properties": {
    "control-id": { "const": "ENC-01" },
    "name": { "const": "Encryption in transit" },
    "description": { "type": "string" },
    "minimum-tls-version": { "enum": ["1.2", "1.3"] },
    "mutual-tls": { "type": "boolean" }
  },
  "required": ["control-id", "name", "description", "minimum-tls-version"]
}
```

- `const` on `control-id` and `name` makes validation fail when an architecture cites the control with a wrong ID.
- Each parameter of the control becomes a property. Put the parameters that every system must state in `required`.
- The `$id` is the stable URL that architectures cite. Keep one file for each control, and give a changed control a new URL, so that architectures that cite the old version do not change meaning.

If many of your controls have the same shape, define a [Standard](../../core-concepts/standards.md#standards-and-controls-integration) for the requirement documents. The [FINOS SDLC Common Controls](https://github.com/finos/architecture-as-code/tree/main/calm-hub/mongo/controls/finos-sdlc-common-controls) seeded in CALM Hub are a full catalogue converted in this way: each document keeps the catalogue entry (risks it mitigates, requirement statements, NIST references) and is also the requirement schema.

## Step 3: Put the control in the architecture

ENC-01 is about connections, so it goes on the relationship:

```json
{
  "unique-id": "payments-api-to-db",
  "description": "Payments API reads and writes payment records",
  "relationship-type": {
    "connects": {
      "source": { "node": "payments-api" },
      "destination": { "node": "payments-db" }
    }
  },
  "protocol": "JDBC",
  "controls": {
    "security": {
      "description": "Encryption of payment data in transit",
      "requirements": [
        {
          "requirement-url": "https://controls.example.com/security/enc-01.requirement.json",
          "config": {
            "control-id": "ENC-01",
            "name": "Encryption in transit",
            "description": "The JDBC driver enforces TLS 1.3 to the database",
            "minimum-tls-version": "1.3"
          }
        }
      ]
    }
  }
}
```

Use the `description` in `config` to say how this system meets the control. Use `config-url` instead of `config` when the team that owns the evidence keeps the configuration in its own file, or when many architectures share one configuration. CALM validates a `config-url` document in the same way as an inline `config`.

## Step 4: Validate

Until you publish the requirement schemas, map their URLs to local files (see [URL to Local File Mapping](../../calm-cli/generate.md#url-to-local-file-mapping)):

```json title="url-mapping.json"
{
  "https://controls.example.com/security/enc-01.requirement.json": "controls/enc-01.requirement.json"
}
```

```shell
calm validate -a architecture.json -u url-mapping.json
```

If the architecture states TLS 1.0, or cites the control with a wrong ID and no TLS version, validation fails:

```text
ERROR control-requirement-validation: must be equal to one of the allowed values
ERROR control-requirement-validation: must have required property 'minimum-tls-version'
ERROR control-requirement-validation: must be equal to constant
```

Each error also shows the path of the control in the architecture.

## Step 5: Make the control mandatory

Step 4 checks only the controls that an architecture contains. It does not make a team add a control. To make ENC-01 mandatory, require it in the [pattern](../intermediate/17-patterns.md) that the architecture is validated against. In the pattern, add this to the relationship:

```json
"controls": {
  "required": ["security"],
  "properties": {
    "security": {
      "properties": {
        "requirements": {
          "contains": {
            "properties": {
              "requirement-url": {
                "const": "https://controls.example.com/security/enc-01.requirement.json"
              }
            },
            "required": ["requirement-url"]
          }
        }
      }
    }
  }
}
```

Also add `"controls"` to the `required` list of the relationship. `contains` lets the relationship cite other controls too. An architecture without the control now fails `calm validate -p pattern.json -a architecture.json` with `must have required property 'controls'`.

## Step 6: Publish and reuse

Publish the requirement schemas at their `$id` URLs. Then every team cites the same control, and you no longer need the URL mapping.

To keep the controls in CALM Hub instead, give each requirement schema a Hub `$id` of the form `<hub-url>/calm/domains/security/controls/enc-01/requirement/versions/1.0.0`, and push it with `calm hub push control-requirement`. The CLI takes the domain, control name and version from the `$id`, and sets the next version for you (see [Managing Controls](../../calm-cli/hub.md#managing-controls)). Architectures then cite the Hub URL.

## Checklist

- [ ] Each control has one requirement schema, with `control-id` and `name` fixed by `const`.
- [ ] Each parameter of the control is a property, with the values that are permitted.
- [ ] Each control is on the architecture, node, relationship or flow that it applies to.
- [ ] Each `config` says how the system meets the control.
- [ ] A pattern makes the mandatory controls required.
- [ ] `calm validate` passes.
