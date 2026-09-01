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
});
