/**
 * Browser-safe entry point (`@finos/calm-shared/browser`).
 *
 * Everything exported here must be importable in a browser bundle: no `fs`, `path`, `net`,
 * `winston`, `mkdirp`, `playwright-core`, no `process.exit`, no `__dirname`. The guard script
 * `scripts/check-browser-entry.mjs` enforces this on every test run. Node-only code lives
 * behind the root entry (`index.ts`) and is never imported from here.
 */
export {
    validate,
    formatOutput,
    formatOutput as getFormattedOutput,
    registerOutputFormatter,
    type OutputFormat,
    type ValidateOutputFormat,
    type OutputFormatter,
    type ValidationDocumentContext,
    type ValidationFormattingOptions,
} from './commands/validate/validate.js';
export { ValidationOutcome, ValidationOutput } from './commands/validate/validation.output.js';
export {
    enrichWithDocumentPositions,
    parseDocumentWithPositions,
    type ParsedDocumentContext,
} from './commands/validate/validation-enrichment.js';
export { SchemaDirectory } from './schema-directory.js';
export {
    type DocumentLoader,
    DocumentLoadError,
    assertJsonObject,
    CALM_HUB_PROTOS,
} from './document-loader/document-loader.js';
export { InMemoryDocumentLoader } from './document-loader/in-memory-document-loader.js';
export { CalmHubDocumentLoader } from './document-loader/calmhub-document-loader.js';
export { DirectUrlDocumentLoader } from './document-loader/direct-url-document-loader.js';
export { MultiStrategyDocumentLoader } from './document-loader/multi-strategy-document-loader.js';
export { buildBrowserDocumentLoader, type BrowserDocumentLoaderOptions } from './document-loader/browser-document-loader.js';
export { generate, type GenerateOptions } from './commands/generate/generate-core.js';
export { extractOptions, selectChoices, CalmChoice, CalmOption } from './commands/generate/components/options.js';
export {
    diffDocuments,
    diffTimeline,
    formatDiff,
    detectDocumentType,
    tryDetectDocumentType,
    hasChanges as diffHasChanges,
    type DiffOutputFormat,
    type DiffDocumentType,
    type DiffDocumentsOptions,
    type DiffRunResult,
    type TimelineDiffRunOptions,
    type TimelineDiffRunResult,
} from './commands/diff/diff-core.js';
export type { ArchitectureResolver, MomentDiff } from '@finos/calm-models/diff';
export { initLogger, registerNodeLoggerFactory } from './logger.js';
export type { Logger, LogLevel, NodeLoggerFactory } from './logger.js';
export { AuthPlugin } from './auth/auth-plugin.js';
export { NoAuthPlugin } from './auth/no-auth-plugin.js';
export {
    constructDocumentId,
    isConformantDocumentId,
    namespaceFromDocumentId,
    extractDocumentMetadata,
    updateDocumentMetadata,
    type DocumentMetadata,
    constructControlDocumentId,
    extractControlMetadata,
    updateControlDocumentMetadata,
    type ControlDocumentMetadata,
    type ControlDocumentKind,
} from './hub/document-id-utils.js';
export { computeSemVerBump, compareSemVer, sortSemVer } from './hub/semver.js';
export { canonicalEqual, canonicalize } from './hub/canonical.js';
export { BROWSER_COMMAND_SUPPORT, browserSupportFor, type BrowserCommandSupport } from './browser-capabilities.js';
