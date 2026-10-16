import { describe, expect, it } from 'vitest';
import { usableColor } from './usableColor.js';

describe('usableColor', () => {
    it.each([
        ['#fff', '#fff'],
        ['#FFFFFF', '#FFFFFF'],
        ['#1C4587cc', '#1C4587cc'],
        ['rgb(1, 2, 3)', 'rgb(1, 2, 3)'],
        ['rgba(1,2,3,0.5)', 'rgba(1,2,3,0.5)'],
        ['hsl(210, 50%, 40%)', 'hsl(210, 50%, 40%)'],
        ['navy', 'navy'],
        ['  red  ', 'red'],
    ])('accepts the colour %j', (input, expected) => {
        expect(usableColor(input)).toBe(expected);
    });

    it.each([
        ['an empty string', ''],
        ['whitespace', '   '],
        ['a number', 42],
        ['an object', { not: 'a colour' }],
        ['null', null],
        ['undefined', undefined],
        // Anything that is not colour syntax could make the browser fetch a URL or run a
        // function when it lands in a CSS shorthand such as `background`.
        ['a url()', 'url(https://host/pixel.png)'],
        ['a url() hidden behind a colour', 'red; background:url(x)'],
        ['a nested function', 'rgb(1,2,url(x))'],
        ['expression()', 'expression(alert(1))'],
        ['a var()', 'var(--x)'],
        ['a javascript: URL', 'javascript:alert(1)'],
        ['a hex value that is too short', '#12'],
        ['a hex value that is too long', '#123456789'],
    ])('rejects %s', (_label, input) => {
        expect(usableColor(input)).toBeUndefined();
    });
});
