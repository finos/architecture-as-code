import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Filesystem-based SHA cache for resolved Hub resources.
 * Stores content at `~/.calm/cache/<namespace>/<type>/<slug>/<sha>.json`.
 * All operations are synchronous for fast reads on cached content.
 */
export class ShaCacheService {
    private cacheDir: string;

    constructor(cacheDir?: string) {
        this.cacheDir = cacheDir ?? path.join(os.homedir(), '.calm', 'cache');
    }

    async get(
        namespace: string,
        type: string,
        slug: string,
        sha: string
    ): Promise<unknown | null> {
        const filePath = this.getCachePath(namespace, type, slug, sha);
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(content);
        } catch {
            return null;
        }
    }

    async put(
        namespace: string,
        type: string,
        slug: string,
        sha: string,
        content: unknown
    ): Promise<void> {
        const filePath = this.getCachePath(namespace, type, slug, sha);
        const dir = path.dirname(filePath);
        // Round-trip through JSON to ensure only valid JSON is written
        const serialized = JSON.stringify(content, null, 2);
        const validated = JSON.parse(serialized) as unknown;
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(validated, null, 2));
    }

    has(namespace: string, type: string, slug: string, sha: string): boolean {
        return fs.existsSync(this.getCachePath(namespace, type, slug, sha));
    }

    getCacheDir(): string {
        return this.cacheDir;
    }

    private sanitizeSegment(segment: string): string {
        return segment.replace(/[^a-zA-Z0-9._-]/g, '_');
    }

    private getCachePath(
        namespace: string,
        type: string,
        slug: string,
        sha: string
    ): string {
        const safePath = path.join(
            this.cacheDir,
            this.sanitizeSegment(namespace),
            this.sanitizeSegment(type),
            this.sanitizeSegment(slug),
            `${this.sanitizeSegment(sha)}.json`
        );
        if (!safePath.startsWith(this.cacheDir)) {
            throw new Error('Invalid cache path');
        }
        return safePath;
    }
}
