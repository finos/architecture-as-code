import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import path from 'path';
import { buildImpliedTimeline, runTimelineGenerate, CALM_TIMELINE_SCHEMA } from './timeline';

let tempDir: string;

beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'calm-timeline-gen-'));
});

afterEach(() => {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
});

function writeArch(name: string, body: Record<string, unknown>): string {
    const filePath = path.join(tempDir, name);
    fs.writeFileSync(filePath, JSON.stringify(body));
    return filePath;
}

describe('buildImpliedTimeline', () => {
    it('produces one moment per input architecture in input order', () => {
        const a = writeArch('a.json', { nodes: [] });
        const b = writeArch('b.json', { nodes: [] });
        const c = writeArch('c.json', { nodes: [] });
        const outputPath = path.join(tempDir, 'timeline.json');

        const timeline = buildImpliedTimeline([a, b, c], outputPath);

        expect(timeline.$schema).toBe(CALM_TIMELINE_SCHEMA);
        expect(timeline.moments.map((m) => m['unique-id'])).toEqual(['a', 'b', 'c']);
        expect(timeline.moments.every((m) => m['node-type'] === 'moment')).toBe(true);
    });

    it('sets current-moment to the last moment', () => {
        const a = writeArch('first.json', { nodes: [] });
        const b = writeArch('second.json', { nodes: [] });
        const outputPath = path.join(tempDir, 'timeline.json');

        const timeline = buildImpliedTimeline([a, b], outputPath);

        expect(timeline['current-moment']).toBe('second');
    });

    it('derives name and description from the architecture when present', () => {
        const a = writeArch('svc.json', { name: 'My Service', description: 'Does things' });
        const outputPath = path.join(tempDir, 'timeline.json');

        const timeline = buildImpliedTimeline([a], outputPath);

        expect(timeline.moments[0].name).toBe('My Service');
        expect(timeline.moments[0].description).toBe('Does things');
    });

    it('falls back to filename-derived metadata when the architecture has none', () => {
        const a = writeArch('plain-arch.json', { nodes: [] });
        const outputPath = path.join(tempDir, 'timeline.json');

        const timeline = buildImpliedTimeline([a], outputPath);

        expect(timeline.moments[0].name).toBe('plain-arch');
        expect(timeline.moments[0].description).toContain('plain-arch.json');
    });

    it('writes detailed-architecture references relative to the output directory', () => {
        const archDir = path.join(tempDir, 'archs');
        fs.mkdirSync(archDir);
        const a = path.join(archDir, 'v1.json');
        fs.writeFileSync(a, JSON.stringify({ nodes: [] }));
        const outputPath = path.join(tempDir, 'out', 'timeline.json');

        const timeline = buildImpliedTimeline([a], outputPath);

        expect(timeline.moments[0].details['detailed-architecture']).toBe(
            path.join('..', 'archs', 'v1.json'),
        );
    });

    it('disambiguates duplicate basenames so unique-ids stay unique', () => {
        const dir1 = path.join(tempDir, 'd1');
        const dir2 = path.join(tempDir, 'd2');
        fs.mkdirSync(dir1);
        fs.mkdirSync(dir2);
        const a = path.join(dir1, 'arch.json');
        const b = path.join(dir2, 'arch.json');
        fs.writeFileSync(a, JSON.stringify({ nodes: [] }));
        fs.writeFileSync(b, JSON.stringify({ nodes: [] }));

        const timeline = buildImpliedTimeline([a, b], path.join(tempDir, 'timeline.json'));

        expect(timeline.moments.map((m) => m['unique-id'])).toEqual(['arch', 'arch-1']);
    });

    it('tolerates unparseable architecture files by falling back to filename metadata', () => {
        const bad = path.join(tempDir, 'broken.json');
        fs.writeFileSync(bad, '{ this is not json');

        const timeline = buildImpliedTimeline([bad], path.join(tempDir, 'timeline.json'));

        expect(timeline.moments[0].name).toBe('broken');
    });

    it('returns timeline without current-moment when given no architectures', () => {
        const timeline = buildImpliedTimeline([]);

        expect(timeline.moments).toHaveLength(0);
        expect(timeline['current-moment']).toBeUndefined();
    });
});

describe('runTimelineGenerate', () => {
    it('writes the timeline to the output file', () => {
        const a = writeArch('a.json', { name: 'A' });
        const outputPath = path.join(tempDir, 'nested', 'timeline.json');

        runTimelineGenerate({ architecturePaths: [a], outputPath, verbose: false });

        expect(fs.existsSync(outputPath)).toBe(true);
        const written = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
        expect(written.moments).toHaveLength(1);
        expect(written.$schema).toBe(CALM_TIMELINE_SCHEMA);
    });

    it('writes to stdout when no output path is provided', () => {
        const a = writeArch('a.json', { name: 'A' });
        const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(function () { return true; });

        runTimelineGenerate({ architecturePaths: [a], verbose: false });

        expect(writeSpy).toHaveBeenCalled();
        expect(writeSpy.mock.calls[0][0]).toContain('"moments"');
    });

    it('exits 1 when no architecture files are supplied', () => {
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

        runTimelineGenerate({ architecturePaths: [], verbose: false });

        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('handles non-Error thrown values in the catch block', () => {
        const a = writeArch('a.json', { name: 'A' });
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
        vi.spyOn(process.stdout, 'write').mockImplementation(() => { throw 'non-error string'; });

        runTimelineGenerate({ architecturePaths: [a], verbose: false });

        expect(exitSpy).toHaveBeenCalledWith(1);
    });

});
