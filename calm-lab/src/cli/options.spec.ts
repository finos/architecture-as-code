import { describe, it, expect } from 'vitest';
import { parseArgs, optionSpecs, requestsVersion } from './options';

describe('optionSpecs', () => {
    it('derives short, long, attribute and arity from the manifest flags', () => {
        const byLong = Object.fromEntries(optionSpecs('diff').map((spec) => [spec.long, spec]));
        expect(byLong['--document-a']).toMatchObject({ short: '-a', attribute: 'documentA', takesValue: true });
        expect(byLong['--exit-code']).toMatchObject({ short: undefined, attribute: 'exitCode', takesValue: false });
    });
});

describe('parseArgs matches commander', () => {
    it.each([
        [['-a', 'x.json'], { architecture: 'x.json', format: 'json' }],
        [['--architecture', 'x.json', '-f', 'pretty'], { architecture: 'x.json', format: 'pretty' }],
        [['--architecture=x.json'], { architecture: 'x.json', format: 'json' }],
        [['-ax.json', '-fpretty'], { architecture: 'x.json', format: 'pretty' }],
        [['-a', 'x.json', '-a', 'y.json'], { architecture: 'y.json', format: 'json' }],
    ])('parses %j', (args, values) => {
        const parsed = parseArgs('validate', args);
        expect(parsed).toMatchObject({ kind: 'ok', values });
    });

    it.each([
        [['x.json'], "error: too many arguments for 'validate'. Expected 0 arguments but got 1."],
        [['-a'], "error: option '-a, --architecture <file>' argument missing"],
        [['-a', 'x.json', '--format'], "error: option '-f, --format <format>' argument missing"],
        [['-a', 'x.json', '-f', 'xml'], "error: option '-f, --format <format>' argument 'xml' is invalid. Allowed choices are json, junit, pretty."],
        [['-a', 'x.json', '-f', 'PRETTY'], "error: option '-f, --format <format>' argument 'PRETTY' is invalid. Allowed choices are json, junit, pretty."],
        [['-a', 'x.json', '-f=pretty'], "error: option '-f, --format <format>' argument '=pretty' is invalid. Allowed choices are json, junit, pretty."],
        [['-a', 'x.json', '--bogus'], "error: unknown option '--bogus'"],
        [['-z'], "error: unknown option '-z'"],
        [['--architectur', 'x.json'], "error: unknown option '--architectur'\n(Did you mean --architecture?)"],
        [['-a', '-f', 'pretty'], "error: too many arguments for 'validate'. Expected 0 arguments but got 1."],
        [['-a', 'x.json', 'extra', '--bogus'], "error: unknown option '--bogus'"],
        [['-a', 'x.json', '--', '-f'], "error: too many arguments for 'validate'. Expected 0 arguments but got 1."],
        [['--strict=1', '-a', 'a.json'], "error: unknown option '--strict=1'\n(Did you mean --strict?)"],
        [['-a', 'a.json', '--verbose=x'], "error: unknown option '--verbose=x'\n(Did you mean --verbose?)"],
        [['--versio'], "error: unknown option '--versio'\n(Did you mean --version?)"],
        [['-h', '-a'], "error: option '-a, --architecture <file>' argument missing"],
        [['-h', '-f', 'xml'], "error: option '-f, --format <format>' argument 'xml' is invalid. Allowed choices are json, junit, pretty."],
        [['--bogus', '-a'], "error: option '-a, --architecture <file>' argument missing"],
        [['--bogus', '-f', 'xml'], "error: option '-f, --format <format>' argument 'xml' is invalid. Allowed choices are json, junit, pretty."],
        [['--bogus', '-a', '--help'], "error: unknown option '--bogus'"],
        [['--bogus', 'extra'], "error: unknown option '--bogus'"],
        [['-vz'], "error: unknown option '-z'"],
        [['-1'], "error: too many arguments for 'validate'. Expected 0 arguments but got 1."],
        [['--', '--help'], "error: too many arguments for 'validate'. Expected 0 arguments but got 1."],
    ])('rejects %j like commander', (args, message) => {
        expect(parseArgs('validate', args)).toEqual({ kind: 'error', message });
    });

    it.each([[['-h']], [['--bogus', '--help']], [['-h', 'extra']], [['extra', '--bogus', '-h']], [['--bogus', '--', '--help']]])(
        'asks for help on %j, ahead of unknown options and excess arguments',
        (args) => {
            expect(parseArgs('validate', args)).toEqual({ kind: 'help' });
        },
    );

    it('keeps parsing known options after an unknown one', () => {
        expect(parseArgs('validate', ['--bogus', '-a', 'x.json', '-f', 'pretty'])).toEqual({ kind: 'error', message: "error: unknown option '--bogus'" });
    });

    it('lets a value-taking option consume --help as its value', () => {
        expect(parseArgs('validate', ['-a', '--help'])).toMatchObject({ kind: 'ok', values: { architecture: '--help' } });
    });

    it('does not suggest hidden options', () => {
        // The CLI prints no suggestion here: the close match, --architecture-a, is hidden.
        expect(parseArgs('diff', ['--architecture-c', 'x'])).toEqual({ kind: 'error', message: "error: unknown option '--architecture-c'" });
    });

    it('reports which options were given', () => {
        const parsed = parseArgs('validate', ['-a', 'x.json', '--strict', '-v']);
        expect(parsed.kind === 'ok' && parsed.given.map((spec) => spec.long)).toEqual(['--architecture', '--strict', '--verbose']);
    });
});

describe('requestsVersion', () => {
    it.each([
        [['--version'], true],
        [['-a', 'a.json', '-V'], true],
        [['-a', '-V'], true],
        [['-Vx'], true],
        [['--', '-V'], false],
        [['-vV'], false],
        [['-a', 'a.json'], false],
    ])('%j -> %s, like the program-level -V, --version', (args, expected) => {
        expect(requestsVersion(args)).toBe(expected);
    });
});
