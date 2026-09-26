import { QUICK_START } from './quick-start/lesson';
import { BEGINNER_02 } from './beginner-02/lesson';
import type { Lesson } from './types';

/** Picker order. Register new lessons here; the invariants spec covers every entry. */
export const LESSONS: readonly Lesson[] = [QUICK_START, BEGINNER_02];
export const DEFAULT_LESSON_ID = QUICK_START.id;

export function findLesson(id: string | null | undefined): Lesson | undefined {
    return LESSONS.find((lesson) => lesson.id === id);
}

export function endFiles(lesson: Lesson): Record<string, string> {
    const files = { ...lesson.seedFiles };
    for (const step of lesson.steps) {
        if (step.hint.kind === 'file') {
            files[lesson.editorFile] = step.hint.content;
        }
    }
    return files;
}
