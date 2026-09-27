/**
 * localStorage helpers for the learning lab: per-lesson progress, the
 * per-lesson workspace key, and small cross-lesson UI preferences.
 * All access is guarded — private-browsing mode and quota errors just
 * fall back to running in memory for the visit.
 */

const UI_PREFS_KEY = 'calm-lab-ui-v1';
const PROGRESS_PREFIX = 'calm-lab-progress-v2:';

export const workspaceKey = (lessonId: string) => `calm-lab-workspace-v2:${lessonId}`;

function storage(): Storage | null {
    try {
        return window.localStorage ?? null;
    } catch {
        return null;
    }
}

export function loadUiPrefs(): Record<string, unknown> {
    try {
        const raw = storage()?.getItem(UI_PREFS_KEY);
        if (raw) {
            const prefs: unknown = JSON.parse(raw);
            if (prefs && typeof prefs === 'object') {
                return prefs as Record<string, unknown>;
            }
        }
    } catch {
        // ignore
    }
    return {};
}

export function saveUiPrefs(prefs: Record<string, unknown>): void {
    try {
        storage()?.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
    } catch {
        // ignore
    }
}

export function loadProgress(lessonId: string, stepIds: readonly string[]): Set<string> {
    try {
        const raw = storage()?.getItem(PROGRESS_PREFIX + lessonId);
        const ids: unknown = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(ids) ? ids.filter((id): id is string => stepIds.includes(id)) : []);
    } catch {
        return new Set();
    }
}

export function saveProgress(lessonId: string, completed: Set<string>): void {
    try {
        storage()?.setItem(PROGRESS_PREFIX + lessonId, JSON.stringify([...completed]));
    } catch {
        // Quota or privacy mode: progress stays in memory for this visit.
    }
}

export function clearProgress(lessonId: string): void {
    try {
        storage()?.removeItem(PROGRESS_PREFIX + lessonId);
    } catch {
        // ignore
    }
}

export function lastLessonId(): string | undefined {
    const value = loadUiPrefs().lesson;
    return typeof value === 'string' ? value : undefined;
}

export function rememberLesson(lessonId: string): void {
    saveUiPrefs({...loadUiPrefs(), lesson: lessonId});
}
