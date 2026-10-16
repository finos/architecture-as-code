import { describe, it, expect, vi } from 'vitest';
import { clearProgress, lastLessonId, loadProgress, rememberLesson, saveProgress, workspaceKey } from './storage';

describe('lesson storage', () => {
    it('keeps progress separate for each lesson and drops unknown step ids', () => {
        saveProgress('one', new Set(['a', 'gone']));
        saveProgress('two', new Set(['b']));
        expect([...loadProgress('one', ['a', 'b'])]).toEqual(['a']);
        expect([...loadProgress('two', ['a', 'b'])]).toEqual(['b']);
        clearProgress('one');
        expect(loadProgress('one', ['a']).size).toBe(0);
        expect(loadProgress('two', ['b']).size).toBe(1);
    });

    it('remembers the last lesson in the UI prefs', () => {
        expect(lastLessonId()).toBeUndefined();
        rememberLesson('two');
        expect(lastLessonId()).toBe('two');
        expect(workspaceKey('two')).toBe('calm-lab-workspace-v2:two');
    });

    it('works without storage', () => {
        vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new DOMException('denied'); });
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('denied'); });
        expect(() => saveProgress('one', new Set(['a']))).not.toThrow();
        expect(loadProgress('one', ['a']).size).toBe(0);
        vi.restoreAllMocks();
    });
});
