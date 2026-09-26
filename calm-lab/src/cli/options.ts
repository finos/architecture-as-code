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

function unknownOption(token: string, specs: OptionSpec[]): string {
    const candidates = token.startsWith('--')
        ? [...specs.filter((spec) => !spec.hidden).map((spec) => spec.long), '--help']
        : [];
    return `error: unknown option '${token}'${suggestSimilar(token, candidates)}`;
}

export function parseArgs(command: string, args: string[]): ParsedArgs {
    const specs = optionSpecs(command);
    const values: Record<string, string | true> = {};
    const given: OptionSpec[] = [];
    const operands: string[] = [];
    for (const spec of specs) {
        if (spec.defaultValue !== undefined) {
            values[spec.attribute] = spec.defaultValue;
        }
    }

    const queue = [...args];
    let onlyOperands = false;
    while (queue.length) {
        const token = queue.shift()!;
        if (onlyOperands) {
            operands.push(token);
            continue;
        }
        if (token === '--') {
            onlyOperands = true;
            continue;
        }
        if (HELP.has(token)) {
            return { kind: 'help' };
        }
        if (!token.startsWith('-') || token === '-') {
            operands.push(token);
            continue;
        }

        let spec: OptionSpec | undefined;
        let attached: string | undefined;
        if (token.startsWith('--')) {
            const equals = token.indexOf('=');
            const name = equals === -1 ? token : token.slice(0, equals);
            attached = equals === -1 ? undefined : token.slice(equals + 1);
            spec = specs.find((candidate) => candidate.long === name);
        } else {
            spec = specs.find((candidate) => candidate.short === token.slice(0, 2));
            if (spec && token.length > 2) {
                if (spec.takesValue) {
                    attached = token.slice(2);
                } else {
                    // Combined boolean shorts: `-vf pretty` is `-v -f pretty`.
                    queue.unshift(`-${token.slice(2)}`);
                }
            }
        }

        if (!spec) {
            // Commander stops parsing options at the first unknown one, but still honours a later --help.
            if (queue.some((rest) => HELP.has(rest))) {
                return { kind: 'help' };
            }
            return { kind: 'error', message: unknownOption(token, specs) };
        }

        if (spec.takesValue) {
            const value = attached ?? queue.shift();
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

    if (operands.length) {
        return {
            kind: 'error',
            message: `error: too many arguments for '${command}'. Expected 0 arguments but got ${operands.length}.`,
        };
    }
    return { kind: 'ok', values, given };
}
