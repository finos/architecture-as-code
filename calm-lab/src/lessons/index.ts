import { BEGINNER_02 } from './beginner-02/lesson';
import { BEGINNER_03 } from './beginner-03/lesson';
import { BEGINNER_05 } from './beginner-05/lesson';
import { BEGINNER_06 } from './beginner-06/lesson';
import type { Lesson } from './types';

export { endFiles } from './chain';

/** Picker order. Register new lessons here; the invariants spec covers every entry. */
export const LESSONS: readonly Lesson[] = [BEGINNER_02, BEGINNER_03, BEGINNER_05, BEGINNER_06];
export const DEFAULT_LESSON_ID = BEGINNER_02.id;

export function findLesson(id: string | null | undefined): Lesson | undefined {
    return LESSONS.find((lesson) => lesson.id === id);
}
