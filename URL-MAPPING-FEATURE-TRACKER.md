# URL-to-Local-File Mapping for Validate and Generate Commands

## Goal
Enable patterns to reference external Standards files via `$ref`, resolved through URL-to-local-file mapping and/or relative file paths.

## Progress Tracker

### Phase 1: Create MappedDocumentLoader (shared package)
- [x] Create `shared/src/document-loader/mapped-document-loader.ts`
- [x] Create `shared/src/document-loader/mapped-document-loader.spec.ts`
- [x] Verify unit tests pass (12/12 passing)

### Phase 2: Update DocumentLoader Factory (shared package)
- [ ] Update `DocumentLoaderOptions` in `document-loader.ts`
- [ ] Update `buildDocumentLoader()` to include MappedDocumentLoader
- [ ] Update `document-loader.spec.ts` with new tests

### Phase 3: Update CLI Commands (cli package)
- [ ] Add `--url-to-local-file-mapping` option to `validate` command
- [ ] Add `--url-to-local-file-mapping` option to `generate` command
- [ ] Update `ValidateOptions` interface
- [ ] Update `runValidate()` to pass mapping and basePath

### Phase 4: Export from Shared Package
- [ ] Add export to `shared/src/index.ts`

### Phase 5: Tests
- [ ] Add E2E tests for validate with URL mapping
- [ ] Add E2E tests for validate with relative refs
- [ ] Add E2E tests for generate with URL mapping
- [ ] All tests passing

## Usage Examples

### With mapping file (`url-mapping.json`):
```json
{
  "https://example.com/standards/company-node-standard.json": "standards/company-node-standard.json",
  "https://example.com/standards/company-relationship-standard.json": "standards/company-relationship-standard.json"
}
```

```bash
calm validate -p patterns/company-base-pattern.json -a arch.json -u url-mapping.json
```

### With relative refs (no mapping needed):
```json
// patterns/company-base-pattern.json
{
  "properties": {
    "nodes": {
      "items": { "$ref": "../standards/company-node-standard.json" }
    }
  }
}
```

```bash
calm validate -p patterns/company-base-pattern.json -a arch.json
```

## Notes
- MappedDocumentLoader must be first in the loader chain
- Mapped schemas need to be loaded during `initialise()` before AJV compiles
- When pre-loading, store schemas by their `$id` AND by the mapped URL
