import { browserSupportFor, type BrowserOptionSupport } from '@finos/calm-shared/browser';
import { suggestSimilar } from './suggest';

export interface OptionSpec extends BrowserOptionSupport {
    short?: string;
    long: string;
    attribute: string;
    takesValue: boolean;
}

export type ParsedArgs =
    | { kind: 'ok'; values: Record<string, string | true>; given: OptionSpec[] }
    | { kind: 'help' }
    | { kind: 'error'; message: string };

const FLAGS = /^(?:(-[A-Za-z]),\s*)?(--[a-z][a-z0-9-]*)(?:\s+(<[^>]+>|\[[^\]]+\]))?$/;
const HELP = new Set(['-h', '--help']);

function toSpec(option: BrowserOptionSupport): OptionSpec {
    const match = FLAGS.exec(option.flags);
    if (!match) {
        throw new Error(`Unrecognised flags in the browser manifest: ${option.flags}`);
    }
    const [, short, long, argument] = match;
    if (argument?.startsWith('[')) {
        // No CLI option has an optional value today; fail loudly if one appears.
        throw new Error(`Optional option values are not supported by the lab parser: ${option.flags}`);
    }
    const attribute = long.slice(2).replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    return { ...option, short, long, attribute, takesValue: Boolean(argument) };
}

export function optionSpecs(command: string): OptionSpec[] {
    const entry = browserSupportFor(command);
    return entry?.status === 'supported' && entry.options ? entry.options.map(toSpec) : [];
}

const NEGATIVE_NUMBER = /^-(\d+|\d*\.\d+)(e[+-]?\d+)?$/;

/** Commander's unknown-option error; long flags get a suggestion from the visible options. */
export function unknownOption(token: string, specs: OptionSpec[]): string {
    const candidates = token.startsWith('--')
        ? [...specs.filter((spec) => !spec.hidden).map((spec) => spec.long), '--help', '--version']
        : [];
    return `error: unknown option '${token}'${suggestSimilar(token, candidates)}`;
}

/** The program-level `-V, --version`, which commander honours anywhere before `--`. */
export function requestsVersion(args: string[]): boolean {
    const end = args.indexOf('--');
    return (end === -1 ? args : args.slice(0, end)).some((arg) => arg === '--version' || arg.startsWith('-V'));
}

function findSpec(token: string, specs: OptionSpec[]): { spec: OptionSpec; attached?: string; rest?: string } | undefined {
    const exact = specs.find((spec) => spec.long === token || spec.short === token);
    if (exact) {
        return { spec: exact };
    }
    if (token.length > 2 && token[0] === '-' && token[1] !== '-') {
        const spec = specs.find((candidate) => candidate.short === token.slice(0, 2));
        if (spec) {
            // `-ax.json` is `-a x.json`; `-vf pretty` is `-v -f pretty`.
            return spec.takesValue ? { spec, attached: token.slice(2) } : { spec, rest: `-${token.slice(2)}` };
        }
    }
    const equals = token.indexOf('=');
    if (token.startsWith('--') && equals > 2) {
        const spec = specs.find((candidate) => candidate.long === token.slice(0, equals));
        if (spec?.takesValue) {
            return { spec, attached: token.slice(equals + 1) };
        }
    }
    return undefined;
}

/** Mirrors commander's parseOptions, then its help, unknown-option and excess-argument checks in that order. */
export function parseArgs(command: string, args: string[]): ParsedArgs {
    const specs = optionSpecs(command);
    const values: Record<string, string | true> = {};
    const given: OptionSpec[] = [];
    const operands: string[] = [];
    const unknown: string[] = [];
    let dest = operands;
    for (const spec of specs) {
        if (spec.defaultValue !== undefined) {
            values[spec.attribute] = spec.defaultValue;
        }
    }

    let group: string | undefined;
    let i = 0;
    while (i < args.length || group !== undefined) {
        const token = group ?? args[i++];
        group = undefined;
        if (token === '--') {
            if (dest === unknown) {
                dest.push(token);
            }
            dest.push(...args.slice(i));
            break;
        }

        const found = token.length > 1 && token[0] === '-' ? findSpec(token, specs) : undefined;
        if (!found) {
            // Commander keeps parsing known options after an unknown one; the rest of the args join the unknown list.
            if (dest === operands && token.length > 1 && token[0] === '-' && !NEGATIVE_NUMBER.test(token)) {
                dest = unknown;
            }
            dest.push(token);
            continue;
        }

        const { spec, attached, rest } = found;
        group = rest;
        if (spec.takesValue) {
            const value = attached ?? args[i++];
            if (value === undefined) {
                return { kind: 'error', message: `error: option '${spec.flags}' argument missing` };
            }
            if (spec.choices && !spec.choices.includes(value)) {
                return {
                    kind: 'error',
                    message: `error: option '${spec.flags}' argument '${value}' is invalid. Allowed choices are ${spec.choices.join(', ')}.`,
                };
            }
            values[spec.attribute] = value;
        } else {
            values[spec.attribute] = true;
        }
        if (!given.includes(spec)) {
            given.push(spec);
        }
    }

    if (unknown.some((token) => HELP.has(token))) {
        return { kind: 'help' };
    }
    if (unknown.length) {
        return { kind: 'error', message: unknownOption(unknown[0], specs) };
    }
    if (operands.length) {
        return {
            kind: 'error',
            message: `error: too many arguments for '${command}'. Expected 0 arguments but got ${operands.length}.`,
        };
    }
    return { kind: 'ok', values, given };
}
