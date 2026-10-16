import fs from 'fs';
import path from 'path';
import { CalmReferenceResolver } from './calm-reference-resolver.js';
import { isCurie, parseCurie } from '../hub/curie.js';

/**
 * Resolves CURIEs against a local filesystem path.
 * Layout mirrors the SHA cache: `{basePath}/{namespace}/{type}/{slug}/{version}.json`.
 * Enables CLI usage without a CalmHub — point at a local clone of the assets repo.
 */
export class LocalCurieReferenceResolver implements CalmReferenceResolver {
    constructor(private basePath: string) {}

    canResolve(ref: string): boolean {
        if (!isCurie(ref)) return false;
        const filePath = this.toFilePath(ref);
        return filePath !== null && fs.existsSync(filePath);
    }

    async resolve(ref: string): Promise<unknown> {
        const filePath = this.toFilePath(ref);
        if (!filePath || !fs.existsSync(filePath)) {
            throw new Error(`Local CURIE resolution failed: ${ref} → file not found`);
        }
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    private toFilePath(ref: string): string | null {
        const components = parseCurie(ref);
        if (!components || !components.version) return null;
        return path.join(
            this.basePath,
            components.namespace,
            components.type,
            components.slug,
            `${components.version}.json`
        );
    }
}
