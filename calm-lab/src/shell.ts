/**
 * Command interpreter for the lab terminal. Pure logic: takes an input
 * line plus a context (vfs, cwd accessors, event sink) and returns
 * coloured output lines for the terminal to render.
 *
 * Line kinds: 'out' (normal), 'ok' (green), 'err' (red), 'dim' (muted),
 * and the special 'clear' sentinel telling the terminal to empty its
 * scrollback.
 */

import { runDiff } from './cli/diff';
import { runGenerate } from './cli/generate';
import { runValidate } from './cli/validate';
import { helpFor, LAB_COMMANDS, type LabCommand } from './cli/help';
import { requestsVersion, unknownOption } from './cli/options';
import { suggestSimilar } from './cli/suggest';
import { CLI_DOCS } from './cli/unsupported';
import type { CommandEvent } from './cli/outcome';
import { BROWSER_COMMAND_SUPPORT } from '@finos/calm-shared/browser';
import { commandSupport, hubCommands, CLI_VERSION } from './engine';
import type { Vfs } from './lab/vfs';

export interface Line { text: string; kind: 'out' | 'ok' | 'err' | 'dim' | 'clear' }

export interface ShellContext {
    vfs: Vfs;
    getCwd(): string;
    setCwd(dir: string): void;
    onEvent?(event: CommandEvent): void;
}

export interface CompletionCandidates { candidates: string[] }
export interface CompletionValue { value: string; caret: number }
export type CompletionResult = CompletionCandidates | CompletionValue;

/** Every command `runCommand` understands — the terminal completes against this. */
export const COMMAND_NAMES: readonly string[] = ['calm', 'cat', 'cd', 'clear', 'echo', 'help', 'ls', 'pwd'];

/** Second-token completions after `calm`. */
export const CALM_SUBCOMMANDS = ['validate', 'generate', 'diff', 'help', '--version'] as const;

const HELP_LINES: Line[] = [
    { text: 'Available commands:', kind: 'out' },
    { text: '  ls [path]            list files', kind: 'dim' },
    { text: '  cat <file>           print a file', kind: 'dim' },
    { text: '  cd <dir>             change directory', kind: 'dim' },
    { text: '  pwd                  print working directory', kind: 'dim' },
    { text: '  echo <text>          print text', kind: 'dim' },
    { text: '  clear                clear the terminal', kind: 'dim' },
    { text: '  calm validate -a <file>        validate a CALM architecture', kind: 'dim' },
    { text: '  calm generate -p <pattern>     generate an architecture from a pattern', kind: 'dim' },
    { text: '  calm diff -a <file> -b <file>  compare two CALM documents', kind: 'dim' },
    { text: '  calm help                      what the lab runs', kind: 'dim' },
];

/** The `calm` program's commands (commander's candidates for "Did you mean"), from the manifest. */
const CLI_COMMANDS: readonly string[] = [...new Set(BROWSER_COMMAND_SUPPORT.map((entry) => entry.command.split(' ')[0])), 'help'];

const errLines = (message: string): Line[] => message.split('\n').map((text) => ({ text, kind: 'err' }));

function unknownCommand(name: string, candidates: readonly string[]): Line[] {
    return errLines(`error: unknown command '${name}'${suggestSimilar(name, [...candidates])}`);
}

/** Commander shows the program help when -h/--help is among the args it could not place. */
function programHelpRequested(args: string[]): boolean {
    let unplaced = false;
    for (const [index, arg] of args.entries()) {
        if (arg === '--') {
            return unplaced && args.slice(index + 1).some((rest) => rest === '-h' || rest === '--help');
        }
        unplaced ||= arg.length > 1 && arg.startsWith('-');
        if (unplaced && (arg === '-h' || arg === '--help')) {
            return true;
        }
    }
    return false;
}

async function runCalm(args: string[], ctx: ShellContext): Promise<Line[]> {
    // Commander parses the program's options first, so `-V` wins wherever it appears before `--`.
    if (requestsVersion(args)) {
        return [{ text: CLI_VERSION, kind: 'out' }];
    }
    const [sub, ...rest] = args;
    if (!sub || sub === '--help' || sub === '-h') {
        return helpFor();
    }
    if (sub === 'help') {
        return (LAB_COMMANDS as readonly string[]).includes(rest[0]) ? helpFor(rest[0] as LabCommand) : helpFor();
    }
    if (sub.startsWith('-') || !CLI_COMMANDS.includes(sub)) {
        if (programHelpRequested(args)) {
            return helpFor();
        }
        return sub.startsWith('-') ? errLines(unknownOption(sub, [])) : unknownCommand(sub, CLI_COMMANDS);
    }
    if (sub === 'validate') {
        return runValidate(rest, ctx);
    }
    if (sub === 'generate') {
        return runGenerate(rest, ctx);
    }
    if (sub === 'diff') {
        return runDiff(rest, ctx);
    }
    // `hub` is a subgroup: the manifest keys its reasons on `hub pull`, `hub push` and friends,
    // so a bare `calm hub` lists them rather than claiming `hub` is unknown.
    if (sub === 'hub' && rest[0]?.startsWith('-') && rest[0] !== '-h' && rest[0] !== '--help') {
        return errLines(unknownOption(rest[0], []));
    }
    if (sub === 'hub' && (!rest[0] || rest[0] === '-h' || rest[0] === '--help')) {
        const entries = hubCommands();
        if (entries.length) {
            return [
                { text: '`calm hub` needs a subcommand:', kind: 'out' },
                ...entries.map((entry): Line => ({
                    text: `  calm ${entry.command} — ${entry.status === 'unsupported' ? entry.reason : 'the engine supports it, but it is not wired into the lab yet'}`,
                    kind: 'dim',
                })),
                { text: `Use the CLI for these — ${CLI_DOCS}`, kind: 'dim' },
            ];
        }
    }
    const command = sub === 'hub' ? `hub ${rest[0]}` : sub;
    const support = commandSupport(command);
    if (support?.status === 'unsupported') {
        return [{ text: `\`calm ${command}\` isn't available in the browser lab: ${support.reason}. Use the CLI — ${CLI_DOCS}`, kind: 'dim' }];
    }
    if (support?.status === 'supported') {
        return [{ text: `\`calm ${command}\` isn't wired into the lab yet — the engine supports it; see ${CLI_DOCS}`, kind: 'dim' }];
    }
    return unknownCommand(rest[0], [...hubCommands().map((entry) => entry.command.split(' ')[1]), 'help']);
}

function longestCommonPrefix(values: string[]): string {
    let prefix = values[0] || '';
    for (const value of values.slice(1)) {
        let length = 0;
        while (
            length < prefix.length &&
            length < value.length &&
            prefix[length] === value[length]
        ) {
            length += 1;
        }
        prefix = prefix.slice(0, length);
    }
    return prefix;
}

interface Candidate { core: string; suffix: string; display: string }

/**
 * Path completion for the token `partial`, relative to the cwd. Splits
 * on `/` so the learner can drill into directories: directories
 * complete with a trailing `/` and no space, files with a space.
 */
function completePath(partial: string, ctx: Pick<ShellContext, 'vfs' | 'getCwd'>): Candidate[] {
    const slash = partial.lastIndexOf('/');
    const dirPart = slash === -1 ? '' : partial.slice(0, slash + 1);
    const base = slash === -1 ? partial : partial.slice(slash + 1);
    const dir = dirPart ? ctx.vfs.resolve(ctx.getCwd(), dirPart) : ctx.getCwd();
    if (!ctx.vfs.isDir(dir)) {
        return [];
    }
    return ctx.vfs
        .list(dir)
        .filter((entry) => entry.name.startsWith(base))
        .map((entry) => ({
            core: dirPart + entry.name,
            suffix: entry.isDir ? '/' : ' ',
            display: entry.isDir ? `${entry.name}/` : entry.name,
        }));
}

/**
 * Bash-style tab completion for the token ending at `cursor`.
 * Returns null when nothing matches; otherwise either
 * `{value, caret}` (replace the input, move the caret) or
 * `{candidates}` (print the possibilities, keep the input as-is).
 */
export function completeCommand(
    input: string,
    cursor: number | undefined,
    ctx: Pick<ShellContext, 'vfs' | 'getCwd'>,
): CompletionResult | null {
    const caret = typeof cursor === 'number' ? cursor : input.length;
    const before = input.slice(0, caret);
    const partial = before.match(/\S*$/)![0];
    const tokenStart = caret - partial.length;
    const preceding = before.slice(0, tokenStart).split(/\s+/).filter(Boolean);

    let candidates: Candidate[];
    if (preceding.length === 0) {
        candidates = COMMAND_NAMES.filter((name) => name.startsWith(partial)).map(
            (name) => ({ core: name, suffix: ' ', display: name }),
        );
    } else if (preceding.length === 1 && preceding[0] === 'calm') {
        candidates = CALM_SUBCOMMANDS.filter((name) => name.startsWith(partial)).map(
            (name) => ({ core: name, suffix: ' ', display: name }),
        );
    } else {
        candidates = completePath(partial, ctx);
    }

    if (!candidates.length) {
        return null;
    }
    const head = input.slice(0, tokenStart);
    const tail = input.slice(caret);
    if (candidates.length === 1) {
        const text = candidates[0].core + candidates[0].suffix;
        return { value: head + text + tail, caret: tokenStart + text.length };
    }
    const prefix = longestCommonPrefix(candidates.map((candidate) => candidate.core));
    if (prefix.length > partial.length) {
        return { value: head + prefix + tail, caret: tokenStart + prefix.length };
    }
    return { candidates: candidates.map((candidate) => candidate.display) };
}

export async function runCommand(input: string, ctx: ShellContext): Promise<Line[]> {
    const trimmed = input.trim();
    if (!trimmed) {
        return [];
    }
    const [cmd, ...args] = trimmed.split(/\s+/);
    const { vfs } = ctx;

    switch (cmd) {
        case 'help':
            return HELP_LINES;
        case 'pwd':
            return [{ text: ctx.getCwd(), kind: 'out' }];
        case 'clear':
            return [{ text: '', kind: 'clear' }];
        case 'echo':
            return [{ text: args.join(' '), kind: 'out' }];
        case 'ls': {
            const path = vfs.resolve(ctx.getCwd(), args[0] || '.');
            if (vfs.exists(path)) {
                return [{ text: path.split('/').pop()!, kind: 'out' }];
            }
            if (vfs.isDir(path)) {
                return vfs.list(path).map((entry): Line => ({
                    text: entry.isDir ? `${entry.name}/` : entry.name,
                    kind: entry.isDir ? 'dim' : 'out',
                }));
            }
            return [{ text: `ls: no such file or directory: ${args[0] || path}`, kind: 'err' }];
        }
        case 'cat': {
            if (!args[0]) {
                return [{ text: 'usage: cat <file>', kind: 'err' }];
            }
            const path = vfs.resolve(ctx.getCwd(), args[0]);
            if (vfs.isDir(path) && !vfs.exists(path)) {
                return [{ text: `cat: ${args[0]}: is a directory`, kind: 'err' }];
            }
            const content = vfs.read(path);
            if (content === null) {
                return [{ text: `cat: ${args[0]}: no such file`, kind: 'err' }];
            }
            return content
                .replace(/\n$/, '')
                .split('\n')
                .map((text): Line => ({ text, kind: 'out' }));
        }
        case 'cd': {
            const path = vfs.resolve(ctx.getCwd(), args[0] || '/workspace');
            if (!vfs.isDir(path)) {
                return [{ text: `cd: no such directory: ${args[0] || path}`, kind: 'err' }];
            }
            ctx.setCwd(path);
            return [];
        }
        case 'calm':
            return runCalm(args, ctx);
        default:
            return [{ text: `command not found: ${cmd} — try \`help\``, kind: 'err' }];
    }
}
