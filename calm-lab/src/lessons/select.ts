import { DEFAULT_LESSON_ID, LESSONS } from './index';
import type { Lesson } from './types';

export interface LessonSelection { lesson: Lesson; unknownId?: string }

export const lessonUrl = (id: string) => `?lesson=${encodeURIComponent(id)}`;

export function selectLesson(search: string, remembered: string | undefined, lessons: readonly Lesson[] = LESSONS): LessonSelection {
    const byId = (id: string | null | undefined) => lessons.find((lesson) => lesson.id === id);
    // LESSONS is never empty (see the invariants spec), so this always resolves.
    const fallback = byId(DEFAULT_LESSON_ID) ?? lessons[0]!;
    const requested = new URLSearchParams(search).get('lesson');
    if (requested) {
        const lesson = byId(requested);
        return lesson ? { lesson } : { lesson: fallback, unknownId: requested };
    }
    return { lesson: byId(remembered) ?? fallback };
}
