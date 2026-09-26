import { describe, it, expect } from 'vitest';
import { LESSONS, endFiles, findLesson } from './index';
import { startReplay } from './replay';
import { parseArgs } from '../cli/options';

const calmCommands = (text: string) =>
    [...text.matchAll(/`(calm [^`]+)`/g)].map((match) => match[1]);

describe.each(LESSONS.map((lesson) => [lesson.id, lesson] as const))('lesson %s', (_, lesson) => {
    it('has a URL-safe id, unique in the registry', () => {
        expect(lesson.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(LESSONS.filter((other) => other.id === lesson.id)).toHaveLength(1);
    });

    it('seeds its editor file, and step ids are unique', () => {
        expect(lesson.seedFiles[lesson.editorFile]).toBeTypeOf('string');
        expect(new Set(lesson.steps.map((step) => step.id)).size).toBe(lesson.steps.length);
    });

    it('starts with no step complete', async () => {
        const state = await startReplay(lesson).stateFor();
        for (const step of lesson.steps) {
            expect(step.check(state), step.id).toBe(false);
        }
    });

    it('completes every step by following the hints in order', async () => {
        const replay = startReplay(lesson);
        for (const step of lesson.steps) {
            await replay.runHint(step);
            expect(step.check(await replay.stateFor()), `${lesson.id} / ${step.id}`).toBe(true);
        }
    });

    it('ends with a valid editor file', async () => {
        const replay = startReplay({ ...lesson, seedFiles: endFiles(lesson) });
        expect((await replay.stateFor()).validation.ok).toBe(true);
    });

    it('only shows calm commands the real CLI accepts', () => {
        const texts = lesson.steps.flatMap((step) => [
            step.body,
            ...(step.hint.kind === 'commands' ? step.hint.commands.map((command) => `\`${command}\``) : []),
        ]);
        for (const command of texts.flatMap(calmCommands)) {
            const [, sub, ...args] = command.split(/\s+/);
            expect(parseArgs(sub, args).kind, command).toBe('ok');
        }
    });

    it('starts from its predecessor\'s end state when chained', () => {
        if (!lesson.chainsFrom) return;
        const previous = findLesson(lesson.chainsFrom);
        expect(previous, lesson.chainsFrom).toBeDefined();
        for (const [path, content] of Object.entries(endFiles(previous!))) {
            expect(lesson.seedFiles[path], path).toBe(content);
        }
    });
});
