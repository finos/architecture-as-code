import { describe, expect, it } from 'vitest';
import { classifyValue, decoratorTypeLabel, describeSize, formatDate, isWebUrl } from './value-shape.js';

describe('classifyValue', () => {
    it.each([
        [null, 'empty'],
        [undefined, 'empty'],
        [true, 'boolean'],
        [0, 'number'],
        ['plain text', 'text'],
        ['', 'text'],
        ['https://grafana.example.com/d/abc', 'url'],
        ['http://example.com', 'url'],
        ['2026-03-01', 'date'],
        ['2024-02-29', 'date'],
        ['2026-03-01T10:15:00Z', 'date'],
        ['2026-03-01T10:15:00.123+01:00', 'date'],
        [[], 'array'],
        [{}, 'object'],
    ])('classifies %j as %s', (value, kind) => {
        expect(classifyValue(value).kind).toBe(kind);
    });

    it('keeps text that only looks like a date or a link as text', () => {
        expect(classifyValue('2026-13-45').kind).toBe('text');
        expect(classifyValue('2024-02-30').kind).toBe('text');
        expect(classifyValue('2023-02-29T10:00:00Z').kind).toBe('text');
        expect(classifyValue('May 3').kind).toBe('text');
        expect(classifyValue('1').kind).toBe('text');
        expect(classifyValue('javascript:alert(1)').kind).toBe('text');
        expect(classifyValue('ftp://example.com').kind).toBe('text');
    });

    it('marks a date with no time as date only', () => {
        expect(classifyValue('2026-03-01')).toEqual({ kind: 'date', value: '2026-03-01', dateOnly: true });
        expect(classifyValue('2026-03-01T10:15:00Z')).toMatchObject({ dateOnly: false });
    });

    it('classifies an array of primitives as a list', () => {
        expect(classifyValue(['a', 1, null])).toEqual({ kind: 'list', items: ['a', 1, null] });
    });

    it('classifies an array of flat objects as a table with the union of their keys', () => {
        expect(classifyValue([{ name: 'a', port: 80 }, { name: 'b', tls: true }])).toEqual({
            kind: 'table',
            columns: ['name', 'port', 'tls'],
            rows: [{ name: 'a', port: 80 }, { name: 'b', tls: true }],
        });
    });

    it('classifies an array with nested values or mixed items as a plain array', () => {
        expect(classifyValue([{ name: 'a', spec: { replicas: 2 } }]).kind).toBe('array');
        expect(classifyValue(['a', { name: 'b' }]).kind).toBe('array');
        expect(classifyValue([['a']]).kind).toBe('array');
    });

    it('lists the entries of an object in order', () => {
        expect(classifyValue({ b: 1, a: 2 })).toEqual({ kind: 'object', entries: [['b', 1], ['a', 2]] });
    });
});

describe('isWebUrl', () => {
    it('accepts only well-formed http and https URLs', () => {
        expect(isWebUrl('https://example.com/path?q=1')).toBe(true);
        expect(isWebUrl('HTTPS://EXAMPLE.COM')).toBe(true);
        expect(isWebUrl('https://')).toBe(false);
        expect(isWebUrl('mailto:someone@example.com')).toBe(false);
        expect(isWebUrl('data:text/html,hi')).toBe(false);
    });
});

describe('formatDate', () => {
    it('formats a date-only value in UTC, so it does not move a day', () => {
        expect(formatDate('2026-03-01', true)).toBe(new Date(Date.UTC(2026, 2, 1)).toLocaleDateString(undefined, { timeZone: 'UTC' }));
    });

    it('formats a date-time value in local time', () => {
        expect(formatDate('2026-03-01T10:15:00Z', false)).toBe(new Date('2026-03-01T10:15:00Z').toLocaleString());
    });
});

describe('describeSize', () => {
    it('counts items and fields, with singular forms', () => {
        expect(describeSize([1])).toBe('1 item');
        expect(describeSize([1, 2])).toBe('2 items');
        expect(describeSize({ a: 1 })).toBe('1 field');
        expect(describeSize({ a: 1, b: 2 })).toBe('2 fields');
        expect(describeSize('x')).toBe('');
    });
});

describe('decoratorTypeLabel', () => {
    it('keeps a type', () => {
        expect(decoratorTypeLabel('deployment')).toBe('deployment');
    });

    it.each([undefined, null, ''])('labels a missing type (%s)', (type) => {
        expect(decoratorTypeLabel(type)).toBe('(no type)');
    });

    it('shows a type that is not a string as JSON', () => {
        expect(decoratorTypeLabel(42)).toBe('42');
        expect(decoratorTypeLabel({ name: 'x' })).toBe('{"name":"x"}');
    });
});
