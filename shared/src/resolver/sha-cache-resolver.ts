import fs from 'fs';
import path from 'path';
import os from 'os';
import { CalmReferenceResolver } from './calm-reference-resolver.js';
import { isCurie, parseCurie } from '../hub/curie.js';

/**
 * Resolves CURIEs from the permanent SHA cache at ~/.calm/cache.
 * Layout: ~/.calm/cache/{namespace}/{type}/{slug}/{version}.json
 * Content at a SHA is immutable — once cached, valid forever.
 */
export class ShaCacheReferenceResolver implements CalmReferenceResolver {
    private cacheDir: string;

    constructor(cacheDir?: string) {
        this.cacheDir = cacheDir ?? path.join(os.homedir(), '.calm', 'cache');
    }

    canResolve(ref: string): boolean {
        if (!isCurie(ref)) return false;
        const filePath = this.toFilePath(ref);
        return filePath !== null && fs.existsSync(filePath);
    }

    async resolve(ref: string): Promise<unknown> {
        const filePath = this.toFilePath(ref);
        if (!filePath || !fs.existsSync(filePath)) {
            throw new Error(`SHA cache miss: ${ref}`);
        }
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    async put(ref: string, content: unknown): Promise<void> {
        const filePath = this.toFilePath(ref);
        if (!filePath) return;
        const dir = path.dirname(filePath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
    }

    private toFilePath(ref: string): string | null {
        const components = parseCurie(ref);
        if (!components || !components.version) return null;
        return path.join(
            this.cacheDir,
            components.namespace,
            components.type,
            components.slug,
            `${components.version}.json`
        );
    }
}
