import { describe, it, expect } from 'vitest';
import { textColourFor } from './text-colour.js';

describe('textColourFor', () => {
    it.each([
        ['#ffffff', '#000000'],
        ['#facc15', '#000000'],
        ['#000000', '#ffffff'],
        ['#1d4ed8', '#ffffff'],
    ])('returns %s text on a %s background', (background, expected) => {
        expect(textColourFor(background)).toBe(expected);
    });
});
