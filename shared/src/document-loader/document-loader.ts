import type { AuthPlugin } from '../auth/auth-plugin.js';
import type { DirectUrlAuthPlugin } from '../auth/direct-url-auth-plugin.js';

export const CALM_HUB_PROTOS = ['http:', 'https:', 'calm:'];
export type { DocumentLoader } from './types.js';
export { DocumentLoadError } from './types.js';
import { DocumentLoadError } from './types.js';

export type DocumentLoaderOptions = {
    calmHubUrl?: string;
    authPlugin?: AuthPlugin;
    directUrlAuthPlugin?: DirectUrlAuthPlugin;
    directUrlAuthAuthenticatedHosts?: string[];
    schemaDirectoryPath?: string;
    urlToLocalMap?: Map<string, string>;
    basePath?: string;
    allowedRemoteHosts?: string[];
    debug?: boolean;
    // If set, a WorkspaceDocumentLoader is added as the highest-priority source, resolving any
    // reference to a document tracked in the workspace bundle at this path to its local copy.
    workspaceBundlePath?: string;
};

export function assertJsonObject(data: unknown, source: string): asserts data is object {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        const kind = data === null ? 'null' : Array.isArray(data) ? 'array' : typeof data;
        // Fatal: the loader successfully fetched this reference, but the payload is invalid.
        // This must surface to the user rather than fall through to another loader.
        throw new DocumentLoadError({
            name: 'UNKNOWN',
            message: `Expected a JSON object from ${source} but received: ${kind}`,
            recoverable: false
        });
    }
}
