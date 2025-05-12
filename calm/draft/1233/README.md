# Allow Inlining of Control Configuration

This draft implements the schema changes proposed in [Issue #1233](https://github.com/finos/architecture-as-code/issues/1233).

## Overview

This change modifies the `control-detail` definition in the control.json schema to allow for inline control configurations as an alternative to the existing URL-based approach.

## Current Limitations

Currently, the schema only allows specifying a `control-config-url` property that points to an external configuration file. This requires users to create and maintain separate files for control configurations, even for simple cases, and makes CALM documents dependent on external resources.

## Proposed Changes

The schema now includes:

1. A new `control-config` property of type "object" to allow inline configuration
2. A `oneOf` constraint to ensure either `control-config-url` OR `control-config` is provided (but not both)

## Backward Compatibility

This change is backward compatible:
- Existing CALM documents using `control-config-url` will continue to validate
- This is a non-breaking change as it extends the schema rather than restricting it
- No migration is required for existing documents

## Examples

The `prototype` directory contains examples demonstrating the use of:
- URL-based configuration only (`example-url-config.json`)
- Inline configuration only (`example-inline-config.json`)
- Mixed approach with both types in the same document (`example-mixed-config.json`)

## Implementation Impact

- Tools that process CALM documents must be updated to handle both URL references and inline configurations
- Validation tools need to be enhanced to validate the inline control configuration against the schema specified in the `control-requirement-url`
- Documentation should be updated to explain this new flexibility
