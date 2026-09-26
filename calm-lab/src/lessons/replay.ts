import { validateArchitecture } from '../engine';
import { createVfs, type Vfs } from '../lab/vfs';
import { runCommand } from '../shell';
import type { CommandOutcome } from '../cli/outcome';
import { freshOutcomes } from './checks';
import { HOME_DIR, type Lesson, type LessonState, type LessonStep } from './types';

export interface Replay { vfs: Vfs; stateFor(): Promise<LessonState>; runHint(step: LessonStep): Promise<void> }

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
    return {
        vfs,
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
                await runCommand(command, ctx);
            }
        },
    };
}
