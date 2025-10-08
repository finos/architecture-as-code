# CALM Models

This module contains the TypeScript type definitions and interfaces for the Common Architecture Language Model (CALM). It serves as a shared foundation for type safety across all CALM tooling and prevents circular dependencies between modules.

## Module Structure

The `calm-models` module is organized into three sub-modules:

### 1. **types**
A 1:1 mapping to the CALM schema definitions. These types directly represent the JSON schema structure of CALM documents and provide strict type safety for schema validation and parsing.

### 2. **model** 
An internal business model built to allow for lazy loading of nested CALM documents when required. This layer provides rich object models with methods and computed properties that support complex operations on CALM data.

### 3. **canonical**
A flattened data model used for templating. This represents CALM data in a simplified, template-friendly format that's optimized for rendering documentation and generating output files.

## What Should Be In This Module

✅ **Include:**
- **types/**: Direct TypeScript mappings of CALM JSON schema definitions
- **models/**: Business logic types supporting lazy loading and document relationships
- **canonical/**: Flattened, template-optimized data structures
- Any additional approved model representations of CALM data used by the CALM tooling.

## What Should NOT Be In This Module
❌ **Avoid:**
- Business logic or processing functions
- Template rendering code
- Widget implementations
- CLI-specific utilities
- File system operations
- Network requests or API clients
- Complex validation logic (keep validation types, not validation implementations)

## Dependencies

This module should maintain minimal dependencies to avoid becoming a bottleneck:
- Only essential TypeScript utility libraries
- No dependency on other CALM modules (`shared`, `calm-widgets`, etc.)
- Avoid heavy runtime dependencies

## Usage

Other modules in the CALM ecosystem import types from this module's sub-modules:

```typescript
// Import direct schema types from types/
import { 
  CalmNodeSchema, 
  CalmNodeTypeSchema, 
  CalmInteractsRelationshipSchema 
} from '@finos/calm-models/types';

// Import business model classes from model/
import { 
  CalmNode, 
  CalmRelationship, 
  CalmInteractsType,
  CalmConnectsType 
} from '@finos/calm-models/model';

// Import flattened template types from canonical/
import { 
  CalmCoreCanonicalModel, 
  CalmNodeCanonicalModel, 
  CalmDecisionCanonicalModel 
} from '@finos/calm-models/canonical';
```

For any questions about whether a type belongs in this module, consult the lead maintainers or discuss in the relevant GitHub issue.
