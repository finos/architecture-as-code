import { describe, it, expect } from 'vitest';
import { endFiles } from './chain';
import type { Lesson, LessonStep } from './types';

const fileStep = (id: string, content: string, path?: string): LessonStep => ({
    id, title: id, body: '', hint: { kind: 'file', content, path }, check: () => false,
});

describe('endFiles', () => {
    it('applies each file hint to its path, or to the editor file when it has none', () => {
        const lesson = {
            editorFile: '/workspace/a.json',
            seedFiles: { '/workspace/a.json': 'a0', '/workspace/adr.md': 'm0', '/workspace/other.txt': 'o0' },
            steps: [fileStep('one', 'a1'), fileStep('two', 'm1', '/workspace/adr.md')],
        } as unknown as Lesson;
        expect(endFiles(lesson)).toEqual({ '/workspace/a.json': 'a1', '/workspace/adr.md': 'm1', '/workspace/other.txt': 'o0' });
    });
});
