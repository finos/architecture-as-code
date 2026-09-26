import { BROWSER_COMMAND_SUPPORT } from '@finos/calm-shared/browser';
import type { Line } from '../shell';
import { optionSpecs } from './options';
import { CLI_DOCS } from './unsupported';

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
        // Width is set by the lab's own commands, not by `--version` — it just rides along.
        const width = Math.max(...rows.map(([left]) => left.length));
        return [
            { text: 'calm in the browser lab — the commands it runs:', kind: 'out' },
            ...columns([...rows, ['--version', 'output the version number']], width),
            footer,
        ];
    }
    const rows = optionSpecs(command)
        .filter((spec) => spec.supported)
        .map((spec): [string, string] => {
            const extras = [
                spec.choices && `choices: ${spec.choices.join(', ')}`,
                spec.defaultValue !== undefined && `default: ${spec.defaultValue}`,
            ].filter(Boolean);
            return [spec.flags, extras.length ? `${spec.description} (${extras.join('; ')})` : spec.description];
        });
    return [{ text: `calm ${command} in the browser lab — the options it supports:`, kind: 'out' }, ...columns(rows), footer];
}
