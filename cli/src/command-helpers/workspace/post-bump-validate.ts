import { readFile } from 'fs/promises';
import { validate, CALM_META_SCHEMA_DIRECTORY, buildDocumentLoader, SchemaDirectory, loadPatternFromDocumentIfPresent, initLogger, CalmHubOptions } from '@finos/calm-shared';
import { parseDocumentLoaderConfig } from '../../document-loader-config';
import { resolveFilePath } from './bundle';

const logger = initLogger(false, 'workspace-post-bump-validate');

export interface PostBumpValidationResult {
    id: string;
    filePath: string;
    type: 'architecture' | 'pattern';
    passed: boolean;
    /** Number of validation errors, or -1 if the file could not be read/parsed. */
    errorCount: number;
}

/**
 * Silently validate every architecture and pattern tracked in the workspace manifest and
 * return a pass/fail summary. Errors from individual documents are captured rather than thrown
 * so that a single bad file does not abort the rest.
 */
export async function runPostBumpValidation(
    bundlePath: string,
    manifest: Record<string, { path: string; type: string }>,
    calmHubOptions?: CalmHubOptions
): Promise<PostBumpValidationResult[]> {
    const entries = Object.entries(manifest).filter(([, entry]) => entry.type === 'architecture' || entry.type === 'pattern');
    if (entries.length === 0) return [];

    // The same user config as `calm validate`, so a `$schema` on CalmHub loads with its auth.
    const docLoader = buildDocumentLoader({
        ...await parseDocumentLoaderConfig({
            calmHubUrl: calmHubOptions?.calmHubUrl,
            authPlugin: calmHubOptions?.authPlugin,
            workspaceBundlePath: bundlePath,
        }),
        schemaDirectoryPath: CALM_META_SCHEMA_DIRECTORY,
        workspaceBundlePath: bundlePath,
        basePath: bundlePath,
        debug: false,
    });
    const schemaDir = new SchemaDirectory(docLoader, false);
    await schemaDir.loadSchemas();

    const results: PostBumpValidationResult[] = [];

    for (const [id, entry] of entries) {
        const type = entry.type as 'architecture' | 'pattern';
        const filePath = resolveFilePath(bundlePath, entry.path);

        let content: object;
        try {
            content = JSON.parse(await readFile(filePath, 'utf8'));
        } catch {
            results.push({ id, filePath, type, passed: false, errorCount: -1 });
            continue;
        }

        try {
            let outcome;
            if (type === 'architecture') {
                // Resolve the architecture's own pattern via its `$schema` (the same way the real
                // `calm validate -a` path does through loadPatternFromDocumentIfPresent) and pass it
                // as the pattern argument so validate() runs in architecture-with-pattern mode. Passing
                // undefined here would fall back to architecture-only mode, which only runs generic
                // CALM-core-schema/spectral checks and can never catch an architecture that has drifted
                // out of conformance with its pattern — exactly the regression this feature exists to catch.
                const pattern = await loadPatternFromDocumentIfPresent(content, filePath, docLoader, schemaDir, logger);
                outcome = await validate(content, pattern, undefined, schemaDir, false);
            } else {
                outcome = await validate(undefined, content, undefined, schemaDir, false);
            }

            const errorCount = outcome.allValidationOutputs().filter(o => o.severity === 'error').length;
            results.push({ id, filePath, type, passed: !outcome.hasErrors, errorCount });
        } catch {
            results.push({ id, filePath, type, passed: false, errorCount: -1 });
        }
    }

    return results;
}
