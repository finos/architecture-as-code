import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const SNAPSHOT_RE = /-SNAPSHOT$/i;

/**
 * Filesystem-based SHA cache for resolved Hub resources.
 * Stores content at `~/.calm/cache/<hubHash>/<namespace>/<type>/<slug>/<sha>.json`.
 * Mutable versions (-SNAPSHOT) are never cached.
 */
export class ShaCacheService {
    private cacheDir: string;

    constructor(cacheDir?: string) {
        this.cacheDir = cacheDir ?? path.join(os.homedir(), '.calm', 'cache');
    }

    async get(
        hubHash: string,
        namespace: string,
        type: string,
        slug: string,
        sha: string
    ): Promise<unknown | null> {
        if (SNAPSHOT_RE.test(sha)) return null;
        const filePath = this.getCachePath(hubHash, namespace, type, slug, sha);
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            return JSON.parse(content);
        } catch {
            return null;
        }
    }

    async put(
        hubHash: string,
        namespace: string,
        type: string,
        slug: string,
        sha: string,
        content: unknown
    ): Promise<void> {
        if (SNAPSHOT_RE.test(sha)) return;
        const filePath = this.getCachePath(hubHash, namespace, type, slug, sha);
        const dir = path.dirname(filePath);
        const serialized = JSON.stringify(content, null, 2);
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(filePath, serialized);
    }

    has(hubHash: string, namespace: string, type: string, slug: string, sha: string): boolean {
        if (SNAPSHOT_RE.test(sha)) return false;
        return fs.existsSync(this.getCachePath(hubHash, namespace, type, slug, sha));
    }

    getCacheDir(): string {
        return this.cacheDir;
    }

    async getPalette(hubHash: string): Promise<unknown | null> {
        const filePath = path.join(this.cacheDir, this.sanitizeSegment(hubHash), 'palette.json');
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            return JSON.parse(content);
        } catch {
            return null;
        }
    }

    async putPalette(hubHash: string, data: unknown): Promise<void> {
        const filePath = path.join(this.cacheDir, this.sanitizeSegment(hubHash), 'palette.json');
        const dir = path.dirname(filePath);
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
    }

    async clearHub(hubHash: string): Promise<void> {
        const dir = path.join(this.cacheDir, this.sanitizeSegment(hubHash));
        try {
            await fs.promises.rm(dir, { recursive: true, force: true });
        } catch { /* ignore */ }
    }

    private sanitizeSegment(segment: string): string {
        return segment.replace(/[^a-zA-Z0-9._-]/g, '_');
    }

    private getCachePath(
        hubHash: string,
        namespace: string,
        type: string,
        slug: string,
        sha: string
    ): string {
        const safePath = path.join(
            this.cacheDir,
            this.sanitizeSegment(hubHash),
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
