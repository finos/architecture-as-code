import { describe, it, expect } from 'vitest';
import { DEFAULT_LESSON_ID, LESSONS, endFiles, findLesson } from './index';
import { startReplay } from './replay';
import { HOME_DIR } from './types';

/** The `calm` subcommands the lab runs; `help` may name one of them. */
const LAB_SUBCOMMANDS = ['validate', 'diff'];

const calmCommands = (text: string) =>
    [...text.matchAll(/`(calm [^`]+)`/g)].map((match) => match[1]);

describe('lesson registry', () => {
    it('has at least one lesson, and the default lesson is registered', () => {
        expect(LESSONS.length).toBeGreaterThan(0);
        expect(findLesson(DEFAULT_LESSON_ID)).toBeDefined();
    });
});

describe.each(LESSONS.map((lesson) => [lesson.id, lesson] as const))('lesson %s', (_, lesson) => {
    it('has a URL-safe id, unique in the registry', () => {
        expect(lesson.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(LESSONS.filter((other) => other.id === lesson.id)).toHaveLength(1);
    });

    it('seeds its editor file, and step ids are unique', () => {
        expect(lesson.seedFiles[lesson.editorFile]).toBeTypeOf('string');
        expect(new Set(lesson.steps.map((step) => step.id)).size).toBe(lesson.steps.length);
    });

    it('keeps its editor file and seed files under the workspace', () => {
        for (const path of [lesson.editorFile, ...Object.keys(lesson.seedFiles)]) {
            expect(path.startsWith(`${HOME_DIR}/`), path).toBe(true);
        }
    });

    it('starts with no step complete', async () => {
        const state = await startReplay(lesson).stateFor();
        for (const step of lesson.steps) {
            expect(step.check(state), step.id).toBe(false);
        }
    });

    it('completes every step by following the hints in order, and no step sooner', async () => {
        const replay = startReplay(lesson);
        for (const step of lesson.steps) {
            expect(step.check(await replay.stateFor()), `${lesson.id} / ${step.id} before its hint`).toBe(false);
            await replay.runHint(step);
            expect(step.check(await replay.stateFor()), `${lesson.id} / ${step.id}`).toBe(true);
        }
    });

    it('ends with a valid editor file', async () => {
        const replay = startReplay({ ...lesson, seedFiles: endFiles(lesson) });
        expect((await replay.stateFor()).validation.ok).toBe(true);
    });

    it('only shows calm commands the lab runs, with arguments its shell accepts', async () => {
        const texts = [
            lesson.summary,
            lesson.completion.message,
            ...lesson.steps.flatMap((step) => [
                step.body,
                ...(step.hint.kind === 'commands' ? step.hint.commands.map((command) => `\`${command}\``) : []),
            ]),
        ];
        // Every path a lesson uses exists at the end, and the end state is valid.
        const replay = startReplay({ ...lesson, seedFiles: endFiles(lesson) });
        for (const command of texts.flatMap(calmCommands)) {
            const [, sub, ...rest] = command.trim().split(/\s+/);
            if (sub === 'help') {
                expect(rest.length === 0 || (rest.length === 1 && LAB_SUBCOMMANDS.includes(rest[0])), command).toBe(true);
            } else {
                expect(LAB_SUBCOMMANDS, command).toContain(sub);
            }
            const before = replay.outcomes.length;
            const errors = (await replay.run(command)).filter((line) => line.kind === 'err').map((line) => line.text);
            expect(errors, command).toEqual([]);
            if (sub !== 'help') {
                // Unsupported options print a muted note, not an error, and run nothing.
                expect(replay.outcomes.length, `${command} did not run`).toBe(before + 1);
            }
        }
    });

    it('links only to registered lessons', () => {
        for (const { to } of lesson.completion.links) {
            const match = /^\?lesson=(.*)$/.exec(to);
            if (match) {
                expect(findLesson(decodeURIComponent(match[1])), to).toBeDefined();
            }
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
