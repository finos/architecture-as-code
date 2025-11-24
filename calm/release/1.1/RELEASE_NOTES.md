# CALM Schema v1.1 Release Notes

## Change Log
### 2025-11-18
- `defs.protocol` now allows any string (enum removed) so models can describe emerging or bespoke protocols. The `relationship.protocol` property remains optional—omit it entirely when no protocol applies—and still references this shared definition when present.

### 2025-11-17
Initial creation of release-1.1 schema to manage proposed changes, only change is schema reference from 1.0 -> 1.1
