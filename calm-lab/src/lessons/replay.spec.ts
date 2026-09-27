import { describe, it, expect } from 'vitest';
import { QUICK_START } from '../test-support/quick-start-lesson';
import { startReplay } from './replay';
import type { HintCommand, LessonStep } from './types';
import PATTERN from '../cli/fixtures/web-app-pattern.json?raw';
import BROKEN from '../cli/fixtures/broken-webapp.json?raw';
import OK from '../cli/fixtures/ok.json?raw';

const step = (commands: HintCommand[]): LessonStep => ({
    id: 'broken',
    title: 'Broken',
    body: '',
    hint: { kind: 'commands', commands },
    check: () => false,
});

describe('startReplay', () => {
    it('fails a hint command that prints an error, naming the lesson, step and command', async () => {
        await expect(startReplay(QUICK_START).runHint(step(['ls', 'cat missing.json'])))
            .rejects.toThrow('quick-start / broken: `cat missing.json` printed an error');
    });

    it('fails a calm command the shell rejects', async () => {
        await expect(startReplay(QUICK_START).runHint(step(['calm validate'])))
            .rejects.toThrow(/`calm validate` printed an error:\nerror: one of the required options/);
    });

    it('runs hint commands in order from the workspace, keeping cd between them', async () => {
        await expect(startReplay(QUICK_START).runHint(step(['cd architecture', 'cat trading-system.architecture.json'])))
            .resolves.toBeUndefined();
    });
});

describe('startReplay file hints', () => {
    const fileStep = (content: string, path?: string): LessonStep => ({
        id: 'write', title: 'Write', body: '', hint: { kind: 'file', content, path }, check: () => false,
    });

    it('writes a file hint to its path, or to the editor file, and exposes every file in state', async () => {
        const replay = startReplay(QUICK_START);
        await replay.runHint(fileStep('# ADR', '/workspace/docs/adr.md'));
        await replay.runHint(fileStep('{}'));
        const state = await replay.stateFor();
        expect(state.files['/workspace/docs/adr.md']).toBe('# ADR');
        expect(state.files[QUICK_START.editorFile]).toBe('{}');
    });
});

describe('startReplay expected failures', () => {
    const lesson = {
        ...QUICK_START,
        seedFiles: {
            ...QUICK_START.seedFiles,
            '/workspace/p.json': PATTERN,
            '/workspace/broken.json': BROKEN,
            '/workspace/ok.json': OK,
        },
    };
    const fails = (run: string): HintCommand => ({ run, expect: 'failure' });

    it.each([
        'calm validate -p p.json -a broken.json',
        'calm validate -p p.json -a broken.json -f pretty',
    ])('accepts `%s` when the hint expects it to fail', async (command) => {
        await expect(startReplay(lesson).runHint(step([fails(command)]))).resolves.toBeUndefined();
    });

    it('rejects a plain hint command that fails validation with ERROR lines', async () => {
        await expect(startReplay(lesson).runHint(step(['calm validate -p p.json -a broken.json -f pretty'])))
            .rejects.toThrow('quick-start / broken: `calm validate -p p.json -a broken.json -f pretty` printed an error');
    });

    it('rejects a plain hint command that fails validation silently (JSON output)', async () => {
        await expect(startReplay(lesson).runHint(step(['calm validate -p p.json -a broken.json'])))
            .rejects.toThrow("quick-start / broken: `calm validate -p p.json -a broken.json` failed; mark it `expect: 'failure'` if the step means it to");
    });

    it('rejects an expected failure that passes', async () => {
        await expect(startReplay(lesson).runHint(step([fails('calm validate -p p.json -a ok.json')])))
            .rejects.toThrow('quick-start / broken: `calm validate -p p.json -a ok.json` was expected to fail, but it passed');
    });

    it('rejects an expected failure that fails for another reason', async () => {
        await expect(startReplay(lesson).runHint(step([fails('calm validate -p p.json -a nope.json')])))
            .rejects.toThrow(/`calm validate -p p\.json -a nope\.json` was expected to fail, but it did not run:\nerror \[multi-strategy-document-loader\]/);
    });

    it('runs later commands after an expected failure', async () => {
        const replay = startReplay(lesson);
        await replay.runHint(step([fails('calm validate -p p.json -a broken.json'), 'calm generate -p p.json -o out.json']));
        expect(replay.vfs.read('/workspace/out.json')).not.toBeNull();
    });
});
