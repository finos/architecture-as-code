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
    /** Every saved workspace file: absolute path → contents. Read it with `fileText` or `fileJson`. */
    files: Record<string, string>;
}

/** A hint command. `expect: 'failure'` marks one the step runs to see the engine reject its input. */
export type HintCommand = string | { run: string; expect: 'failure' };

export const commandText = (command: HintCommand): string => (typeof command === 'string' ? command : command.run);

export type StepHint =
    | { kind: 'file'; content: string; path?: string }  // the complete file after this step; path defaults to editorFile
    | { kind: 'commands'; commands: HintCommand[] };  // run from HOME_DIR, in order

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
    /** The tutorial page this lesson follows; the top of the lesson guide links to it. */
    tutorial?: { title: string; url: string };
    /** The lesson whose end state this one's seed starts from. */
    chainsFrom?: string;
    editorFile: string;
    /** The files the learner can open in the editor. Default: `[editorFile]`. */
    editableFiles?: string[];
    seedFiles: Record<string, string>;
    steps: LessonStep[];
    completion: { heading: string; message: string; links: LessonLink[] };
}

export const HOME_DIR = '/workspace';
