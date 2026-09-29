import { BEGINNER_02 } from './beginner-02/lesson';
import { BEGINNER_03 } from './beginner-03/lesson';
import { BEGINNER_05 } from './beginner-05/lesson';
import { BEGINNER_06 } from './beginner-06/lesson';
import { BEGINNER_07 } from './beginner-07/lesson';
import { INTERMEDIATE_08 } from './intermediate-08/lesson';
import { INTERMEDIATE_09 } from './intermediate-09/lesson';
import { INTERMEDIATE_10 } from './intermediate-10/lesson';
import { INTERMEDIATE_17 } from './intermediate-17/lesson';
import { INTERMEDIATE_18 } from './intermediate-18/lesson';
import { INTERMEDIATE_19 } from './intermediate-19/lesson';
import { INTERMEDIATE_20 } from './intermediate-20/lesson';
import type { Lesson } from './types';

export { endFiles } from './chain';

/** Picker order. Register new lessons here; the invariants spec covers every entry. */
export const LESSONS: readonly Lesson[] = [
    BEGINNER_02, BEGINNER_03, BEGINNER_05, BEGINNER_06, BEGINNER_07, INTERMEDIATE_08, INTERMEDIATE_09, INTERMEDIATE_10,
    INTERMEDIATE_17, INTERMEDIATE_18, INTERMEDIATE_19, INTERMEDIATE_20,
];
export const DEFAULT_LESSON_ID = BEGINNER_02.id;

export function findLesson(id: string | null | undefined): Lesson | undefined {
    return LESSONS.find((lesson) => lesson.id === id);
}
