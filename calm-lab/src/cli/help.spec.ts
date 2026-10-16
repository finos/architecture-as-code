import { describe, it, expect } from 'vitest';
import { helpFor } from './help';

describe('helpFor', () => {
    it('lists the commands the lab runs, labelled as the lab', () => {
        const text = helpFor().map((line) => line.text);
        expect(text[0]).toBe('calm in the browser lab — the commands it runs:');
        expect(text).toContain('  validate   Validate a CALM document.');
        expect(text).toContain('  generate   Generate an architecture from a CALM pattern file.');
        expect(text[text.length - 1]).toBe('Other commands and options need the CLI — https://calm.finos.org/working-with-calm/cli');
    });

    it('lists only the supported options of a command, with the CLI descriptions', () => {
        const text = helpFor('validate').map((line) => line.text);
        expect(text[0]).toBe('calm validate in the browser lab — the options it supports:');
        expect(text).toContain('  -a, --architecture <file>               Path to the architecture file to use. May be a file path or a URL.');
        expect(text).toContain('  -p, --pattern <file>                    Path to the pattern file to use. May be a file path or a URL.');
        expect(text).toContain('  -u, --url-to-local-file-mapping <path>  Path to mapping file which maps URLs to local paths');
        expect(text).toContain('  -f, --format <format>                   The format of the output (choices: json, pretty; default: json)');
        expect(text.some((line) => line.includes('--timeline'))).toBe(false);
    });

    it('lists the generate options the lab supports, with the -o default', () => {
        const text = helpFor('generate').map((line) => line.text);
        expect(text.slice(0, 4)).toEqual([
            'calm generate in the browser lab — the options it supports:',
            '  -p, --pattern <file>                    Path to the pattern file to use. May be a file path or a CalmHub URL.',
            '  -o, --output <file>                     Path location at which to output the generated file. (default: architecture.json)',
            '  -u, --url-to-local-file-mapping <path>  Path to mapping file which maps URLs to local paths',
        ]);
        expect(text.some((line) => line.includes('--option-choices'))).toBe(false);
    });

    it('keeps the CLI choices for diff -f', () => {
        expect(helpFor('diff').map((line) => line.text)).toContain('  -f, --format <format>    Output format (choices: json, summary; default: json)');
    });
});
