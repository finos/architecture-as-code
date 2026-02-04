# Resource URL Loading Plan

## Problem Statement

CALM documents can reference URLs in two distinct ways:

1. **JSON Schema references** (`$ref`, `$schema`) - These point to JSON Schema documents that have `$id` properties and are consumed by validators, generators, and other tooling.

2. **Resource references** (`requirement-url`, `config-url`) - These point to standalone JSON documents that are not schemas. They may lack `$id` properties and represent external resources like control requirements or configurations.

The current implementation conflates these two types, assuming all documents have `$id` for manifest keying. This breaks when pulling resource documents that lack `$id`.

---

## Options Comparison

### Option 1: URL-as-ID Fallback

When a document lacks `$id`, use the source URL as the identifier.

**Pros:**
- Minimal changes to existing code
- Single manifest structure

**Cons:**
- Conflates two different ID concepts (semantic `$id` vs source URL)
- No clear distinction between document types
- Makes it harder for tooling to know what kind of document it's dealing with

---

### Option 2: Separate Storage with Manifest Metadata

Explicitly separate schemas from resources with different manifest sections and directories.

```json
{
  "schemas": {
    "https://calm.finos.org/release/1.0/meta/core.json": "schemas/core.json"
  },
  "resources": {
    "https://calm.finos.org/workshop/controls/micro-seg.requirement.json": "resources/micro-seg.requirement.json"
  }
}
```

**Pros:**
- Clear separation of concerns
- Tooling can easily distinguish document types
- Different handling logic for each type
- Manifest is self-documenting
- Resources keyed by URL (natural identifier)

**Cons:**
- More complex manifest structure
- Requires migration of existing workspaces
- More code to maintain two parallel systems

---

### Option 3: Type-Annotated Manifest Entries

Keep single manifest but annotate each entry with metadata.

```json
{
  "https://calm.finos.org/meta/core.json": {
    "path": "files/core.json",
    "type": "schema",
    "id": "https://calm.finos.org/meta/core.json"
  },
  "https://calm.finos.org/controls/micro-seg.json": {
    "path": "files/micro-seg.json",
    "type": "resource"
  }
}
```

**Pros:**
- Single manifest to manage
- Extensible metadata per entry
- Clear document typing

**Cons:**
- Breaking change to manifest format
- More complex entry structure
- Mixes concerns in single namespace

---

### Option 4: Deferred Fetching (Don't Pull Resources)

Only pull `$ref`/`$schema` targets. Leave resource URLs as remote references fetched on-demand by tooling.

**Pros:**
- Simplest implementation
- Keeps workspace lean
- Solves problem only when needed

**Cons:**
- No offline access to resources
- Network dependency at validation time
- Inconsistent bundling behaviour

---

## Recommendation

**Option 2 (Separate Storage)** provides the cleanest separation and best supports future tooling that needs to distinguish between schemas and resources.

---

## Implementation Plan for Option 2

### Phase 1: Update Manifest Structure

**1.1 Define new manifest types**

Update `bundle.ts` with new type definitions:

```typescript
export type WorkspaceManifest = {
  schemas: Record<string, string>;    // $id -> relative path
  resources: Record<string, string>;  // source URL -> relative path
};
```

**1.2 Update manifest constants**

- Keep `MANIFEST_FILENAME = 'workspace-manifest.json'`
- Add `SCHEMAS_DIRNAME = 'schemas'`
- Add `RESOURCES_DIRNAME = 'resources'`
- Deprecate or repurpose existing `FILES_DIRNAME = 'files'`

**1.3 Update manifest load/save functions**

- `loadManifest()` - Handle both old format (for migration) and new format
- `saveManifest()` - Always write new format
- Add migration logic to convert old `Record<string, string>` to new structure

### Phase 2: Separate Reference Properties

**2.1 Categorise reference properties**

```typescript
export const SCHEMA_REFERENCE_PROPERTIES = ['$ref', '$schema'] as const;
export const RESOURCE_REFERENCE_PROPERTIES = ['requirement-url', 'config-url'] as const;
export const ALL_REFERENCE_PROPERTIES = [
  ...SCHEMA_REFERENCE_PROPERTIES,
  ...RESOURCE_REFERENCE_PROPERTIES
] as const;
```

**2.2 Update `extractReferenceValue`**

No changes needed - it already handles both direct strings and const objects.

### Phase 3: Update Bundle Operations

**3.1 Update `addObjectToBundle`**

Split into two functions or add a `type` parameter:

- `addSchemaToBundle(bundlePath, obj, explicitId?)` - Requires `$id`, stores in `schemas/`
- `addResourceToBundle(bundlePath, obj, sourceUrl)` - Keyed by URL, stores in `resources/`

**3.2 Update `addFileToBundle`**

Add option to specify document type:

```typescript
type AddFileOptions = {
  id?: string;
  destName?: string;
  copy?: boolean;
  type: 'schema' | 'resource';
  sourceUrl?: string;  // Required for resources
};
```

**3.3 Update `buildDependencyGraph`**

- Scan both `schemas` and `resources` sections
- Track which type each node is
- Consider whether resources should appear in dependency graph or be separate

### Phase 4: Update Pull Logic

**4.1 Update `pullReferencesFromBundle` in commands.ts**

Modify the pull logic to:

1. Identify reference type based on property name
2. For `$ref`/`$schema`:
   - Fetch document
   - Extract `$id`
   - Store in `schemas/` directory
   - Key by `$id` in manifest
3. For `requirement-url`/`config-url`:
   - Fetch document
   - Store in `resources/` directory
   - Key by source URL in manifest

**4.2 Add pull options**

```typescript
type PullOptions = {
  includeSchemas?: boolean;   // default: true
  includeResources?: boolean; // default: true
};
```

### Phase 5: Update Workspace Commands

**5.1 Update `workspace add` command**

Add `--type` flag:
```
calm workspace add <file> --type schema
calm workspace add <file> --type resource --url <source-url>
```

**5.2 Update `workspace clean` command**

Clean both `schemas/` and `resources/` directories.

**5.3 Update `workspace tree` command**

Consider showing resources separately or with different styling.

### Phase 6: Update Tests

**6.1 Update existing tests**

- Update all tests that use the old manifest format
- Update tests for `loadManifest`/`saveManifest`

**6.2 Add migration tests**

- Test loading old format manifests
- Test automatic migration to new format

**6.3 Add new tests**

- Tests for `addSchemaToBundle` / `addResourceToBundle`
- Tests for pulling resources separately
- Tests for mixed schema/resource documents

### Phase 7: Migration Support

**7.1 Automatic migration**

When `loadManifest` encounters old format:
1. Detect old format (flat `Record<string, string>`)
2. Assume all existing entries are schemas
3. Convert to new structure
4. Optionally save migrated manifest

**7.2 Manual migration command (optional)**

```
calm workspace migrate
```

Explicitly migrates workspace to new format.

---

## Directory Structure (After Implementation)

```
.calm-workspace/
├── workspace.json              # Active workspace name
└── bundles/
    └── <workspace-name>/
        ├── workspace-manifest.json
        ├── schemas/            # JSON Schema documents (keyed by $id)
        │   ├── core.json
        │   └── control.json
        └── resources/          # External resources (keyed by source URL)
            ├── micro-seg.requirement.json
            └── micro-seg.config.json
```

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing workspaces | Automatic migration in `loadManifest` |
| Increased complexity | Clear separation of concerns, good test coverage |
| Resource documents without unique URLs | Validate URL uniqueness, error on conflicts |
| Performance with many resources | Lazy loading option, parallel fetching |

---

## Future Considerations

- **Validation tooling**: Once resources are properly separated, implement `calm validate --controls` that uses requirement/config resources
- **Resource versioning**: Resources may change over time; consider caching/versioning strategies
- **Resource types**: May need further categorisation (requirements vs configs vs other)
