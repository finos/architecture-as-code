import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ShaCacheReferenceResolver } from './sha-cache-resolver';

describe('ShaCacheReferenceResolver', () => {
    let tmpDir: string;
    let resolver: ShaCacheReferenceResolver;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sha-cache-test-'));
        resolver = new ShaCacheReferenceResolver(tmpDir);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('canResolve returns false for non-CURIE refs', () => {
        expect(resolver.canResolve('https://example.com/doc.json')).toBe(false);
    });

    it('canResolve returns false when file does not exist', () => {
        expect(resolver.canResolve('ns:controls:my-ctrl@1.0.0')).toBe(false);
    });

    it('canResolve returns true when cached file exists', async () => {
        await resolver.put('ns:controls:my-ctrl@1.0.0', { id: 'ctrl-1' });
        expect(resolver.canResolve('ns:controls:my-ctrl@1.0.0')).toBe(true);
    });

    it('resolve returns cached content', async () => {
        const content = { id: 'ctrl-1', name: 'Test Control' };
        await resolver.put('ns:controls:my-ctrl@1.0.0', content);
        const result = await resolver.resolve('ns:controls:my-ctrl@1.0.0');
        expect(result).toEqual(content);
    });

    it('resolve throws on cache miss', async () => {
        await expect(resolver.resolve('ns:controls:missing@1.0.0')).rejects.toThrow('SHA cache miss');
    });

    it('put is a no-op for invalid CURIEs', async () => {
        await resolver.put('not-a-curie', { data: true });
        expect(fs.readdirSync(tmpDir)).toHaveLength(0);
    });

    it('canResolve returns false for CURIEs without version', () => {
        expect(resolver.canResolve('ns:controls:my-ctrl')).toBe(false);
    });
});
