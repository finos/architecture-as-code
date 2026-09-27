import { validateArchitecture } from '../engine';
import { createVfs, type Vfs } from '../lab/vfs';
import { runCommand, type Line } from '../shell';
import type { CommandOutcome } from '../cli/outcome';
import { freshOutcomes } from './checks';
import { HOME_DIR, type Lesson, type LessonState, type LessonStep } from './types';

export interface Replay {
    vfs: Vfs;
    /** Every command outcome so far, stale or not. */
    outcomes: readonly CommandOutcome[];
    stateFor(): Promise<LessonState>;
    /** Runs one command from HOME_DIR. */
    run(command: string): Promise<Line[]>;
    /** Applies a step's hint (commands run in order from HOME_DIR); throws if a command prints an error. */
    runHint(step: LessonStep): Promise<void>;
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
            };
        },
        async runHint(step) {
            if (step.hint.kind === 'file') {
                vfs.write(lesson.editorFile, step.hint.content);
                return;
            }
            cwd = HOME_DIR;
            for (const command of step.hint.commands) {
                const errors = (await runCommand(command, ctx)).filter((line) => line.kind === 'err');
                if (errors.length) {
                    throw new Error(`${lesson.id} / ${step.id}: \`${command}\` printed an error:\n${errors.map((line) => line.text).join('\n')}`);
                }
            }
        },
    };
}
