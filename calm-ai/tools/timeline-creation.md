# CALM Timeline Creation Guide

## Overview

This guide provides instructions for creating complete CALM architecture timeline documents that comply with the FINOS CALM v1.1 schema.

## Required Schema Structure

Every CALM architecture timeline MUST include:

```json
{
    "$schema": "https://calm.finos.org/release/1.1/meta/calm-timeline.json",
    "moments": []
}
```

## Optional Top-Level Properties

```json
{
    "metadata": [],
    "current-moment": "string"
}
```

The `current-moment` property can be used to indicate the active moment in the timeline.

## Architecture Timeline Creation Checklist

- [ ] Include required $schema reference to CALM v1.1
- [ ] Name file with `.timeline.json` suffix
- [ ] Add moments array (even if empty initially)
- [ ] Include metadata array for operational info
**🚨 MANDATORY VALIDATION (Do not skip):**
- [ ] **Verify calm-cli is installed:** `which calm`
- [ ] **Run CALM validation:** `calm validate --timeline <filename>.timeline.json`
- [ ] **Review output for errors:** `jsonSchemaValidationOutputs`, `spectralSchemaValidationOutputs`
- [ ] **Fix ALL errors before proceeding** - Do not assume JSON validity equals CALM validity
- [ ] **Confirm output shows:** `"hasErrors": false, "hasWarnings": false`
- [ ] **Document any warnings addressed**

## Best Practices

1. **Naming**: Use descriptive, business-friendly names
2. **IDs**: Use kebab-case for unique-id values
3. **File Naming**: Architecture timeline files should be suffixed with `.timeline.json` (e.g., `trading-system.timeline.json`)
4. **Modularity**: Every moment will use detailed-architecture to refer to the architecture file
5. **Validation**: Always validate before committing changes
6. **Documentation**: Include comprehensive descriptions

## Example Minimal Architecture Timeline

```json
{
    "$schema": "https://calm.finos.org/release/1.1/meta/calm.json",
    "metadata": [
        {
            "version": "1.0.0",
            "created-by": "Architecture Team",
            "environment": "production"
        }
    ],
    "moments": []
}
```
