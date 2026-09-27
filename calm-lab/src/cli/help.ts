import { BROWSER_COMMAND_SUPPORT } from '@finos/calm-shared/browser';
import type { Line } from '../shell';
import { optionSpecs } from './options';
import { CLI_DOCS, VALIDATE_LAB_FORMATS } from './unsupported';

const LAB_COMMANDS = ['validate', 'diff'] as const;

function columns(rows: [string, string][], width = Math.max(...rows.map(([left]) => left.length))): Line[] {
    return rows.map(([left, right]) => ({ text: `  ${left.padEnd(width)}  ${right}`, kind: 'dim' }));
}

export function helpFor(command?: (typeof LAB_COMMANDS)[number]): Line[] {
    const footer: Line = { text: `Other commands and options need the CLI — ${CLI_DOCS}`, kind: 'dim' };
    if (!command) {
        const rows = LAB_COMMANDS.map((name): [string, string] => {
            const entry = BROWSER_COMMAND_SUPPORT.find((candidate) => candidate.command === name);
            return [name, entry?.status === 'supported' ? entry.description ?? '' : ''];
        });
        const allRows: [string, string][] = [...rows, ['--version', 'output the version number']];
        return [
            { text: 'calm in the browser lab — the commands it runs:', kind: 'out' },
            ...columns(allRows),
            footer,
        ];
    }
    const rows = optionSpecs(command)
        .filter((spec) => spec.supported)
        .map((spec): [string, string] => {
            const choices = command === 'validate' && spec.long === '--format' ? VALIDATE_LAB_FORMATS : spec.choices;
            const extras = [
                choices && `choices: ${choices.join(', ')}`,
                spec.defaultValue !== undefined && `default: ${spec.defaultValue}`,
            ].filter(Boolean);
            return [spec.flags, extras.length ? `${spec.description} (${extras.join('; ')})` : spec.description];
        });
    return [{ text: `calm ${command} in the browser lab — the options it supports:`, kind: 'out' }, ...columns(rows), footer];
}
