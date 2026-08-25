import { registerNodeLoggerFactory } from './logger.js';
import { createWinstonLogger } from './logger.node.js';

registerNodeLoggerFactory(createWinstonLogger);

export {
    validate,
    formatOutput as getFormattedOutput,
    exitBasedOffOfValidationOutcome,
    ValidationFormattingOptions,
    ValidationDocumentContext,
} from './commands/validate/validate.js';
export { OutputFormat, ValidateOutputFormat } from './commands/validate/validate.js';
export { runGenerate } from './commands/generate/generate.js';
export {
    runDiff,
    formatDiff,
    detectDocumentType,
    hasChanges as diffHasChanges,
    runTimelineDiff,
    createFileSystemArchitectureResolver,
    type DiffOutputFormat,
    type DiffDocumentType,
    type DiffRunOptions,
    type DiffRunResult,
    type TimelineDiffRunOptions,
    type TimelineDiffRunResult,
} from './commands/diff/diff.js';
export type { ArchitectureResolver, MomentDiff } from '@finos/calm-models/diff';
export {
    extractOptions,
    selectChoices,
    CalmChoice,
    CalmOption,
} from './commands/generate/components/options.js';
export { ValidationOutput } from './commands/validate/validation.output.js';
export { CALM_META_SCHEMA_DIRECTORY } from './consts.js';
export { SchemaDirectory } from './schema-directory.js';
export { initLogger, registerNodeLoggerFactory } from './logger.js';
export type { Logger, LogLevel, NodeLoggerFactory } from './logger.js';
export { createWinstonLogger } from './logger.node.js';
export { AuthPlugin } from './auth/auth-plugin.js';
export { NoAuthPlugin } from './auth/no-auth-plugin.js';
export { TemplateProcessor, TemplateProcessingMode } from './template/template-processor.js';
export * from './template/types.js';
export {
    parseFrontMatter,
    parseFrontMatterFromContent,
    hasArchitectureFrontMatter,
    replaceVariables,
    injectFrontMatter,
    injectWidgetOptionsIntoContent,
    type ParsedFrontMatter,
    type FrontMatterInjectionParams
} from './template/front-matter.js';
export { Docifier, DocifyMode, DiagramExportFormat } from './docify/docifier.js';
export { C4Model } from './docify/graphing/c4.js';
export { CalmRelationshipGraph } from './docify/graphing/relationship-graph.js';
export { ValidationOutcome } from './commands/validate/validation.output.js';
export { setWidgetLogger, type WidgetLogger } from '@finos/calm-widgets';
export { DocumentLoader, DocumentLoaderOptions, DocumentLoadError, assertJsonObject, CALM_HUB_PROTOS } from './document-loader/document-loader.js';
export { buildDocumentLoader } from './document-loader/node-document-loader.js';
export { FileSystemDocumentLoader } from './document-loader/file-system-document-loader.js';
export { WorkspaceDocumentLoader } from './document-loader/workspace-document-loader.js';
export * from './document-loader/loading-helpers.js';
export {
    hasArchitectureExtension,
    hasMappingFileExtension,
    getFileExtension
} from './util/file-utils.js';
export {
    CalmHubClient,
    HubClientError,
    RESOURCE_TYPES,
    type HubNamespaceSummary,
    type HubCreateResult,
    type HubNamespaceCreateResult,
    type HubDomainCreateResult,
    type HubDomainSummary,
    type HubControlSummary,
    type CalmHubOptions,
    type ResourceType,
    type ResourceChangeType,
    isValidResourceType
} from './hub/calm-hub-client.js';
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
    type ControlDocumentKind
} from './hub/document-id-utils.js';
export { computeSemVerBump, compareSemVer, sortSemVer } from './hub/semver.js';
export { canonicalEqual, canonicalize } from './hub/canonical.js';
export {
    enrichWithDocumentPositions,
    parseDocumentWithPositions,
    type ParsedDocumentContext,
    __test__ as validationEnrichmentTest
} from './commands/validate/validation-enrichment.js';
