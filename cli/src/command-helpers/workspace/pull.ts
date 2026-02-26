import path from 'path';
import fs from 'fs';
import { buildDocumentLoader, DocumentLoader, DocumentLoaderOptions } from '../../../../shared/src/document-loader/document-loader';
import { findWorkspaceBundlePath } from '../../workspace-resolver';
import { addObjectToBundle, loadManifest, extractAllReferences } from './bundle';
import { initLogger, Logger } from '@finos/calm-shared/src/logger';

const logger: Logger = initLogger(false, 'workspace');

/**
 * Load and parse a JSON file from disk.
 * @param filePath Absolute path to the JSON file
 * @returns Parsed JSON object
 */
export async function loadJsonFile(filePath: string): Promise<unknown> {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(raw);
}

/**
 * Pull all references from files in a workspace bundle.
 * Scans each file in the manifest for reference properties ($ref, requirement-url, config-url, etc.)
 * and recursively fetches any HTTP(S) references, adding them to the bundle.
 *
 * @param bundlePath Absolute path to the workspace bundle directory
 * @param docLoader Document loader instance for fetching remote documents
 */
export async function pullReferencesFromBundle(bundlePath: string, docLoader: DocumentLoader): Promise<void> {
    const manifest = await loadManifest(bundlePath);
    const processed = new Set<string>(Object.keys(manifest));
    const queue: string[] = Object.values(manifest).map(p => path.join(bundlePath, p));

    while (queue.length > 0) {
        const filePath = queue.shift()!;
        let json: unknown;
        try {
            json = await loadJsonFile(filePath);
        } catch (e) {
            logger.warn('Failed to parse JSON ' + filePath + ': ' + (e instanceof Error ? e.message : String(e)));
            continue;
        }

        const refs = extractAllReferences(json);

        for (const ref of refs) {
            // skip if already processed
            if (processed.has(ref)) {
                continue;
            }
            // skip local references
            if (!ref.startsWith('http')) {
                // local reference; skip
                continue;
            }
            const resolved = docLoader.resolvePath(ref);
            try {
                const loaded = await docLoader.loadMissingDocument(ref, 'schema').catch(async (e) => {
                    // if resolvePath returned a local file path, try loading from it directly
                    if (resolved) {
                        return await loadJsonFile(resolved);
                    }
                    throw e;
                }) as object;

                // loaded may be object; determine id
                const added = await addObjectToBundle(bundlePath, loaded);
                if (!processed.has(added.id)) {
                    processed.add(added.id);
                    queue.push(added.destPath);
                }
            } catch (e) {
                logger.warn(`Failed to load reference ${ref}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }
}

/**
 * Pull all referenced documents for a workspace bundle.
 *
 * This will:
 *  - locate the workspace bundle (if bundlePath not provided),
 *  - build a DocumentLoader from provided options (or defaults),
 *  - recursively load all documents referenced via $ref from files in the bundle,
 *    storing them in the bundle and updating the manifest. Already-registered
 *    document ids in the bundle manifest are not re-fetched.
 *
 * @param bundlePath Optional absolute path to the workspace bundle. If omitted the current
 *                   repository workspace bundle will be discovered.
 * @param docLoaderOpts Optional DocumentLoaderOptions to configure the document loader.
 */
export async function pullWorkspaceBundle(bundlePath?: string, docLoaderOpts?: DocumentLoaderOptions): Promise<void> {
    const bp = bundlePath || findWorkspaceBundlePath(process.cwd());
    if (!bp) {
        throw new Error('No CALM workspace bundle found.');
    }

    const opts: DocumentLoaderOptions = docLoaderOpts ?? {};
    const docLoader = buildDocumentLoader(opts);
    // Note: we don't call initialise() here because pull only needs loadMissingDocument()
    // to fetch external URLs, not pre-loaded filesystem schemas.

    await pullReferencesFromBundle(bp, docLoader);
}
