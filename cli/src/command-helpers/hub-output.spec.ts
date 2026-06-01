import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseOutputFormat, printError, printJsonSuccess, printTableSuccess } from './hub-output';

describe('parseOutputFormat', () => {
    it('returns "pretty" for "pretty"', () => {
        expect(parseOutputFormat('pretty')).toBe('pretty');
    });

    it('returns "json" for "json"', () => {
        expect(parseOutputFormat('json')).toBe('json');
    });

    it('returns "json" for undefined', () => {
        expect(parseOutputFormat(undefined)).toBe('json');
    });

    it('returns "json" for any unrecognised value', () => {
        expect(parseOutputFormat('xml')).toBe('json');
        expect(parseOutputFormat('')).toBe('json');
    });
});

describe('printJsonSuccess', () => {
    afterEach(() => vi.restoreAllMocks());

    it('writes pretty-printed JSON to stdout', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(function () {});
        printJsonSuccess({ a: 1, b: 'x' });
        expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify({ a: 1, b: 'x' }, null, 2));
    });
});

describe('printTableSuccess', () => {
    afterEach(() => vi.restoreAllMocks());

    it('prints "(no results)" when rows are empty', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(function () {});
        printTableSuccess([], [{ key: 'name', header: 'Name' }]);
        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith('(no results)');
    });

    it('aligns each column to the wider of header / longest cell', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(function () {});
        printTableSuccess(
            [
                { id: '1', name: 'short' },
                { id: '12', name: 'a-much-longer-name' },
            ],
            [
                { key: 'id', header: 'ID' },
                { key: 'name', header: 'Name' },
            ]
        );
        // header + divider + 2 rows = 4 lines
        expect(consoleSpy).toHaveBeenCalledTimes(4);
        const calls = consoleSpy.mock.calls.map((c) => c[0] as string);
        expect(calls[0]).toBe('ID  Name              '); // header padded to widths [2, 18]
        expect(calls[1]).toBe('--  ------------------');
        expect(calls[2]).toBe('1   short             ');
        expect(calls[3]).toBe('12  a-much-longer-name');
    });

    it('coerces missing or non-string values to empty strings', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(function () {});
        printTableSuccess(
            [{ name: 'Alice' }, { name: null }, { name: undefined }],
            [{ key: 'name', header: 'Name' }]
        );
        const rows = consoleSpy.mock.calls.slice(2).map((c) => (c[0] as string).trim());
        expect(rows).toEqual(['Alice', '', '']);
    });
});

describe('printError', () => {
    afterEach(() => vi.restoreAllMocks());

    it('writes a plain-text line to stderr in pretty mode', () => {
        const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(function () { return true; });
        printError(404, 'Not Found', '/things/42', 'pretty');
        expect(stderrSpy).toHaveBeenCalledWith('Error 404 [/things/42]: Not Found\n');
    });

    it('writes a JSON line to stderr in json mode', () => {
        const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(function () { return true; });
        printError(500, 'boom', '/explode', 'json');
        expect(stderrSpy).toHaveBeenCalledWith(
            JSON.stringify({ status: 500, error: 'boom', request: '/explode' }) + '\n'
        );
    });
});
