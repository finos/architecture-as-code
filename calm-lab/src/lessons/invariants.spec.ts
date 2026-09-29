import { describe, it, expect } from 'vitest';
import { DEFAULT_LESSON_ID, LESSONS, endFiles, findLesson } from './index';
import { startReplay, unexpectedResult } from './replay';
import { commandText, HOME_DIR, type Lesson } from './types';
import { LAB_COMMANDS } from '../cli/help';
import { PATTERN_LESSON } from '../test-support/pattern-lesson';

/** The `calm` subcommands the lab runs; `help` may name one of them. */
const LAB_SUBCOMMANDS: readonly string[] = LAB_COMMANDS;

const calmCommands = (text: string) =>
    [...text.matchAll(/`(calm [^`]+)`/g)].map((match) => match[1]);

describe('lesson registry', () => {
    it('has at least one lesson, and the default lesson is registered', () => {
        expect(LESSONS.length).toBeGreaterThan(0);
        expect(findLesson(DEFAULT_LESSON_ID)).toBeDefined();
    });

    it.each(LESSONS.map((lesson) => [lesson.id, lesson] as const))('%s names the tutorial page it follows', (_, lesson) => {
        expect(lesson.tutorial?.title).toMatch(/\S/);
        expect(lesson.tutorial?.url).toMatch(/^https:\/\/calm\.finos\.org\/tutorials\/(beginner|intermediate)\/[a-z0-9-]+\/$/);
    });
});

/** A learner who followed every hint. */
async function replayedToEnd(lesson: Lesson) {
    const replay = startReplay(lesson);
    for (const step of lesson.steps) {
        await replay.runHint(step);
    }
    return replay;
}

const CHECKED = [...LESSONS, PATTERN_LESSON];

describe.each(CHECKED.map((lesson) => [lesson.id, lesson] as const))('lesson %s', (_, lesson) => {
    it('has a URL-safe id, unique in the registry', () => {
        expect(lesson.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(CHECKED.filter((other) => other.id === lesson.id)).toHaveLength(1);
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

    // The file switcher lists only files that exist, so a file a hint creates (`calm generate -o`)
    // can be editable before it is written.
    it('lists editable files under the workspace that are seeded or written by a hint, including the editor file', async () => {
        const editable = lesson.editableFiles ?? [lesson.editorFile];
        expect(editable).toContain(lesson.editorFile);
        const end = (await replayedToEnd(lesson)).vfs;
        for (const path of editable) {
            expect(path.startsWith(`${HOME_DIR}/`), path).toBe(true);
            expect(lesson.seedFiles[path] ?? end.read(path), path).toBeTypeOf('string');
        }
    });

    it('writes file hints only to files the learner can open', () => {
        const editable = lesson.editableFiles ?? [lesson.editorFile];
        for (const step of lesson.steps) {
            if (step.hint.kind === 'file') {
                expect(editable, step.id).toContain(step.hint.path ?? lesson.editorFile);
            }
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
        const hintCommands = lesson.steps.flatMap((step) => (step.hint.kind === 'commands' ? step.hint.commands : []));
        const texts = [
            lesson.completion.message,
            ...lesson.steps.flatMap((step) => [
                step.body,
                ...(step.hint.kind === 'commands' ? step.hint.commands.map((command) => `\`${commandText(command)}\``) : []),
            ]),
        ];
        // A hint expects these to fail at its step; at the end a later step may have fixed the input.
        const mayFail = new Set(hintCommands.filter((command) => typeof command !== 'string').map(commandText));
        // Every path a lesson uses exists after the hints, including files a command wrote.
        const replay = await replayedToEnd(lesson);
        for (const command of texts.flatMap(calmCommands)) {
            const [, sub, ...rest] = command.trim().split(/\s+/);
            if (sub === 'help') {
                expect(rest.length === 0 || (rest.length === 1 && LAB_SUBCOMMANDS.includes(rest[0])), command).toBe(true);
            } else {
                expect(LAB_SUBCOMMANDS, command).toContain(sub);
            }
            const before = replay.outcomes.length;
            const lines = await replay.run(command);
            const outcomes = replay.outcomes.slice(before);
            const failed = mayFail.has(command) && outcomes.some((outcome) => !outcome.ok);
            expect(failed ? undefined : unexpectedResult(command, lines, outcomes), command).toBeUndefined();
            if (sub !== 'help') {
                // Unsupported options print a muted note, not an error, and run nothing.
                expect(outcomes.length, `${command} did not run`).toBe(1);
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
