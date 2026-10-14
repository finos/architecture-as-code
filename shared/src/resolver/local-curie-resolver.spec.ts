import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { LocalCurieReferenceResolver } from './local-curie-resolver';

describe('LocalCurieReferenceResolver', () => {
    let tmpDir: string;
    let resolver: LocalCurieReferenceResolver;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-curie-test-'));
        resolver = new LocalCurieReferenceResolver(tmpDir);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function writeFixture(namespace: string, type: string, slug: string, version: string, content: object): void {
        const dir = path.join(tmpDir, namespace, type, slug);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${version}.json`), JSON.stringify(content));
    }

    it('canResolve returns false for non-CURIE refs', () => {
        expect(resolver.canResolve('https://example.com/doc.json')).toBe(false);
    });

    it('canResolve returns false when file does not exist', () => {
        expect(resolver.canResolve('ns:controls:my-ctrl@1.0.0')).toBe(false);
    });

    it('canResolve returns false for CURIE without version', () => {
        writeFixture('ns', 'controls', 'my-ctrl', '1.0.0', { id: 'ctrl-1' });
        expect(resolver.canResolve('ns:controls:my-ctrl')).toBe(false);
    });

    it('canResolve returns true when file exists at namespace/type/slug/version.json', () => {
        writeFixture('ns', 'controls', 'my-ctrl', '1.0.0', { id: 'ctrl-1' });
        expect(resolver.canResolve('ns:controls:my-ctrl@1.0.0')).toBe(true);
    });

    it('resolve returns parsed JSON', async () => {
        writeFixture('ns', 'controls', 'my-ctrl', '1.0.0', { id: 'ctrl-1' });
        const result = await resolver.resolve('ns:controls:my-ctrl@1.0.0');
        expect(result).toEqual({ id: 'ctrl-1' });
    });

    it('different namespaces resolve to different files', async () => {
        writeFixture('teamA', 'architectures', 'app', '1.0.0', { id: 'teamA-app' });
        writeFixture('teamB', 'architectures', 'app', '1.0.0', { id: 'teamB-app' });

        expect(await resolver.resolve('teamA:architectures:app@1.0.0')).toEqual({ id: 'teamA-app' });
        expect(await resolver.resolve('teamB:architectures:app@1.0.0')).toEqual({ id: 'teamB-app' });
    });

    it('different versions resolve to different files', async () => {
        writeFixture('ns', 'architectures', 'app', '1.0.0', { id: 'v1' });
        writeFixture('ns', 'architectures', 'app', '2.0.0', { id: 'v2' });

        expect(await resolver.resolve('ns:architectures:app@1.0.0')).toEqual({ id: 'v1' });
        expect(await resolver.resolve('ns:architectures:app@2.0.0')).toEqual({ id: 'v2' });
    });

    it('resolve throws when file not found', async () => {
        await expect(resolver.resolve('ns:controls:missing@1.0.0')).rejects.toThrow('Local CURIE resolution failed');
    });
});
