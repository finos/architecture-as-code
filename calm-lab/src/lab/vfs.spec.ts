import { describe, it, expect } from 'vitest';
import { createVfs, resolvePath } from './vfs';

describe('resolvePath', () => {
    it.each([
        ['/workspace', 'a.json', '/workspace/a.json'],
        ['/workspace', './a.json', '/workspace/a.json'],
        ['/workspace/architecture', '../x.json', '/workspace/x.json'],
        ['/workspace', '/abs/y.json', '/abs/y.json'],
        ['/workspace', '', '/workspace'],
        ['/', '..', '/'],
    ])('resolves %s + %s → %s', (cwd, path, expected) => {
        expect(resolvePath(cwd, path)).toBe(expected);
    });
});

describe('createVfs', () => {
    const seed = { '/workspace/a.json': '{}', '/workspace/dir/b.json': '{"b":1}' };

    it('reads, writes and reports existence', () => {
        const vfs = createVfs(seed);
        expect(vfs.read('/workspace/a.json')).toBe('{}');
        expect(vfs.read('/workspace/nope.json')).toBeNull();
        vfs.write('/workspace/c.json', 'x');
        expect(vfs.exists('/workspace/c.json')).toBe(true);
    });

    it('lists directories first, then files, sorted', () => {
        const vfs = createVfs(seed);
        expect(vfs.list('/workspace')).toEqual([
            { name: 'dir', isDir: true },
            { name: 'a.json', isDir: false },
        ]);
        expect(vfs.isDir('/workspace/dir')).toBe(true);
        expect(vfs.isDir('/workspace/a.json')).toBe(false);
    });

    it('persists to localStorage and restores on the next createVfs', () => {
        const first = createVfs(seed);
        first.write('/workspace/new.json', '1');
        first.setCwd('/workspace/dir');
        const second = createVfs(seed);
        expect(second.read('/workspace/new.json')).toBe('1');
        expect(second.getCwd()).toBe('/workspace/dir');
    });

    it('seed() resets files, cwd and storage', () => {
        const vfs = createVfs(seed);
        vfs.write('/workspace/new.json', '1');
        vfs.setCwd('/workspace/dir');
        vfs.seed(seed);
        expect(vfs.read('/workspace/new.json')).toBeNull();
        expect(vfs.getCwd()).toBe('/workspace');
        // The reset has to reach storage too, or a reload restores the old work.
        expect(JSON.parse(localStorage.getItem('calm-lab-workspace-v1')!)).toEqual({
            files: seed,
            cwd: '/workspace',
        });
    });
});
