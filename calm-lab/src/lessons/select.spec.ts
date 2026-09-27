import { describe, it, expect } from 'vitest';
import { selectLesson } from './select';
import { QUICK_START } from './quick-start/lesson';

const other = { ...QUICK_START, id: 'other' };
const lessons = [QUICK_START, other];

describe('selectLesson', () => {
    it('prefers ?lesson=, then the remembered lesson, then quick-start', () => {
        expect(selectLesson('?lesson=other', 'quick-start', lessons).lesson.id).toBe('other');
        expect(selectLesson('', 'other', lessons).lesson.id).toBe('other');
        expect(selectLesson('', undefined, lessons).lesson.id).toBe('quick-start');
    });

    it('falls back to quick-start and reports an unknown id from the URL', () => {
        expect(selectLesson('?lesson=nope', 'other', lessons)).toEqual({ lesson: QUICK_START, unknownId: 'nope' });
    });

    it('treats an empty ?lesson= as no parameter', () => {
        expect(selectLesson('?lesson=', 'other', lessons)).toEqual({ lesson: other });
        expect(selectLesson('?lesson=', undefined, lessons)).toEqual({ lesson: QUICK_START });
    });

    it('ignores a remembered lesson that no longer exists', () => {
        expect(selectLesson('', 'gone', lessons)).toEqual({ lesson: QUICK_START });
    });
});
