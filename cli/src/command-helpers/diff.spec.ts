import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runDiff, runTimelineDiff } from '@finos/calm-shared';
import { runDiffCommand, runTimelineDiffCommand, formatTimelineDiffs } from './diff';

const mocks = vi.hoisted(() => ({
    runDiff: vi.fn(),
    runTimelineDiff: vi.fn(),
    initLogger: vi.fn(function () { return { error: vi.fn(), debug: vi.fn(), info: vi.fn() }; }),
    processExit: vi.fn(),
    stdoutWrite: vi.fn(),
}));

vi.mock('@finos/calm-shared', async () => ({
    ...(await vi.importActual('@finos/calm-shared')),
    runDiff: mocks.runDiff,
    runTimelineDiff: mocks.runTimelineDiff,
    initLogger: mocks.initLogger,
}));

const fsMocks = vi.hoisted(() => ({ writeFileSync: vi.fn() }));
vi.mock('fs', async () => ({
    ...(await vi.importActual('fs')),
    writeFileSync: fsMocks.writeFileSync,
}));
vi.mock('mkdirp', () => ({ mkdirp: { sync: vi.fn() } }));

// An empty DiffResult shaped so diffHasChanges() returns false.
const emptyDiff = {
    nodesAdded: [], nodesRemoved: [], nodesModified: [], nodesRenamed: [], nodesSame: [],
    edgesAdded: [], edgesRemoved: [], edgesModified: [], edgesRenamed: [], edgesSame: [],
};
const diffWithChanges = { ...emptyDiff, nodesAdded: [{ 'unique-id': 'new-node' }] };

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

    it('does not append a trailing newline when formatted output already ends with one', async () => {
        (runDiff as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
            diff: {},
            formatted: '{"nodesAdded":[]}\n',
            hasChanges: false,
        });

        await runDiffCommand({ ...baseOptions });

        // Only the formatted block should be written, not a follow-up '\n'.
        expect(mocks.stdoutWrite).toHaveBeenCalledTimes(1);
        expect(mocks.stdoutWrite).toHaveBeenCalledWith('{"nodesAdded":[]}\n');
    });

    it('coerces non-Error throws to a string for the logged message', async () => {
        (runDiff as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
            throw 'plain string failure';
        });

        await runDiffCommand({ ...baseOptions });

        expect(mocks.processExit).toHaveBeenCalledWith(1);
    });
});

const timelineBaseOptions = {
    timelinePath: 'timeline.json',
    fromMomentId: undefined,
    toMomentId: undefined,
    outputFormat: 'json' as const,
    outputPath: undefined,
    verbose: false,
};

describe('formatTimelineDiffs', () => {
    it('emits a JSON array of {from,to,diff} entries in json format', () => {
        const out = formatTimelineDiffs(
            [{ from: 'a', to: 'b', diff: emptyDiff as never }],
            'json',
        );
        const parsed = JSON.parse(out);
        expect(parsed).toHaveLength(1);
        expect(parsed[0]).toMatchObject({ from: 'a', to: 'b' });
    });

    it('prints a "from -> to" header before each formatted diff in summary format', () => {
        const out = formatTimelineDiffs(
            [
                { from: 'm1', to: 'm2', diff: emptyDiff as never },
                { from: 'm2', to: 'm3', diff: emptyDiff as never },
            ],
            'summary',
        );
        expect(out).toContain('m1 -> m2');
        expect(out).toContain('m2 -> m3');
        expect(out).toContain('CALM architecture diff');
    });
});

describe('runTimelineDiffCommand', () => {
    it('diffs all adjacent pairs by default and writes to stdout', async () => {
        (runTimelineDiff as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
            diffs: [{ from: 'm1', to: 'm2', diff: emptyDiff }],
        });

        const hasChanges = await runTimelineDiffCommand({ ...timelineBaseOptions });

        expect(runTimelineDiff).toHaveBeenCalledWith(
            'timeline.json',
            expect.objectContaining({ fromMomentId: undefined, toMomentId: undefined }),
        );
        expect(mocks.stdoutWrite).toHaveBeenCalled();
        expect(hasChanges).toBe(false);
    });

    it('passes an explicit from/to pair through to runTimelineDiff', async () => {
        (runTimelineDiff as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
            diffs: [{ from: 'm1', to: 'm3', diff: emptyDiff }],
        });

        await runTimelineDiffCommand({ ...timelineBaseOptions, fromMomentId: 'm1', toMomentId: 'm3' });

        expect(runTimelineDiff).toHaveBeenCalledWith(
            'timeline.json',
            expect.objectContaining({ fromMomentId: 'm1', toMomentId: 'm3' }),
        );
    });

    it('returns true when any pair reports changes so --exit-code can fail', async () => {
        (runTimelineDiff as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
            diffs: [
                { from: 'm1', to: 'm2', diff: emptyDiff },
                { from: 'm2', to: 'm3', diff: diffWithChanges },
            ],
        });

        const hasChanges = await runTimelineDiffCommand({ ...timelineBaseOptions });

        expect(hasChanges).toBe(true);
    });

    it('does not write to stdout when an output path is provided', async () => {
        (runTimelineDiff as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
            diffs: [{ from: 'm1', to: 'm2', diff: emptyDiff }],
        });

        await runTimelineDiffCommand({ ...timelineBaseOptions, outputPath: 'out/timeline-diff.json' });

        expect(mocks.stdoutWrite).not.toHaveBeenCalled();
    });

    it('exits 1 with a logged error when runTimelineDiff throws', async () => {
        (runTimelineDiff as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('moment not found'));

        await runTimelineDiffCommand({ ...timelineBaseOptions });

        expect(mocks.processExit).toHaveBeenCalledWith(1);
    });

    it('exits 1 with a non-Error throw from runTimelineDiff', async () => {
        (runTimelineDiff as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
            throw 'timeline failure';
        });

        await runTimelineDiffCommand({ ...timelineBaseOptions });

        expect(mocks.processExit).toHaveBeenCalledWith(1);
    });
});
