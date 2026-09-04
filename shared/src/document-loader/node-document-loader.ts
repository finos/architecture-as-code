import { CALM_META_SCHEMA_DIRECTORY } from '../consts.js';
import { CalmHubDocumentLoader } from './calmhub-document-loader.js';
import { FileSystemDocumentLoader } from './file-system-document-loader.js';
import { DirectUrlDocumentLoader } from './direct-url-document-loader.js';
import { MultiStrategyDocumentLoader } from './multi-strategy-document-loader.js';
import { MappedDocumentLoader } from './mapped-document-loader.js';
import { WorkspaceDocumentLoader } from './workspace-document-loader.js';
import type { DocumentLoader, DocumentLoaderOptions } from './document-loader.js';

export function buildDocumentLoader(docLoaderOpts: DocumentLoaderOptions): DocumentLoader {
    const loaders = [];
    const debug = docLoaderOpts.debug ?? false;

    // Workspace bundle takes top priority: local working copies override CalmHub and every
    // other source, for any reference form (bare id, $id, versioned path, or full URL).
    if (docLoaderOpts.workspaceBundlePath) {
        loaders.push(new WorkspaceDocumentLoader(docLoaderOpts.workspaceBundlePath, debug));
    }

    // Add MappedDocumentLoader FIRST if mapping or basePath provided
    // This ensures URL mappings are resolved before other loaders.
    // Note: Relative paths are handled by FileSystemDocumentLoader later in the chain.
    if ((docLoaderOpts.urlToLocalMap && docLoaderOpts.urlToLocalMap.size > 0) || docLoaderOpts.basePath) {
        loaders.push(new MappedDocumentLoader(
            docLoaderOpts.urlToLocalMap ?? new Map(),
            docLoaderOpts.basePath ?? process.cwd(),
            debug
        ));
    }

    if (docLoaderOpts.calmHubUrl) {
        loaders.push(new CalmHubDocumentLoader(docLoaderOpts.calmHubUrl, debug, docLoaderOpts.authPlugin));
    }

    // Always configure FileSystemDocumentLoader with CALM_META_SCHEMA_DIRECTORY
    const directoryPaths = [CALM_META_SCHEMA_DIRECTORY];
    if (docLoaderOpts.schemaDirectoryPath) {
        directoryPaths.push(docLoaderOpts.schemaDirectoryPath);
    }
    loaders.push(new FileSystemDocumentLoader(
        directoryPaths,
        debug,
        docLoaderOpts.basePath ?? process.cwd()
    ));

    loaders.push(new DirectUrlDocumentLoader(
        debug,
        undefined,
        docLoaderOpts.allowedRemoteHosts,
        docLoaderOpts.directUrlAuthPlugin
    ));

    return new MultiStrategyDocumentLoader(loaders, debug);
}
