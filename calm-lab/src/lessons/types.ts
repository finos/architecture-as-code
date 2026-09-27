import type { CommandOutcome } from '../cli/outcome';
import type { LabValidation } from '../engine';

export type CalmDocLike = Record<string, unknown>;

export interface LessonState {
    /** The saved editor file, parsed; null when it is not JSON. */
    doc: CalmDocLike | null;
    /** The engine's result for the saved editor file. */
    validation: Pick<LabValidation, 'ok'>;
    /** Outcomes whose files have not changed since the command ran, oldest first. */
    commands: CommandOutcome[];
    editorFile: string;
}

export type StepHint =
    | { kind: 'file'; content: string }          // the complete editor file after this step
    | { kind: 'commands'; commands: string[] };  // run from HOME_DIR, in order

export interface LessonStep {
    id: string;
    title: string;
    body: string;
    hint: StepHint;
    check(state: LessonState): boolean;
}

export interface LessonLink { to: string; label: string }

export interface Lesson {
    id: string;
    title: string;
    summary: string;
    /** The lesson whose end state this one's seed starts from. */
    chainsFrom?: string;
    editorFile: string;
    seedFiles: Record<string, string>;
    steps: LessonStep[];
    completion: { heading: string; message: string; links: LessonLink[] };
}

export const HOME_DIR = '/workspace';
