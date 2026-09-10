import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ShaCacheService } from './sha-cache-service';

describe('ShaCacheService', () => {
    let tmpDir: string;
    let service: ShaCacheService;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sha-cache-test-'));
        service = new ShaCacheService(tmpDir);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('put and get', () => {
        it('stores and retrieves content by namespace/type/slug/sha', async () => {
            const content = { nodes: [{ name: 'test', controls: { a: 1 } }] };

            await service.put('finos', 'building-blocks', 'microservice', 'abc123', content);
            const result = await service.get('finos', 'building-blocks', 'microservice', 'abc123');

            expect(result).toEqual(content);
        });

        it('returns null for missing cache entry', async () => {
            const result = await service.get('missing', 'type', 'slug', 'sha');

            expect(result).toBeNull();
        });

        it('creates directory structure as needed', async () => {
            await service.put('deep', 'nested', 'path', 'sha1', { data: true });

            const filePath = path.join(tmpDir, 'deep', 'nested', 'path', 'sha1.json');
            expect(fs.existsSync(filePath)).toBe(true);
        });

        it('overwrites existing cache entries', async () => {
            await service.put('ns', 'type', 'slug', 'sha', { version: 1 });
            await service.put('ns', 'type', 'slug', 'sha', { version: 2 });

            const result = await service.get('ns', 'type', 'slug', 'sha');
            expect(result).toEqual({ version: 2 });
        });
    });

    describe('has', () => {
        it('returns true when cache entry exists', async () => {
            await service.put('ns', 'type', 'slug', 'sha', { data: true });

            expect(service.has('ns', 'type', 'slug', 'sha')).toBe(true);
        });

        it('returns false when cache entry does not exist', () => {
            expect(service.has('ns', 'type', 'slug', 'missing')).toBe(false);
        });
    });

    describe('getCacheDir', () => {
        it('returns the configured cache directory', () => {
            expect(service.getCacheDir()).toBe(tmpDir);
        });

        it('defaults to ~/.calm/cache when no dir provided', () => {
            const defaultService = new ShaCacheService();
            expect(defaultService.getCacheDir()).toBe(
                path.join(os.homedir(), '.calm', 'cache')
            );
        });
    });

    describe('path traversal defense', () => {
        it('writes inside cache dir even with traversal characters in namespace', async () => {
            await service.put('../../etc', 'type', 'slug', 'sha', { data: true });

            // Slashes replaced with _, dots allowed → '.._.._etc'
            const escaped = path.join(tmpDir, '.._.._etc', 'type', 'slug', 'sha.json');
            expect(fs.existsSync(escaped)).toBe(true);

            const traversed = path.join(tmpDir, '..', '..', 'etc', 'type', 'slug', 'sha.json');
            expect(fs.existsSync(traversed)).toBe(false);
        });

        it('writes inside cache dir even with traversal characters in type', async () => {
            await service.put('ns', '../secret', 'slug', 'sha', { data: true });

            // Slash replaced with _ → '.._secret'
            const escaped = path.join(tmpDir, 'ns', '.._secret', 'slug', 'sha.json');
            expect(fs.existsSync(escaped)).toBe(true);

            const traversed = path.join(tmpDir, 'ns', '..', 'secret', 'slug', 'sha.json');
            expect(fs.existsSync(traversed)).toBe(false);
        });
    });

    describe('isolation', () => {
        it('different SHAs for same resource do not collide', async () => {
            await service.put('ns', 'type', 'slug', 'sha-old', { v: 1 });
            await service.put('ns', 'type', 'slug', 'sha-new', { v: 2 });

            expect(await service.get('ns', 'type', 'slug', 'sha-old')).toEqual({ v: 1 });
            expect(await service.get('ns', 'type', 'slug', 'sha-new')).toEqual({ v: 2 });
        });

        it('different namespaces do not collide', async () => {
            await service.put('ns-a', 'type', 'slug', 'sha', { from: 'a' });
            await service.put('ns-b', 'type', 'slug', 'sha', { from: 'b' });

            expect(await service.get('ns-a', 'type', 'slug', 'sha')).toEqual({ from: 'a' });
            expect(await service.get('ns-b', 'type', 'slug', 'sha')).toEqual({ from: 'b' });
        });
    });
});
