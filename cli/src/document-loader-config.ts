import { AuthPlugin, DocumentLoaderOptions, initLogger, Logger } from '@finos/calm-shared';
import * as cliConfig from './cli-config';
import { findWorkspaceManifestPath } from './workspace-resolver';

export interface ParseDocumentLoaderOptions {
    verbose?: boolean;
    calmHubUrl?: string;
    schemaDirectory?: string;
    allowedRemoteHosts?: string[];
    // Each load makes a new plugin instance, so a caller that already has one passes it to avoid a second login.
    authPlugin?: AuthPlugin;
    workspaceBundlePath?: string;
}

export async function parseDocumentLoaderConfig(
    options: ParseDocumentLoaderOptions,
    urlToLocalMap?: Map<string, string>,
    basePath?: string
): Promise<DocumentLoaderOptions> {
    const logger = initLogger(options.verbose ?? false, 'calm-cli');
    const docLoaderOpts: DocumentLoaderOptions = {
        calmHubUrl: options.calmHubUrl,
        schemaDirectoryPath: options.schemaDirectory,
        urlToLocalMap: urlToLocalMap,
        basePath: basePath,
        allowedRemoteHosts: options.allowedRemoteHosts,
        debug: !!options.verbose
    };

    const userConfig = await cliConfig.loadCliConfig();
    if (userConfig && userConfig.calmHubUrl && !options.calmHubUrl) {
        logger.info('Using CALMHub URL from config file: ' + userConfig.calmHubUrl);
        docLoaderOpts.calmHubUrl = userConfig.calmHubUrl;
    }
    
    // if we have an auth plugin and we have calmHub configured
    if (options.authPlugin) {
        docLoaderOpts.authPlugin = options.authPlugin;
    } else if (userConfig && userConfig.authPluginPath) {
        logger.info('Loading auth plugin from config file: ' + userConfig.authPluginPath);
        try {
            const authPlugin = await cliConfig.loadAuthPlugin(userConfig.authPluginPath, !!options.verbose);
            docLoaderOpts.authPlugin = authPlugin;
            logger.debug('Auth plugin loaded successfully');
        } catch (err) {
            logger.error('Failed to load auth plugin: ' + (err instanceof Error ? err.message : String(err)));
        }
    }

    const directUrlAuthConfig = cliConfig.getDirectUrlAuthConfig(userConfig);
    if (directUrlAuthConfig) {
        try {
            cliConfig.validateDirectUrlAuthConfig(directUrlAuthConfig);
            const directUrlAuthConfigPath = directUrlAuthConfig.configPath !== undefined
                ? directUrlAuthConfig.configPath
                : 'not specified';
            logger.info('Loading direct URL auth module from config file: ' + directUrlAuthConfig.module);
            logger.info('Direct URL auth configPath: ' + directUrlAuthConfigPath);
            const directUrlAuthPlugin = await cliConfig.loadDirectUrlAuthPlugin(directUrlAuthConfig, !!options.verbose);
            docLoaderOpts.directUrlAuthPlugin = directUrlAuthPlugin;
            docLoaderOpts.directUrlAuthAuthenticatedHosts = directUrlAuthConfig.authenticatedHosts;
            logger.debug('Direct URL auth module loaded successfully');
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('Direct URL authentication setup failed: ' + message);
            throw new Error('Direct URL authentication setup failed: ' + message);
        }
    }

    // If a CALM workspace bundle is present in the repository, prefer it for resolving documents.
    // The WorkspaceDocumentLoader (added first by buildDocumentLoader when workspaceBundlePath is
    // set) resolves any reference to a tracked document — bare id, $id, versioned path, or full
    // URL — to the local working copy, overriding CalmHub.
    const workspaceBundle = options.workspaceBundlePath ?? findWorkspaceBundle(logger);
    if (workspaceBundle) {
        docLoaderOpts.workspaceBundlePath = workspaceBundle;
        // Fall back to the bundle as the base path so relative references still resolve.
        docLoaderOpts.basePath = docLoaderOpts.basePath ?? workspaceBundle;
    }

    if (userConfig && userConfig.allowedRemoteHosts && !options.allowedRemoteHosts) {
        logger.info('Using allowed remote hosts from config file');
        docLoaderOpts.allowedRemoteHosts = userConfig.allowedRemoteHosts;
    }
    return docLoaderOpts;
}

function findWorkspaceBundle(logger: Logger): string | undefined {
    try {
        const workspaceBundle = findWorkspaceManifestPath(process.cwd());
        if (workspaceBundle) {
            logger.info('Using workspace bundle for document resolution: ' + workspaceBundle);
            return workspaceBundle;
        }
    } catch (err) {
        logger.debug('Error while checking for workspace bundle: ' + (err instanceof Error ? err.message : String(err)));
    }
    return undefined;
}
