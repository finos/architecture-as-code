import type { Lesson } from './types';

/**
 * A lesson's seed files plus every step's file hint applied in order — its state at the end.
 * Lives apart from `index.ts` so a chained lesson can import it without a circular import
 * back through the registry.
 */
export function endFiles(lesson: Lesson): Record<string, string> {
    const files = { ...lesson.seedFiles };
    for (const step of lesson.steps) {
        if (step.hint.kind === 'file') {
            files[lesson.editorFile] = step.hint.content;
        }
    }
    return files;
}
