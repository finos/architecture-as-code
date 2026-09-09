import { describe, it, expect, vi } from 'vitest';
import * as path from 'path';

// path is mocked to win32 so the Windows behaviour runs on any host. A
// "no backslashes" assertion would pass on a Linux runner either way.
vi.mock('path', async () => {
    const actual = await vi.importActual<typeof import('path')>('path');
    return { ...actual.win32, default: actual.win32, posix: actual.posix, win32: actual.win32 };
});

const ARCHITECTURE = 'C:\\work\\command\\generate\\service.arch.json';
const URL_MAPPING = 'C:\\work\\command\\generate\\url-mapping.json';
const OUTPUT_FILE = 'C:\\docs\\site\\index.md';
const EXPECTED_ARCHITECTURE = '/work/command/generate/service.arch.json';

describe('injectFrontMatter path portability', () => {
    it('writes forward-slash paths when generated on Windows', async () => {
        const { injectFrontMatter } = await import('./front-matter');

        const result = injectFrontMatter('# Docs\n', OUTPUT_FILE, {
            architecturePath: ARCHITECTURE,
            urlMappingPath: URL_MAPPING,
        });

        const architecture = result.match(/^architecture: (.+)$/m)?.[1];
        const urlMapping = result.match(/^url-to-local-file-mapping: (.+)$/m)?.[1];

        expect(architecture).toBeDefined();
        expect(urlMapping).toBeDefined();

        // The full resolved path, not a substring: the backslash form also
        // ends with the filename.
        expect(path.posix.resolve('/docs/site', architecture!)).toBe(EXPECTED_ARCHITECTURE);
        expect(path.posix.resolve('/docs/site', urlMapping!)).toBe(
            '/work/command/generate/url-mapping.json'
        );
    });

    it('leaves a POSIX relative path unchanged', () => {
        const relative = '../../work/command/generate/service.arch.json';

        expect(relative.split(path.posix.sep).join('/')).toBe(relative);
        expect(path.posix.resolve('/docs/site', relative)).toBe(EXPECTED_ARCHITECTURE);
    });
});
