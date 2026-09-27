import { validateArchitecture } from '../engine';
import { createVfs, type Vfs } from '../lab/vfs';
import { runCommand, type Line } from '../shell';
import type { CommandOutcome } from '../cli/outcome';
import { freshOutcomes, isRejection } from './checks';
import { commandText, HOME_DIR, type HintCommand, type Lesson, type LessonState, type LessonStep } from './types';

export interface Replay {
    vfs: Vfs;
    /** Every command outcome so far, stale or not. */
    outcomes: readonly CommandOutcome[];
    stateFor(): Promise<LessonState>;
    /** Runs one command from HOME_DIR. */
    run(command: string): Promise<Line[]>;
    /** Applies a step's hint (commands run in order from HOME_DIR); throws if a command does not do what the hint expects. */
    runHint(step: LessonStep): Promise<void>;
}

/**
 * Why a command did not do what its hint expects, or undefined. A plain command prints no error
 * and does not fail.
 * An expected failure is a validate the engine ran and rejected for the architecture's own errors
 * (see `isRejection`): a load error, an unknown option or a broken pattern is not the failure the step means.
 */
export function unexpectedResult(command: HintCommand, lines: Line[], outcomes: readonly CommandOutcome[]): string | undefined {
    const errors = lines.filter((line) => line.kind === 'err').map((line) => line.text);
    if (typeof command === 'string') {
        if (errors.length) {
            return `printed an error:\n${errors.join('\n')}`;
        }
        return outcomes.some((outcome) => !outcome.ok) ? "failed; mark it `expect: 'failure'` if the step means it to" : undefined;
    }
    if (!outcomes.length) {
        return `was expected to fail, but it did not run:\n${lines.map((line) => line.text).join('\n')}`;
    }
    if (outcomes.some(isRejection)) {
        return undefined;
    }
    return outcomes.some((outcome) => !outcome.ok)
        ? 'was expected to fail on the architecture, but it failed on the pattern or a file the pattern loads'
        : 'was expected to fail, but it passed';
}

/** Drives a lesson the way a learner following every hint would, on the real shell and engine. */
export function startReplay(lesson: Lesson): Replay {
    const vfs = createVfs(lesson.seedFiles, null);
    let cwd = HOME_DIR;
    const outcomes: CommandOutcome[] = [];
    const ctx = {
        vfs,
        getCwd: () => cwd,
        setCwd: (dir: string) => { cwd = dir; },
        onEvent: (event: { outcome: CommandOutcome }) => { outcomes.push(event.outcome); },
    };
    const run = async (command: string) => {
        cwd = HOME_DIR;
        return runCommand(command, ctx);
    };
    return {
        vfs,
        outcomes,
        run,
        async stateFor() {
            const text = vfs.read(lesson.editorFile) ?? '';
            const validation = await validateArchitecture(text);
            return {
                doc: (validation.doc as Record<string, unknown> | undefined) ?? null,
                validation,
                commands: freshOutcomes(outcomes, (path) => vfs.read(path)),
                editorFile: lesson.editorFile,
                files: vfs.toJSON().files,
            };
        },
        async runHint(step) {
            if (step.hint.kind === 'file') {
                vfs.write(step.hint.path ?? lesson.editorFile, step.hint.content);
                return;
            }
            cwd = HOME_DIR;
            for (const command of step.hint.commands) {
                const before = outcomes.length;
                const lines = await runCommand(commandText(command), ctx);
                const problem = unexpectedResult(command, lines, outcomes.slice(before));
                if (problem) {
                    throw new Error(`${lesson.id} / ${step.id}: \`${commandText(command)}\` ${problem}`);
                }
            }
        },
    };
}
