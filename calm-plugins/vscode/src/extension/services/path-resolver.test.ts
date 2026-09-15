import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveLocalPath, resolveSafeWritePath } from './path-resolver';

let rootA: string;
let rootB: string;
let external: string;

beforeAll(() => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'calm-pathres-'));
    rootA = path.join(base, 'rootA');
    rootB = path.join(base, 'rootB');
    external = path.join(base, 'external');
    fs.mkdirSync(path.join(rootA, 'controls'), { recursive: true });
    fs.mkdirSync(path.join(rootB, 'controls'), { recursive: true });
    fs.mkdirSync(path.join(external, 'controls'), { recursive: true });
    fs.writeFileSync(path.join(rootA, 'controls', 'a.requirement.json'), '{}');
    fs.writeFileSync(path.join(rootB, 'controls', 'b.requirement.json'), '{}');
    fs.writeFileSync(path.join(external, 'controls', 'e.requirement.json'), '{}');
    // Same relative path present in both roots — first root must win.
    fs.writeFileSync(path.join(rootA, 'controls', 'dup.requirement.json'), '{"r":"a"}');
    fs.writeFileSync(path.join(rootB, 'controls', 'dup.requirement.json'), '{"r":"b"}');
});

afterAll(() => {
    fs.rmSync(path.dirname(rootA), { recursive: true, force: true });
});

describe('resolveLocalPath', () => {
    it('resolves a file in the first workspace root', () => {
        const resolved = resolveLocalPath('controls/a.requirement.json', [rootA, rootB]);
        expect(resolved).toBe(path.join(rootA, 'controls', 'a.requirement.json'));
    });

    it('falls through to a later root', () => {
        const resolved = resolveLocalPath('controls/b.requirement.json', [rootA, rootB]);
        expect(resolved).toBe(path.join(rootB, 'controls', 'b.requirement.json'));
    });

    it('is deterministic: first root wins on a duplicate relative path', () => {
        const resolved = resolveLocalPath('controls/dup.requirement.json', [rootA, rootB]);
        expect(resolved).toBe(path.join(rootA, 'controls', 'dup.requirement.json'));
    });

    it('searches the external assets path last', () => {
        const resolved = resolveLocalPath(
            'controls/e.requirement.json',
            [rootA, rootB],
            external
        );
        expect(resolved).toBe(path.join(external, 'controls', 'e.requirement.json'));
    });

    it('rejects parent traversal', () => {
        expect(resolveLocalPath('../rootB/controls/b.requirement.json', [rootA])).toBeNull();
    });

    it('rejects an absolute POSIX path', () => {
        expect(resolveLocalPath('/etc/passwd', [rootA])).toBeNull();
    });

    it('rejects a Windows drive-letter path', () => {
        expect(resolveLocalPath('C:\\Windows\\x', [rootA])).toBeNull();
    });

    it('returns null when the file does not exist in any root', () => {
        expect(resolveLocalPath('controls/missing.requirement.json', [rootA, rootB])).toBeNull();
    });
});

describe('resolveSafeWritePath', () => {
    it('returns the write target when the parent directory exists', () => {
        const target = resolveSafeWritePath('controls/new.requirement.json', rootA);
        expect(target).toBe(path.join(rootA, 'controls', 'new.requirement.json'));
    });

    it('returns null when the parent directory is missing', () => {
        expect(resolveSafeWritePath('missing-dir/new.requirement.json', rootA)).toBeNull();
    });

    it('rejects traversal on write', () => {
        expect(resolveSafeWritePath('../escape.json', rootA)).toBeNull();
    });

    it('rejects an absolute path on write', () => {
        expect(resolveSafeWritePath('/tmp/x.json', rootA)).toBeNull();
    });
});
