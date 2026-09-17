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

    it('canResolve returns false for non-CURIE refs', () => {
        expect(resolver.canResolve('https://example.com/doc.json')).toBe(false);
    });

    it('canResolve returns false when file does not exist', () => {
        expect(resolver.canResolve('ns:controls:my-ctrl@1.0.0')).toBe(false);
    });

    it('canResolve returns true when direct path file exists', () => {
        const controlsDir = path.join(tmpDir, 'controls');
        fs.mkdirSync(controlsDir, { recursive: true });
        fs.writeFileSync(path.join(controlsDir, 'my-ctrl.json'), '{"id":"ctrl-1"}');

        expect(resolver.canResolve('ns:controls:my-ctrl@1.0.0')).toBe(true);
    });

    it('resolve returns parsed JSON from direct path', async () => {
        const controlsDir = path.join(tmpDir, 'controls');
        fs.mkdirSync(controlsDir, { recursive: true });
        fs.writeFileSync(path.join(controlsDir, 'my-ctrl.json'), '{"id":"ctrl-1"}');

        const result = await resolver.resolve('ns:controls:my-ctrl@1.0.0');
        expect(result).toEqual({ id: 'ctrl-1' });
    });

    it('resolve finds file in subdirectory', () => {
        const subDir = path.join(tmpDir, 'controls', 'sub');
        fs.mkdirSync(subDir, { recursive: true });
        fs.writeFileSync(path.join(subDir, 'nested-ctrl.json'), '{"id":"nested"}');

        expect(resolver.canResolve('ns:controls:nested-ctrl@1.0.0')).toBe(true);
    });

    it('resolve throws when file not found', async () => {
        await expect(resolver.resolve('ns:controls:missing@1.0.0')).rejects.toThrow('Local CURIE resolution failed');
    });
});
