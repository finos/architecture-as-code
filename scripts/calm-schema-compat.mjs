#!/usr/bin/env node

/**
 * Helpers for .github/workflows/calm-schema-compatibility.yml, which tests every tool against a
 * new @finos/calm-schema release and opens an issue that names the tools that fail.
 *
 * Usage: node scripts/calm-schema-compat.mjs <command>
 *   resolve        Pick the version to test, check that it is on npm, and read the pinned
 *                  version (env: EVENT_NAME, PAYLOAD_VERSION, INPUT_VERSION).
 *   decide         Decide if a scheduled run can skip (env: EVENT_NAME, VERSION, PINNED,
 *                  PASSED, ISSUES_FILE).
 *   use <version>  Install <version> as @finos/calm-schema and as its calm-schema-<major.minor> alias.
 *   test <tool>    Run the build and test commands of one tool.
 *   report         Plan the issue update from the job results (env: VERSION, RUN_URL,
 *                  JOBS_FILE, ISSUES_FILE, BODY_FILE).
 *
 * Outputs go to $GITHUB_OUTPUT when it is set, else to stdout.
 */

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const SCHEMA_PACKAGE = '@finos/calm-schema';
const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// npm metadata can lag just after a publish, so a dispatch waits up to about five minutes.
export const DISPATCH_LOOKUP_ATTEMPTS = 10;
export const LOOKUP_RETRY_MS = 30_000;

// The report writes this into a new issue's body. The workflow replaces it with the issue number.
export const ISSUE_NUMBER_PLACEHOLDER = 'ISSUE_NUMBER';

/**
 * The build and test commands of each tool. Each command is a copy of a step in the tool's
 * build workflow (checked by the tests), so that results match normal CI. Lint steps are left
 * out, because a schema change cannot change them.
 */
export const TOOLS = {
    cli: {
        workflow: 'build-cli.yml',
        commands: ['npm run test:scripts', 'npm run build:cli', 'npm run test --workspace=cli'],
    },
    shared: {
        workflow: 'build-shared.yml',
        commands: ['npm run build:shared', 'npm run test --workspace=shared'],
    },
    'calm-server': {
        workflow: 'build-calm-server.yml',
        commands: ['npm run build:calm-server', 'npm run test:calm-server'],
    },
    'calm-lab': {
        workflow: 'build-calm-lab.yml',
        commands: [
            'npm run build:calm-lab',
            'npm run typecheck --workspace=calm-lab',
            'npm run test --workspace=calm-lab',
        ],
    },
    // calm-core reads the schema. The other packages bundle or call calm-core, so test them all.
    // The Playwright e2e job of build-calm-studio.yml is left out.
    'calm-studio': {
        workflow: 'build-calm-studio.yml',
        commands: [
            'npm run build --if-present --workspace=@finos/calm-models',
            'npm run build --if-present --workspace=@calmstudio/calm-core',
            'npm run build --if-present --workspace=@calmstudio/extensions',
            'npm run build --if-present --workspace=@calmstudio/mcp',
            'npm run build --if-present --workspace=@calmstudio/diagram',
            'npm run build --if-present --workspace=@calmstudio/studio',
            'npm run build --if-present --workspace=calmstudio',
            'npm run build --if-present --workspace=@calmstudio/github-action',
            'npm run build --if-present --workspace=@finos/calm-docusaurus-plugin',
            'npm run typecheck --if-present --workspace=@calmstudio/calm-core',
            'npm run typecheck --if-present --workspace=@calmstudio/extensions',
            'npm run typecheck --if-present --workspace=@calmstudio/mcp',
            'npm run typecheck --if-present --workspace=@calmstudio/github-action',
            'npm run typecheck --if-present --workspace=@finos/calm-docusaurus-plugin',
            'npm run test --if-present --workspace=@calmstudio/calm-core',
            'npm run test --if-present --workspace=@calmstudio/extensions',
            'npm run test --if-present --workspace=@calmstudio/mcp',
            'npm run test --if-present --workspace=@calmstudio/studio',
            'npm run test --if-present --workspace=@calmstudio/diagram',
            'npm run test --if-present --workspace=@finos/calm-docusaurus-plugin',
        ],
    },
    vscode: {
        workflow: 'build-vscode-extension.yml',
        commands: ['npm run test:vscode'],
    },
    'calm-hub': {
        workflow: 'build-calm-hub.yml',
        directory: 'calm-hub',
        commands: ['mvn -P integration clean verify'],
        note: 'The integration profile needs Docker.',
    },
};

// Untrusted values are JSON-quoted in messages, so that a newline cannot start a workflow command.
export function parseVersion(value) {
    const match = /^([0-9]+)\.([0-9]+)\.[0-9]+$/.exec(value ?? '');
    if (!match) {
        throw new Error(`version ${JSON.stringify(value)} is not <major>.<minor>.<patch>`);
    }
    const release = `${match[1]}.${match[2]}`;
    return { version: value, release, alias: `calm-schema-${release}` };
}

/** The version that the event asks for, or undefined for the npm latest version. */
export function requestedVersion({ eventName, payloadVersion, inputVersion }) {
    switch (eventName) {
        case 'repository_dispatch':
            if (!payloadVersion) {
                throw new Error('repository_dispatch needs client_payload.version');
            }
            return payloadVersion;
        case 'workflow_dispatch':
            return inputVersion || undefined;
        case 'schedule':
            return undefined;
        default:
            throw new Error(`unsupported event ${JSON.stringify(eventName)}`);
    }
}

/** Fails unless lookup(version) returns the version. Only a dispatch retries. */
export async function confirmPublished(version, { eventName, lookup, wait = sleep, log = console.error }) {
    const attempts = eventName === 'repository_dispatch' ? DISPATCH_LOOKUP_ATTEMPTS : 1;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        if ((await lookup(version)) === version) {
            return;
        }
        if (attempt < attempts) {
            log(`${SCHEMA_PACKAGE} ${version} is not on npm yet (attempt ${attempt} of ${attempts}).`);
            await wait(LOOKUP_RETRY_MS);
        }
    }
    throw new Error(`${SCHEMA_PACKAGE} ${version} is not on npm`);
}

export function pinnedVersion(lockfile) {
    const version = lockfile.packages?.[`node_modules/${SCHEMA_PACKAGE}`]?.version;
    if (!version) {
        throw new Error(`package-lock.json has no node_modules/${SCHEMA_PACKAGE} entry`);
    }
    return version;
}

export function issueTitle(version) {
    return `Tools fail with ${SCHEMA_PACKAGE} ${version}`;
}

export function findIssue(issues, version) {
    return issues.find(issue => issue.title === issueTitle(version));
}

/**
 * Only scheduled runs skip. A dispatch always runs. Any issue for the version, open or closed,
 * stops a scheduled run, so that a closed issue does not come back the next day.
 */
export function skipReason({ eventName, version, pinned, issue, passed }) {
    if (eventName !== 'schedule') {
        return undefined;
    }
    if (version === pinned) {
        return `${version} is the pinned version`;
    }
    if (issue) {
        return `issue #${issue.number} exists for ${version}`;
    }
    if (passed) {
        return `${version} passed in an earlier run`;
    }
    return undefined;
}

// --package-lock-only, then npm ci: installing over an existing node_modules can prune other
// platforms' optional packages from the lockfile that the update PR commits.
export function useVersionArgs(version) {
    const { alias } = parseVersion(version);
    return [
        'install',
        '-D',
        '-E',
        '--package-lock-only',
        `${SCHEMA_PACKAGE}@${version}`,
        `${alias}@npm:${SCHEMA_PACKAGE}@${version}`,
    ];
}

export function toolResults(jobs) {
    return Object.keys(TOOLS).map(tool => {
        // The matrix job name is the tool id. A re-run adds a job with a higher run_attempt.
        const [job] = jobs
            .filter(candidate => candidate.name === tool)
            .sort((a, b) => b.run_attempt - a.run_attempt);
        return { tool, conclusion: job?.conclusion ?? 'no result', url: job?.html_url };
    });
}

function resultsTable(failed, runUrl) {
    const rows = failed.map(({ tool, conclusion, url }) => `| ${tool} | ${conclusion} | [Log](${url ?? runUrl}) |`);
    return ['| Tool | Result | Log |', '|---|---|---|', ...rows].join('\n');
}

function reproduceSection(version, failed) {
    const { alias, release } = parseVersion(version);
    const tools = failed.map(({ tool }) => {
        const { directory, commands, note } = TOOLS[tool];
        const where = directory ? ` (in \`${directory}\`)` : '';
        return [
            `**${tool}**${where}:`,
            '',
            '```bash',
            ...commands,
            '```',
            ...(note ? ['', note] : []),
        ].join('\n');
    });
    return [
        '## Reproduce',
        '',
        'At the repository root, with the Node version in `.nvmrc`:',
        '',
        '```bash',
        `npm ${useVersionArgs(version).join(' ')}`,
        'npm ci',
        '```',
        '',
        'Then run the commands of each tool that fails.',
        '',
        ...tools.flatMap(text => [text, '']),
        '## Fix',
        '',
        `The PR that moves \`${SCHEMA_PACKAGE}\` to ${version} (the Renovate PR or your own) must:`,
        '',
        '- Fix the tools that fail.',
        `- Pin \`${SCHEMA_PACKAGE}\` and the \`${alias}\` alias to ${version}. The \`npm install\` command above does both.`,
        ...(failed.some(({ tool }) => tool === 'calm-hub')
            ? [`- If ${release} is a new release, add it to the calm-hub \`versions.txt\` and \`files.txt\` (see \`calm-hub/AGENTS.md\`).`]
            : []),
        `- Say \`Closes #${ISSUE_NUMBER_PLACEHOLDER}\` in its description, so that the merge closes this issue.`,
        '',
        `To test a fix before the merge, run this workflow manually with version ${version}. ` +
            'It closes this issue when all tools pass.',
    ].join('\n');
}

/**
 * Decides what to do with the issue for this version.
 * action: "create" or "comment" when a tool fails, "close" or "none" when all tools pass.
 */
export function planReport({ version, jobs, openIssue, runUrl }) {
    const failed = toolResults(jobs).filter(({ conclusion }) => conclusion !== 'success');
    const run = `[schema compatibility workflow](${runUrl})`;

    if (failed.length > 0) {
        const intro = `The ${run} tested the tools against \`${SCHEMA_PACKAGE}\` ${version}. These tools fail:`;
        const results = [intro, '', resultsTable(failed, runUrl)].join('\n');
        if (openIssue) {
            return { action: 'comment', issue: openIssue.number, passed: false, body: results };
        }
        const body = [results, '', reproduceSection(version, failed)].join('\n');
        return { action: 'create', title: issueTitle(version), passed: false, body };
    }

    if (openIssue) {
        const body = `All tools pass with \`${SCHEMA_PACKAGE}\` ${version} in the ${run}.`;
        return { action: 'close', issue: openIssue.number, passed: true, body };
    }
    return { action: 'none', passed: true, body: '' };
}

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

function setOutputs(outputs) {
    const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value ?? ''}\n`).join('');
    if (process.env.GITHUB_OUTPUT) {
        appendFileSync(process.env.GITHUB_OUTPUT, lines);
    } else {
        process.stdout.write(lines);
    }
}

function run(command, args, options = {}) {
    const result = spawnSync(command, args, { stdio: 'inherit', ...options });
    if (result.status !== 0) {
        throw new Error(`${[command, ...args].join(' ')} failed with exit code ${result.status}`);
    }
}

function npmView(spec) {
    const result = spawnSync('npm', ['view', spec, 'version'], { encoding: 'utf8' });
    if (result.status !== 0) {
        throw new Error(`npm view ${spec} version failed: ${result.stderr}`);
    }
    return result.stdout.trim();
}

function npmPublishedVersion(version) {
    try {
        return npmView(`${SCHEMA_PACKAGE}@${version}`);
    } catch {
        return undefined;
    }
}

const commands = {
    async resolve() {
        const { EVENT_NAME, PAYLOAD_VERSION, INPUT_VERSION } = process.env;
        const requested = requestedVersion({
            eventName: EVENT_NAME,
            payloadVersion: PAYLOAD_VERSION,
            inputVersion: INPUT_VERSION,
        });
        const { version } = parseVersion(requested ?? npmView(SCHEMA_PACKAGE));
        await confirmPublished(version, { eventName: EVENT_NAME, lookup: npmPublishedVersion });
        const pinned = pinnedVersion(readJson(join(REPO_ROOT, 'package-lock.json')));
        console.error(`Testing ${SCHEMA_PACKAGE} ${version}. The pinned version is ${pinned}.`);
        setOutputs({ version, pinned });
    },

    decide() {
        const { EVENT_NAME, VERSION, PINNED, PASSED, ISSUES_FILE } = process.env;
        const issues = ISSUES_FILE && existsSync(ISSUES_FILE) ? readJson(ISSUES_FILE) : [];
        const reason = skipReason({
            eventName: EVENT_NAME,
            version: VERSION,
            pinned: PINNED,
            issue: findIssue(issues, VERSION),
            passed: PASSED === 'true',
        });
        if (reason) {
            console.log(`::notice::Skipped: ${reason}.`);
        }
        setOutputs({ skip: Boolean(reason) });
    },

    use(version) {
        run('npm', useVersionArgs(version), { cwd: REPO_ROOT });
        run('npm', ['ci'], { cwd: REPO_ROOT });
    },

    test(tool) {
        if (!Object.hasOwn(TOOLS, tool ?? '')) {
            throw new Error(`unknown tool ${JSON.stringify(tool)}. Known tools: ${Object.keys(TOOLS).join(', ')}`);
        }
        const { directory, commands: toolCommands } = TOOLS[tool];
        const cwd = join(REPO_ROOT, directory ?? '');
        for (const command of toolCommands) {
            console.log(`\n$ ${command}`);
            run(command, [], { cwd, shell: true });
        }
    },

    report() {
        const { VERSION, RUN_URL, JOBS_FILE, ISSUES_FILE, BODY_FILE } = process.env;
        const { version } = parseVersion(VERSION);
        // gh api --paginate --slurp writes an array of pages.
        const jobs = readJson(JOBS_FILE).flatMap(page => page.jobs);
        const openIssue = findIssue(readJson(ISSUES_FILE), version);
        const plan = planReport({ version, jobs, openIssue, runUrl: RUN_URL });
        writeFileSync(BODY_FILE, plan.body);
        console.error(`Action: ${plan.action}`);
        setOutputs({
            action: plan.action,
            issue: plan.issue,
            title: plan.title,
            passed: plan.passed,
            placeholder: ISSUE_NUMBER_PLACEHOLDER,
        });
    },
};

// realpath because argv[1] keeps symlinks but import.meta.url does not.
const isMain = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    const [name, ...args] = process.argv.slice(2);
    if (!Object.hasOwn(commands, name ?? '')) {
        console.error(`Usage: node scripts/calm-schema-compat.mjs <${Object.keys(commands).join('|')}>`);
        process.exit(1);
    }
    try {
        await commands[name](...args);
    } catch (err) {
        console.error(`calm-schema-compat ${name}: ${err.message}`);
        process.exit(1);
    }
}
