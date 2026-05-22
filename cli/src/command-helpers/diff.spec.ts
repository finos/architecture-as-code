import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runDiff } from '@finos/calm-shared';
import { runDiffCommand } from './diff';

const mocks = vi.hoisted(() => ({
    runDiff: vi.fn(),
    initLogger: vi.fn(() => ({ error: vi.fn(), debug: vi.fn() })),
    processExit: vi.fn(),
    stdoutWrite: vi.fn(),
}));

vi.mock('@finos/calm-shared', async () => ({
    ...(await vi.importActual('@finos/calm-shared')),
    runDiff: mocks.runDiff,
    initLogger: mocks.initLogger,
}));

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
        mocks.processExit(code);
        return undefined as never;
    }) as never);
    vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string) => {
        mocks.stdoutWrite(chunk);
        return true;
    }) as never);
});

const baseOptions = {
    documentAPath: 'a.json',
    documentBPath: 'b.json',
    outputFormat: 'json' as const,
    outputPath: undefined,
    verbose: false,
};

describe('runDiffCommand', () => {
    it('writes formatted output to stdout when no output path is provided', async () => {
        (runDiff as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
            diff: {},
            formatted: '{"nodesAdded":[]}',
            hasChanges: false,
        });

        const hasChanges = await runDiffCommand({ ...baseOptions });

        expect(runDiff).toHaveBeenCalledWith('a.json', 'b.json', expect.objectContaining({ format: 'json' }));
        expect(mocks.stdoutWrite).toHaveBeenCalledWith('{"nodesAdded":[]}');
        expect(mocks.processExit).not.toHaveBeenCalled();
        expect(hasChanges).toBe(false);
    });

    it('does not print to stdout when an output path is provided (runDiff handles the write)', async () => {
        (runDiff as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
            diff: {},
            formatted: '{"nodesAdded":[]}',
            hasChanges: false,
        });

        await runDiffCommand({ ...baseOptions, outputPath: 'out/diff.json' });

        expect(runDiff).toHaveBeenCalledWith(
            'a.json',
            'b.json',
            expect.objectContaining({ outputPath: 'out/diff.json' }),
        );
        expect(mocks.stdoutWrite).not.toHaveBeenCalled();
    });

    it('returns true when changes were detected so the CLI wrapper can exit non-zero', async () => {
        (runDiff as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
            diff: {},
            formatted: '{}',
            hasChanges: true,
        });

        const hasChanges = await runDiffCommand({ ...baseOptions });

        expect(hasChanges).toBe(true);
        expect(mocks.processExit).not.toHaveBeenCalled();
    });

    it('returns false when no changes were detected', async () => {
        (runDiff as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
            diff: {},
            formatted: '{}',
            hasChanges: false,
        });

        const hasChanges = await runDiffCommand({ ...baseOptions });

        expect(hasChanges).toBe(false);
        expect(mocks.processExit).not.toHaveBeenCalled();
    });

    it('exits 1 with a logged error when runDiff throws', async () => {
        (runDiff as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('file not found'));

        await runDiffCommand({ ...baseOptions });

        expect(mocks.processExit).toHaveBeenCalledWith(1);
    });
});
