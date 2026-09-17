/**
 * Which `calm` CLI commands the browser entry point can honour. Browser consumers (e.g. the
 * in-browser learning lab) use this to report honestly which commands are available and why the
 * others are not. `cli/src/browser-manifest.spec.ts` asserts this list matches the commands the
 * CLI actually registers, so the two cannot drift — at top-level commands plus the `hub`
 * subgroups' granularity; `workspace` subcommands are covered by the single `workspace` entry,
 * not enumerated individually.
 */
export type BrowserCommandSupport =
    | { command: string; status: 'supported' }
    | { command: string; status: 'unsupported'; reason: string };

const FILESYSTEM_REASON = 'reads template bundles and writes its output through the local filesystem';

export const BROWSER_COMMAND_SUPPORT: readonly BrowserCommandSupport[] = [
    { command: 'validate', status: 'supported' },
    { command: 'generate', status: 'supported' },
    { command: 'diff', status: 'supported' },
    {
        command: 'timeline',
        status: 'unsupported',
        reason: 'synthesises a timeline from versioned architecture files on the local filesystem; timeline diffing is available in the browser through diffTimeline (the diff --timeline core)'
    },
    { command: 'template', status: 'unsupported', reason: FILESYSTEM_REASON },
    { command: 'docify', status: 'unsupported', reason: `${FILESYSTEM_REASON}, and rasterises diagrams with a headless browser` },
    { command: 'init-ai', status: 'unsupported', reason: 'installs AI assistant files into the local project' },
    { command: 'init-config', status: 'unsupported', reason: 'writes the CLI configuration file on the local machine' },
    { command: 'hub pull', status: 'unsupported', reason: 'reads from a CALM Hub over HTTP, which needs CORS headers on the target Hub' },
    { command: 'hub list', status: 'unsupported', reason: 'reads from a CALM Hub over HTTP, which needs CORS headers on the target Hub' },
    { command: 'hub push', status: 'unsupported', reason: 'writes to a CALM Hub; browser consumers simulate publishing instead' },
    { command: 'hub create', status: 'unsupported', reason: 'writes to a CALM Hub; browser consumers simulate publishing instead' },
    { command: 'workspace', status: 'unsupported', reason: 'operates on a git-rooted workspace bundle on the local filesystem' },
];

export function browserSupportFor(command: string): BrowserCommandSupport | undefined {
    return BROWSER_COMMAND_SUPPORT.find((entry) => entry.command === command);
}
