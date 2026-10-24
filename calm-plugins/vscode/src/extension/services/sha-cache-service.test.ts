import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ShaCacheService } from './sha-cache-service';

const HUB = 'hub1';

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
        it('stores and retrieves content by hubHash/namespace/type/slug/sha', async () => {
            const content = { nodes: [{ name: 'test', controls: { a: 1 } }] };
            await service.put(HUB, 'finos', 'standards', 'microservice', 'abc123', content);
            const result = await service.get(HUB, 'finos', 'standards', 'microservice', 'abc123');
            expect(result).toEqual(content);
        });

        it('returns null for missing cache entry', async () => {
            expect(await service.get(HUB, 'missing', 'type', 'slug', 'sha')).toBeNull();
        });

        it('creates directory structure under hubHash', async () => {
            await service.put(HUB, 'deep', 'nested', 'slug', 'sha1', { data: true });
            const filePath = path.join(tmpDir, HUB, 'deep', 'nested', 'slug', 'sha1.json');
            expect(fs.existsSync(filePath)).toBe(true);
        });

        it('overwrites existing cache entries', async () => {
            await service.put(HUB, 'ns', 'type', 'slug', 'sha', { version: 1 });
            await service.put(HUB, 'ns', 'type', 'slug', 'sha', { version: 2 });
            expect(await service.get(HUB, 'ns', 'type', 'slug', 'sha')).toEqual({ version: 2 });
        });
    });

    describe('SNAPSHOT skipping', () => {
        it('does not cache -SNAPSHOT versions', async () => {
            await service.put(HUB, 'ns', 'type', 'slug', '1.0.0-SNAPSHOT', { v: 1 });
            expect(await service.get(HUB, 'ns', 'type', 'slug', '1.0.0-SNAPSHOT')).toBeNull();
        });

        it('has returns false for -SNAPSHOT', async () => {
            expect(service.has(HUB, 'ns', 'type', 'slug', '2.0.0-SNAPSHOT')).toBe(false);
        });

        it('caches non-SNAPSHOT versions normally', async () => {
            await service.put(HUB, 'ns', 'type', 'slug', '1.0.0', { v: 1 });
            expect(await service.get(HUB, 'ns', 'type', 'slug', '1.0.0')).toEqual({ v: 1 });
        });
    });

    describe('has', () => {
        it('returns true when cache entry exists', async () => {
            await service.put(HUB, 'ns', 'type', 'slug', 'sha', { data: true });
            expect(service.has(HUB, 'ns', 'type', 'slug', 'sha')).toBe(true);
        });

        it('returns false when cache entry does not exist', () => {
            expect(service.has(HUB, 'ns', 'type', 'slug', 'missing')).toBe(false);
        });
    });

    describe('getCacheDir', () => {
        it('returns the configured cache directory', () => {
            expect(service.getCacheDir()).toBe(tmpDir);
        });

        it('defaults to ~/.calm/cache when no dir provided', () => {
            const defaultService = new ShaCacheService();
            expect(defaultService.getCacheDir()).toBe(path.join(os.homedir(), '.calm', 'cache'));
        });
    });

    describe('path traversal defense', () => {
        it('writes inside cache dir even with traversal characters', async () => {
            await service.put(HUB, '../../etc', 'type', 'slug', 'sha', { data: true });
            const escaped = path.join(tmpDir, HUB, '.._.._etc', 'type', 'slug', 'sha.json');
            expect(fs.existsSync(escaped)).toBe(true);
            const traversed = path.join(tmpDir, '..', '..', 'etc', 'type', 'slug', 'sha.json');
            expect(fs.existsSync(traversed)).toBe(false);
        });
    });

    describe('isolation', () => {
        it('different SHAs do not collide', async () => {
            await service.put(HUB, 'ns', 'type', 'slug', 'sha-old', { v: 1 });
            await service.put(HUB, 'ns', 'type', 'slug', 'sha-new', { v: 2 });
            expect(await service.get(HUB, 'ns', 'type', 'slug', 'sha-old')).toEqual({ v: 1 });
            expect(await service.get(HUB, 'ns', 'type', 'slug', 'sha-new')).toEqual({ v: 2 });
        });

        it('different hubs do not collide', async () => {
            await service.put('hubA', 'ns', 'type', 'slug', 'sha', { from: 'a' });
            await service.put('hubB', 'ns', 'type', 'slug', 'sha', { from: 'b' });
            expect(await service.get('hubA', 'ns', 'type', 'slug', 'sha')).toEqual({ from: 'a' });
            expect(await service.get('hubB', 'ns', 'type', 'slug', 'sha')).toEqual({ from: 'b' });
        });
    });

    describe('palette cache', () => {
        it('round-trips palette data', async () => {
            const palette = [{ name: 'ns1', standardNodes: [{ id: 'svc' }] }];
            await service.putPalette('abc123', palette);
            expect(await service.getPalette('abc123')).toEqual(palette);
        });

        it('returns null for missing palette', async () => {
            expect(await service.getPalette('nonexistent')).toBeNull();
        });

        it('clearHub removes palette and per-standard caches', async () => {
            await service.putPalette(HUB, [{ name: 'ns' }]);
            await service.put(HUB, 'ns', 'standards', 'svc', 'sha1', { controls: {} });
            await service.clearHub(HUB);
            expect(await service.getPalette(HUB)).toBeNull();
            expect(await service.get(HUB, 'ns', 'standards', 'svc', 'sha1')).toBeNull();
        });
    });
});
