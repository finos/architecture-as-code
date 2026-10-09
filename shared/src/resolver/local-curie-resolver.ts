import fs from 'fs';
import path from 'path';
import { CalmReferenceResolver } from './calm-reference-resolver.js';
import { isCurie, parseCurie } from '../hub/curie.js';

/**
 * Resolves CURIEs against a local filesystem path.
 * Maps `namespace:type:slug@version` to `{basePath}/{type}/{slug}.json`.
 * The version segment is ignored (local files represent the current state).
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
        if (!components) return null;
        const { type, slug } = components;
        // Try direct path: {basePath}/{type}/{slug}.json
        const direct = path.join(this.basePath, type, `${slug}.json`);
        if (fs.existsSync(direct)) return direct;
        // Try with subdirectories (scan one level): {basePath}/{type}/{subdir}/{slug}.json
        const typeDir = path.join(this.basePath, type);
        if (fs.existsSync(typeDir) && fs.statSync(typeDir).isDirectory()) {
            for (const entry of fs.readdirSync(typeDir)) {
                const subPath = path.join(typeDir, entry, `${slug}.json`);
                if (fs.existsSync(subPath)) return subPath;
            }
        }
        return null;
    }
}
