import { describe, it, expect } from 'vitest';
import { helpFor } from './help';

describe('helpFor', () => {
    it('lists the commands the lab runs, labelled as the lab', () => {
        const text = helpFor().map((line) => line.text);
        expect(text[0]).toBe('calm in the browser lab — the commands it runs:');
        expect(text).toContain('  validate   Validate a CALM document.');
        expect(text[text.length - 1]).toBe('Other commands and options need the CLI — https://calm.finos.org/working-with-calm/cli');
    });

    it('lists only the supported options of a command, with the CLI descriptions', () => {
        const text = helpFor('validate').map((line) => line.text);
        expect(text[0]).toBe('calm validate in the browser lab — the options it supports:');
        expect(text).toContain('  -a, --architecture <file>  Path to the architecture file to use. May be a file path or a URL.');
        expect(text).toContain('  -f, --format <format>      The format of the output (choices: json, junit, pretty; default: json)');
        expect(text.some((line) => line.includes('--pattern'))).toBe(false);
    });
});
