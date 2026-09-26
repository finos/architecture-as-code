import type { Line } from '../shell';

export const CLI_DOCS = 'https://calm.finos.org/working-with-calm/cli';

/** The only lab-specific text the `calm` command prints. */
export function unsupportedInLab(command: string, what: string): Line {
    return { text: `The browser lab doesn't support \`${what}\` for \`calm ${command}\` yet. Use the CLI — ${CLI_DOCS}`, kind: 'dim' };
}
