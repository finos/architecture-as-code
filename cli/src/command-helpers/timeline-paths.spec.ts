import { describe, it, expect, vi } from 'vitest';
import path from 'path';

// path is mocked to win32 so the Windows behaviour runs on any host. Separate
// file because the mock is module-wide and timeline.spec.ts uses real paths.
vi.mock('path', async () => {
    const actual = await vi.importActual<typeof import('path')>('path');
    return { ...actual.win32, default: actual.win32, posix: actual.posix, win32: actual.win32 };
});

const OUTPUT = 'C:\\docs\\timeline\\timeline.json';
const ARCHITECTURE = 'C:\\work\\architectures\\payments.arch.json';
const EXPECTED = '/work/architectures/payments.arch.json';

describe('buildImpliedTimeline path portability', () => {
    it('writes a forward-slash detailed-architecture reference on Windows', async () => {
        const { buildImpliedTimeline } = await import('./timeline');

        const timeline = buildImpliedTimeline([ARCHITECTURE], OUTPUT);
        const reference = timeline.moments[0].details['detailed-architecture'];

        // The full resolved path, not a substring: the backslash form also
        // ends with the filename.
        expect(path.posix.resolve('/docs/timeline', reference)).toBe(EXPECTED);
        expect(reference).not.toContain('\\');
    });

    it('leaves a POSIX relative path unchanged', () => {
        const relative = '../../work/architectures/payments.arch.json';

        expect(relative.split(path.posix.sep).join('/')).toBe(relative);
        expect(path.posix.resolve('/docs/timeline', relative)).toBe(EXPECTED);
    });
});
