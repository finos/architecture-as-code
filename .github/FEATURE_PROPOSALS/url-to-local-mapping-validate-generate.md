---
name: 🚀 Feature Proposal
about: Add URL-to-local-file mapping support for validate and generate commands
type: Feature
---

## Feature Proposal

### Target Project:
- `@finos/calm-shared` - Core document loading infrastructure
- `@finos/calm-cli` - CLI commands (validate, generate)

### Description of Feature:
Add support for resolving `$ref` URLs in Patterns to local files during validation and generation. This enables Patterns to reference external Standards files via canonical URLs while developing locally, without requiring those Standards to be published to a remote server.

The feature provides two resolution modes:
1. **URL Mapping**: Explicitly map URLs to local file paths via a mapping file (e.g., `https://example.com/standards/foo.json` → `./local/standards/foo.json`)
2. **Relative Path Resolution**: Automatically resolve relative `$ref` paths against the Pattern file's directory (for Patterns without `$id`)

### User Stories:
- As a **Standards author**, I want to validate architectures against locally-developed Standards so that I can iterate quickly without publishing to a remote server.
- As a **Pattern author**, I want my Pattern to reference Standards via canonical URLs so that they work both locally (with mapping) and in production (via actual URLs).
- As a **DevOps engineer**, I want to run validation in CI/CD pipelines using local Standards files so that I can catch compliance issues before merging.

### Current Limitations:
- The `validate` and `generate` commands can only resolve `$ref` URLs if:
  - The URL is accessible over HTTP/HTTPS
  - The schema is pre-loaded from a local schema directory
  - The reference uses the `calm:` protocol with a CALMHub server
- There's no way to map a canonical URL (e.g., `https://example.com/standards/foo.json`) to a local file during development
- Patterns that use relative `$ref` paths don't resolve correctly because the CLI doesn't track the Pattern file's location

### Proposed Implementation:

#### Technical Design
1. **New `MappedDocumentLoader` class** in `@finos/calm-shared`:
   - Accepts a `Map<string, string>` for URL-to-local-path mappings
   - Accepts a `basePath` for resolving relative paths
   - Pre-loads all mapped documents during `initialise()` for AJV compatibility
   - Stores schemas by both mapped URL and their `$id`

2. **Updated `DocumentLoaderOptions`**:
   ```typescript
   export type DocumentLoaderOptions = {
       calmHubUrl?: string;
       schemaDirectoryPath?: string;
       urlToLocalMap?: Map<string, string>;  // NEW
       basePath?: string;                     // NEW
       debug?: boolean;
   };
   ```

3. **CLI Option**: Add `-u, --url-to-local-file-mapping <path>` to `validate` and `generate` commands

#### API Changes
- `buildDocumentLoader()` accepts new `urlToLocalMap` and `basePath` options
- `MappedDocumentLoader` added first in loader chain to ensure mappings take precedence

#### Dependencies
- No new external dependencies
- Uses existing `DocumentLoader` interface and `MultiStrategyDocumentLoader` pattern

### Alternatives Considered:

1. **Extend `FileSystemDocumentLoader`**: Rejected because it would mix concerns (directory scanning vs. explicit mapping) and complicate the existing loader
2. **Add mapping to `DirectUrlDocumentLoader`**: Rejected because that loader is specifically for fetching remote URLs
3. **Command-line argument for each mapping**: Rejected because it would be unwieldy for multiple mappings; a JSON file is cleaner

### Testing Strategy:

#### Unit Tests
- `MappedDocumentLoader` tests:
  - Pre-loading mapped documents during initialise
  - Resolving URLs via mapping
  - Resolving relative paths against basePath
  - Handling missing files gracefully
  - URL mapping precedence over relative path resolution

- `DocumentLoader` factory tests:
  - Creating `MappedDocumentLoader` when options provided
  - Not creating when options not provided

#### E2E Tests
- Validate with URL mapping file when pattern has `$id`
- Validate with relative refs when pattern has no `$id`
- Validate fails for non-compliant architecture (both modes)

### Documentation Requirements:
- Update CLI help text for new `-u` option ✅
- Update `/docs/docs/working-with-calm/validate.md` with URL mapping section ✅
- Update `/docs/docs/working-with-calm/generate.md` with URL mapping section ✅
- Update `calm-ai/tools/calm-cli-instructions.md` agent prompt ✅
- Update `calm-ai/tools/standards-creation.md` with local development workflow ✅

### Implementation Checklist:
- [x] Design reviewed and approved
- [x] Implementation completed
  - [x] `MappedDocumentLoader` in shared package
  - [x] Updated `DocumentLoaderOptions` and factory
  - [x] CLI `-u` option for validate command
  - [x] CLI `-u` option for generate command
- [x] Tests written and passing
  - [x] Unit tests for `MappedDocumentLoader`
  - [x] Unit tests for factory
  - [x] E2E tests for CLI commands
- [x] Documentation updated
  - [x] CLI docs (`/docs/docs/working-with-calm/`)
  - [x] AI agent prompts (`calm-ai/tools/`)
- [ ] Relevant workflows updated (if needed)
- [ ] Performance impact assessed

### Additional Context:

#### URL Mapping File Format
```json
{
  "https://example.com/standards/node-standard.json": "standards/node-standard.json",
  "https://example.com/standards/relationship-standard.json": "standards/relationship-standard.json"
}
```

#### Usage Examples
```bash
# With URL mapping file
calm validate -p pattern.json -a architecture.json -u url-mapping.json

# Pattern with relative refs (no mapping needed)
calm validate -p patterns/my-pattern.json -a arch.json
# The Pattern can use: "$ref": "../standards/my-standard.json"
```

#### Resolution Order
1. URL mapping (if URL matches a mapping)
2. Relative path resolution (if path is relative and file exists)
3. Other loaders (CALMHub, FileSystem, DirectUrl)
