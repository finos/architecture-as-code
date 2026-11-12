import type { DocumentLoaderOptions } from '@finos/calm-shared';

interface ParseDocumentLoaderOptions {
    verbose?: boolean;
    calmHubUrl?: string;
    schemaDirectory?: string;
    allowedRemoteHosts?: string;
}

function parseAllowedRemoteHosts(optionValue?: string): string[] | undefined {
    const raw = optionValue ?? process.env.CALM_ALLOWED_REMOTE_HOSTS;
    if (!raw) {
        return undefined;
    }
    const hosts = raw.split(',').map(host => host.trim()).filter(Boolean);
    return hosts.length > 0 ? hosts : undefined;
}

export function parseDocumentLoaderConfig(options: ParseDocumentLoaderOptions): DocumentLoaderOptions {
    return {
        calmHubUrl: options.calmHubUrl,
        schemaDirectoryPath: options.schemaDirectory,
        allowedRemoteHosts: parseAllowedRemoteHosts(options.allowedRemoteHosts),
        // The documents come from requests, so a local file that they reference must never be read.
        readReferencedFiles: false,
        debug: !!options.verbose
    };
}
