// Node-only entry for bundle export/import. Keeps consumers such as the VSCode extension
// from pulling in the full barrel (docify, playwright, spectral).
export {
    runExportCommand,
    runExportCommandSimple,
    discoverDependencies,
    extractMarkdownReferences,
    extractJsonReferences,
    computeCommonBaseDir,
    computeZipEntryNames,
    type ExportCommandOptions,
    type ExportManifest,
    type ManifestFileEntry,
    type DiscoveryResult,
    type SimpleZipArchive,
} from './commands/export/export-core.js';
export {
    runImportCommand,
    getImportDestination,
    assertSafeEntryPath,
    type ImportCommandOptions,
    type ImportResult,
    type ZipEntry,
    type ZipReader,
} from './commands/import/import-core.js';
export type { Logger } from './logger.js';
