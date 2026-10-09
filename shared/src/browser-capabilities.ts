/**
 * Which `calm` CLI commands the browser entry point can honour, and (for `validate`, `generate` and `diff`)
 * which of each command's options it can honour too. Browser consumers (e.g. the in-browser
 * learning lab) use this to report honestly which commands/options are available and why the
 * others are not. `cli/src/browser-manifest.spec.ts` asserts the commands and options match what
 * the CLI actually registers, so the two cannot drift — at top-level commands plus the `hub`
 * subgroups' granularity; `workspace` subcommands are covered by the single `workspace` entry,
 * not enumerated individually.
 */
export interface BrowserOptionSupport {
    /** The commander flag string, exactly as the CLI registers it. */
    flags: string;
    description: string;
    /** False when the browser entry cannot honour the option; consumers say so rather than ignore it. */
    supported: boolean;
    hidden?: boolean;
    /** Registered with commander's `requiredOption`. */
    mandatory?: boolean;
    choices?: readonly string[];
    /** Only recorded for supported options — unsupported defaults can be machine paths. */
    defaultValue?: string;
}

export type BrowserCommandSupport =
    | { command: string; status: 'supported'; description?: string; options?: readonly BrowserOptionSupport[] }
    | { command: string; status: 'unsupported'; reason: string };

const FILESYSTEM_REASON = 'reads template bundles and writes its output through the local filesystem';

export const BROWSER_COMMAND_SUPPORT: readonly BrowserCommandSupport[] = [
    {
        command: 'validate',
        status: 'supported',
        description: 'Validate a CALM document.',
        options: [
            { flags: '-p, --pattern <file>', description: 'Path to the pattern file to use. May be a file path or a URL.', supported: true },
            { flags: '-a, --architecture <file>', description: 'Path to the architecture file to use. May be a file path or a URL.', supported: true },
            { flags: '--timeline <file>', description: 'Path to the timeline file to validate. May be a file path or a URL.', supported: false },
            { flags: '-s, --schema-directory <path>', description: 'Path to the directory containing the meta schemas to use.', supported: false },
            { flags: '-c, --calm-hub-url <url>', description: 'URL to CALMHub instance', supported: false },
            { flags: '--assets-path <path>', description: 'Local path to CALM assets directory for resolving detailed-architecture CURIEs without a Hub', supported: false },
            { flags: '-u, --url-to-local-file-mapping <path>', description: 'Path to mapping file which maps URLs to local paths', supported: true },
            { flags: '--strict', description: 'When run in strict mode, the CLI will fail if any warnings are reported.', supported: false },
            { flags: '-f, --format <format>', description: 'The format of the output', supported: true, choices: ['json', 'junit', 'pretty'], defaultValue: 'json' },
            { flags: '-o, --output <file>', description: 'Path location at which to output the generated file.', supported: false },
            { flags: '-v, --verbose', description: 'Enable verbose logging.', supported: false },
        ],
    },
    {
        command: 'generate',
        status: 'supported',
        description: 'Generate an architecture from a CALM pattern file.',
        options: [
            { flags: '-p, --pattern <file>', description: 'Path to the pattern file to use. May be a file path or a CalmHub URL.', supported: true, mandatory: true },
            { flags: '-o, --output <file>', description: 'Path location at which to output the generated file.', supported: true, mandatory: true, defaultValue: 'architecture.json' },
            { flags: '-s, --schema-directory <path>', description: 'Path to the directory containing the meta schemas to use.', supported: false },
            { flags: '-c, --calm-hub-url <url>', description: 'URL to CALMHub instance', supported: false },
            { flags: '-u, --url-to-local-file-mapping <path>', description: 'Path to mapping file which maps URLs to local paths', supported: true },
            { flags: '--option-choices <choices>', description: 'Pre-defined option choices as a JSON object mapping option unique-ids to choice descriptions, or a path to a JSON file. Skips interactive prompts.', supported: false },
            { flags: '-v, --verbose', description: 'Enable verbose logging.', supported: false },
        ],
    },
    {
        command: 'diff',
        status: 'supported',
        description: 'Compare two CALM documents (architectures or patterns), or the moments of a CALM timeline, and report what changed.',
        options: [
            { flags: '-a, --document-a <file>', description: 'Path to the first (baseline) CALM document.', supported: true },
            { flags: '-b, --document-b <file>', description: 'Path to the second CALM document to compare against the baseline.', supported: true },
            { flags: '--timeline <file>', description: 'Path to a CALM timeline file. Diffs adjacent moments, or a specific pair with --from/--to.', supported: false },
            { flags: '--from <momentId>', description: 'With --timeline, the unique-id of the baseline moment (requires --to).', supported: false },
            { flags: '--to <momentId>', description: 'With --timeline, the unique-id of the moment to compare against (requires --from).', supported: false },
            { flags: '--architecture-a <file>', description: 'Deprecated alias for --document-a.', supported: false, hidden: true },
            { flags: '--architecture-b <file>', description: 'Deprecated alias for --document-b.', supported: false, hidden: true },
            { flags: '-f, --format <format>', description: 'Output format', supported: true, choices: ['json', 'summary'], defaultValue: 'json' },
            { flags: '-t, --type <type>', description: 'Force the document type instead of auto-detecting it.', supported: false, choices: ['architecture', 'pattern'] },
            { flags: '-o, --output <file>', description: 'Path location at which to write the diff output. If omitted, prints to stdout.', supported: false },
            { flags: '--exit-code', description: 'Exit with a non-zero status code when changes are detected. Useful in CI to gate version bumps.', supported: false },
            { flags: '-v, --verbose', description: 'Enable verbose logging.', supported: false },
        ],
    },
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
