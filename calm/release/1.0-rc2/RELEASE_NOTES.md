# CALM Schema v1.0-rc2 Release Notes

This document outlines the changes included in the CALM Schema v1.0-rc2 release candidate.

## Overview

CALM v1.0-rc2 introduces several important schema refinements and simplifications based on community feedback and implementation experience from v1.0-rc1. This release candidate focuses on streamlining the schema structure while maintaining backward compatibility where possible.

## Major Changes

### 1. Interface Schema Simplification (Breaking Change)

**What Changed:** The interface schema has been significantly simplified with property name changes and removal of built-in interface types.

**Property Name Changes:**
- `interface-definition-url` → `definition-url`
- `configuration` → `config`

**Removed Built-in Interface Types:**
The following built-in interface types have been removed from the schema:
- `host-port-interface`
- `hostname-interface` 
- `path-interface`
- `url-interface`
- `oauth2-audience-interface`
- `rate-limit-interface`
- `container-image-interface`
- `port-interface`
- `node-interface`

**Benefits:**
- Cleaner, more consistent property naming
- Reduced schema complexity by focusing on the modular interface approach
- Encourages use of external interface definitions for better extensibility

**Migration Impact:** Organizations using built-in interface types will need to migrate to custom interface definitions using the `interface-definition` approach.

### 2. Control Schema Property Renaming (Breaking Change)

**What Changed:** Control schema properties have been renamed for consistency and clarity.

**Property Name Changes:**
- `control-requirement-url` → `requirement-url`
- `control-config-url` → `config-url`
- `control-config` → `config`

**Benefits:**
- Shorter, cleaner property names
- Consistent naming pattern across the schema
- Improved readability and reduced verbosity

**Migration Impact:** Existing control configurations will need to update property names.

### 3. Core Schema Refinements (Breaking Change)

**What Changed:** Several properties have been removed or simplified in the core schema.

**Removed Properties:**
- `data-classification` enum and property removed from relationships
- `metadata` removed from decision definition

**Interface Reference Changes:**
- Node interface references changed from complex `node-interface` objects to simple strings
- Standardised interface referencing mechanism

**Benefits:**
- Reduced schema complexity
- Cleaner node and relationship definitions

### 4. Schema URL Updates

**What Changed:** All schema references have been updated from `1.0-rc1` to `1.0-rc2`.

**Updated References:**
- All `$schema` and `$ref` URLs now point to `https://calm.finos.org/release/1.0-rc2/meta/`
- Prototype examples updated with new schema references
- Control requirement examples updated

## Prototype Examples

All existing prototype examples have been updated to use the new v1.0-rc2 schema references:

### Updated Examples
- `adr-example.json` - Architecture Decision Records integration
- `authentication-as-control.json` - Authentication modeled as controls
- `custom-interface-example.json` - Custom interface definitions
- `custom-node-type-example.json` - User extensible node types
- `example-inline-config.json` - Inline control configurations
- `example-mixed-config.json` - Mixed inline and URL-based configurations
- `throughput-control-prototype.json` - Performance control requirements

## Migration Guide

### From v1.0-rc1 to v1.0-rc2

1. **Update Schema References:**
   - Change all `1.0-rc1` URLs to `1.0-rc2` in `$schema` and `$ref` properties

2. **Update Interface Definitions:**
   - Replace `interface-definition-url` with `definition-url`
   - Replace `configuration` with `config`
   - Migrate built-in interface types to custom interface definitions

3. **Update Control Configurations:**
   - Replace `control-requirement-url` with `requirement-url`
   - Replace `control-config-url` with `config-url`
   - Replace `control-config` with `config`

4. **Review Data Classification Usage:**
   - Remove `data-classification` properties from relationships if present
   - Consider alternative approaches for data classification requirements

5. **Simplify Interface References:**
   - Update node interface references to use simple string identifiers

## Compatibility Notes

- **Breaking Changes:** This release contains breaking changes that require migration from v1.0-rc1
- **Schema Validation:** Existing v1.0-rc1 documents will not validate against v1.0-rc2 schemas without updates
- **Tooling Impact:** Tools and implementations using v1.0-rc1 will need updates to support v1.0-rc2

## Next Steps

CALM v1.0-rc2 represents continued progress toward a stable v1.0 release. Community feedback on these changes is encouraged to ensure the final v1.0 schema meets the needs of the architecture modeling community.

For questions or feedback, please engage with the CALM community through the appropriate channels.