import { describe, it, expect } from 'vitest';
import { isEmptyDocument } from './empty-document';

describe('isEmptyDocument', () => {
    it.each([null, '', '  \n', '{}', '{\n}'])('treats %j as empty', (json) => {
        expect(isEmptyDocument(json)).toBe(true);
    });

    it.each([
        '{"$schema":"https://calm.finos.org/release/1.2/meta/calm.json"}',
        '{"nodes":[]}',
        '[]',
        '{ not json',
    ])('treats %j as not empty', (json) => {
        expect(isEmptyDocument(json)).toBe(false);
    });
});
