import { describe, it, expect } from 'vitest';
import { QUICK_START } from '../test-support/quick-start-lesson';
import { startReplay } from './replay';
import type { LessonStep } from './types';

const step = (commands: string[]): LessonStep => ({
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
