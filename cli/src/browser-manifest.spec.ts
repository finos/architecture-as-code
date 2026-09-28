import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { setupCLI } from './cli';
import { BROWSER_COMMAND_SUPPORT } from '@finos/calm-shared/browser';

function registeredCommandKeys(): string[] {
    const program = new Command();
    setupCLI(program);
    const keys: string[] = [];
    for (const command of program.commands) {
        if (command.name() === 'hub') {
            for (const sub of command.commands) {
                keys.push(`hub ${sub.name()}`);
            }
        } else {
            keys.push(command.name());
        }
    }
    return keys.sort();
}

describe('browser capability manifest matches the CLI', () => {
    // Granularity: top-level commands plus the `hub` subgroups (`hub pull`, `hub list`, ...);
    // `workspace` subcommands are intentionally not enumerated, they're covered by the single
    // `workspace` entry.
    it('lists every registered command exactly once', () => {
        const manifest = BROWSER_COMMAND_SUPPORT.map((entry) => entry.command).sort();
        expect(manifest).toEqual(registeredCommandKeys());
    });

    it('lists every option of each command it describes, with the CLI flags, text and choices', () => {
        const program = new Command();
        setupCLI(program);
        for (const entry of BROWSER_COMMAND_SUPPORT) {
            if (entry.status !== 'supported' || !entry.options) continue;
            const command = program.commands.find((candidate) => candidate.name() === entry.command);
            expect(command, entry.command).toBeDefined();
            expect(entry.description).toBe(command!.description());
            const cliOptions = command!.options.map((option) => ({
                flags: option.flags,
                description: option.description,
                hidden: option.hidden || undefined,
                choices: option.argChoices,
            })).sort((a, b) => a.flags.localeCompare(b.flags));
            const manifestOptions = entry.options.map((option) => ({
                flags: option.flags,
                description: option.description,
                hidden: option.hidden,
                choices: option.choices,
            })).sort((a, b) => a.flags.localeCompare(b.flags));
            expect(manifestOptions, entry.command).toEqual(cliOptions);
            for (const option of entry.options.filter((candidate) => candidate.supported)) {
                const cliOption = command!.options.find((candidate) => candidate.flags === option.flags)!;
                expect(option.defaultValue, option.flags).toBe(cliOption.defaultValue);
            }
        }
    });

    it('describes the options of validate and diff', () => {
        const described = BROWSER_COMMAND_SUPPORT.filter((entry) => entry.status === 'supported' && entry.options);
        expect(described.map((entry) => entry.command).sort()).toEqual(['diff', 'validate']);
    });
});
