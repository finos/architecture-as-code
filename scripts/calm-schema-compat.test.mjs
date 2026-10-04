import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    confirmPublished,
    DISPATCH_LOOKUP_ATTEMPTS,
    findIssue,
    issueTitle,
    LOOKUP_RETRY_MS,
    parseVersion,
    pinnedVersion,
    planReport,
    requestedVersion,
    skipReason,
    toolResults,
    TOOLS,
    useVersionArgs,
} from './calm-schema-compat.mjs';

const SCRIPT = fileURLToPath(new URL('./calm-schema-compat.mjs', import.meta.url));
const WORKFLOWS = fileURLToPath(new URL('../.github/workflows/', import.meta.url));
const RUN_URL = 'https://github.com/finos/architecture-as-code/actions/runs/1';

function jobs(conclusions = {}) {
    return Object.keys(TOOLS).map(name => ({
        name,
        conclusion: conclusions[name] ?? 'success',
        html_url: `${RUN_URL}/job/${name}`,
        run_attempt: 1,
    }));
}

describe('parseVersion', () => {
    it('returns the release and the alias name', () => {
        assert.deepEqual(parseVersion('1.3.0'), { version: '1.3.0', release: '1.3', alias: 'calm-schema-1.3' });
        assert.deepEqual(parseVersion('10.20.30'), {
            version: '10.20.30',
            release: '10.20',
            alias: 'calm-schema-10.20',
        });
    });

    for (const value of ['', undefined, 'latest', '1.3', '1.3.0-rc.1', 'v1.3.0', ' 1.3.0', '1.3.0\n::warning::x', '1.3.0; rm -rf /']) {
        it(`rejects ${JSON.stringify(value)}`, () => {
            assert.throws(() => parseVersion(value), /is not <major>\.<minor>\.<patch>/);
        });
    }

    it('quotes the value so that a newline cannot start a workflow command', () => {
        assert.throws(() => parseVersion('1\n::error::x'), err => !err.message.includes('\n'));
    });
});

describe('requestedVersion', () => {
    it('uses the repository_dispatch payload', () => {
        assert.equal(requestedVersion({ eventName: 'repository_dispatch', payloadVersion: '1.3.0' }), '1.3.0');
    });

    it('fails when the repository_dispatch payload has no version', () => {
        assert.throws(() => requestedVersion({ eventName: 'repository_dispatch' }), /needs client_payload\.version/);
    });

    it('uses the workflow_dispatch input', () => {
        assert.equal(requestedVersion({ eventName: 'workflow_dispatch', inputVersion: '1.1.0' }), '1.1.0');
    });

    it('uses the npm latest version for an empty workflow_dispatch input', () => {
        assert.equal(requestedVersion({ eventName: 'workflow_dispatch', inputVersion: '' }), undefined);
    });

    it('uses the npm latest version on schedule, and ignores other values', () => {
        assert.equal(requestedVersion({ eventName: 'schedule', payloadVersion: '9.9.9', inputVersion: '9.9.9' }), undefined);
    });

    it('fails for other events', () => {
        assert.throws(() => requestedVersion({ eventName: 'push' }), /unsupported event "push"/);
    });
});

describe('confirmPublished', () => {
    function fakeNpm(answers) {
        const calls = { lookups: [], waits: [] };
        const options = {
            lookup: version => {
                calls.lookups.push(version);
                return answers.length > 1 ? answers.shift() : answers[0];
            },
            wait: ms => {
                calls.waits.push(ms);
            },
            log: () => {},
        };
        return { calls, options };
    }

    it('returns when npm has the version', async () => {
        const { calls, options } = fakeNpm(['1.3.0']);

        await confirmPublished('1.3.0', { eventName: 'schedule', ...options });

        assert.deepEqual(calls, { lookups: ['1.3.0'], waits: [] });
    });

    it('retries a dispatch until npm has the version', async () => {
        const { calls, options } = fakeNpm([undefined, undefined, '1.3.0']);

        await confirmPublished('1.3.0', { eventName: 'repository_dispatch', ...options });

        assert.equal(calls.lookups.length, 3);
        assert.deepEqual(calls.waits, [LOOKUP_RETRY_MS, LOOKUP_RETRY_MS]);
    });

    it('fails a dispatch when npm never has the version', async () => {
        const { calls, options } = fakeNpm([undefined]);

        await assert.rejects(
            confirmPublished('1.3.0', { eventName: 'repository_dispatch', ...options }),
            /@finos\/calm-schema 1\.3\.0 is not on npm/,
        );
        assert.equal(calls.lookups.length, DISPATCH_LOOKUP_ATTEMPTS);
        assert.equal(calls.waits.length, DISPATCH_LOOKUP_ATTEMPTS - 1);
    });

    for (const eventName of ['schedule', 'workflow_dispatch']) {
        it(`tries once on ${eventName}`, async () => {
            const { calls, options } = fakeNpm([undefined, '1.3.0']);

            await assert.rejects(confirmPublished('1.3.0', { eventName, ...options }), /is not on npm/);
            assert.deepEqual(calls, { lookups: ['1.3.0'], waits: [] });
        });
    }

    it('does not accept another version', async () => {
        const { options } = fakeNpm(['1.3.1']);

        await assert.rejects(confirmPublished('1.3.0', { eventName: 'schedule', ...options }), /is not on npm/);
    });
});

describe('pinnedVersion', () => {
    it('reads the installed version from the lockfile', () => {
        const lockfile = { packages: { 'node_modules/@finos/calm-schema': { version: '1.2.0' } } };

        assert.equal(pinnedVersion(lockfile), '1.2.0');
    });

    it('fails when the lockfile has no entry', () => {
        assert.throws(() => pinnedVersion({ packages: {} }), /no node_modules\/@finos\/calm-schema entry/);
    });

    it('reads the repository lockfile', () => {
        const lockfile = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));

        assert.match(pinnedVersion(lockfile), /^\d+\.\d+\.\d+$/);
    });
});

describe('findIssue', () => {
    it('matches the exact title only', () => {
        const issues = [
            { number: 1, title: `${issueTitle('1.3.0')} (old)` },
            { number: 2, title: issueTitle('1.3.10') },
            { number: 3, title: issueTitle('1.3.0') },
        ];

        assert.equal(findIssue(issues, '1.3.0').number, 3);
        assert.equal(findIssue(issues, '1.3.1'), undefined);
    });
});

describe('skipReason', () => {
    const base = { eventName: 'schedule', version: '1.3.0', pinned: '1.2.0', passed: false };

    it('runs a scheduled check for a new version', () => {
        assert.equal(skipReason(base), undefined);
    });

    it('skips a scheduled check for the pinned version', () => {
        assert.equal(skipReason({ ...base, pinned: '1.3.0' }), '1.3.0 is the pinned version');
    });

    for (const state of ['OPEN', 'CLOSED']) {
        it(`skips a scheduled check when an ${state.toLowerCase()} issue exists for the version`, () => {
            assert.equal(skipReason({ ...base, issue: { number: 42, state } }), 'issue #42 exists for 1.3.0');
        });
    }

    it('skips a scheduled check when the version passed before', () => {
        assert.equal(skipReason({ ...base, passed: true }), '1.3.0 passed in an earlier run');
    });

    for (const eventName of ['repository_dispatch', 'workflow_dispatch']) {
        it(`always runs on ${eventName}`, () => {
            assert.equal(
                skipReason({ ...base, eventName, pinned: '1.3.0', issue: { number: 42 }, passed: true }),
                undefined,
            );
        });
    }
});

describe('useVersionArgs', () => {
    it('pins the latest slot and the alias to the same exact version', () => {
        assert.deepEqual(useVersionArgs('1.3.0'), [
            'install',
            '-D',
            '-E',
            '@finos/calm-schema@1.3.0',
            'calm-schema-1.3@npm:@finos/calm-schema@1.3.0',
        ]);
    });

    it('rejects a version that is not <major>.<minor>.<patch>', () => {
        assert.throws(() => useVersionArgs('1.3.0 --ignore-scripts'), /is not <major>\.<minor>\.<patch>/);
    });
});

describe('toolResults', () => {
    it('uses the job of the latest attempt of each tool', () => {
        const results = toolResults([
            { name: 'cli', conclusion: 'success', html_url: 'cli-2', run_attempt: 2 },
            { name: 'shared', conclusion: 'success', html_url: 'shared-1', run_attempt: 1 },
            { name: 'shared', conclusion: 'failure', html_url: 'shared-2', run_attempt: 2 },
            { name: 'cli', conclusion: 'failure', html_url: 'cli-1', run_attempt: 1 },
        ]);

        assert.deepEqual(results.slice(0, 2), [
            { tool: 'cli', conclusion: 'success', url: 'cli-2' },
            { tool: 'shared', conclusion: 'failure', url: 'shared-2' },
        ]);
    });
});

describe('planReport', () => {
    const openIssue = { number: 42, title: issueTitle('1.3.0') };

    it('creates an issue that names each failing tool, links its log and says how to reproduce', () => {
        const plan = planReport({
            version: '1.3.0',
            jobs: jobs({ 'calm-hub': 'failure', 'calm-lab': 'cancelled' }),
            runUrl: RUN_URL,
        });

        assert.equal(plan.action, 'create');
        assert.equal(plan.title, 'Tools fail with @finos/calm-schema 1.3.0');
        assert.equal(plan.passed, false);
        assert.match(plan.body, /\| calm-lab \| cancelled \| \[Log\]\(.*\/job\/calm-lab\) \|/);
        assert.match(plan.body, /\| calm-hub \| failure \| \[Log\]\(.*\/job\/calm-hub\) \|/);
        assert.doesNotMatch(plan.body, /\| cli \|/);
        assert.match(plan.body, /npm install -D -E @finos\/calm-schema@1\.3\.0 calm-schema-1\.3@npm:@finos\/calm-schema@1\.3\.0/);
        assert.match(plan.body, /\*\*calm-hub\*\* \(in `calm-hub`\):\n\n```bash\nmvn -P integration clean verify\n```/);
        assert.match(plan.body, /npm run test --workspace=calm-lab/);
        assert.match(plan.body, /- Pin `@finos\/calm-schema` and the `calm-schema-1\.3` alias to 1\.3\.0\./);
        assert.match(plan.body, /- If 1\.3 is a new release, add it to the calm-hub `versions\.txt` and `files\.txt`/);
        assert.match(plan.body, /- Say `Closes #ISSUE_NUMBER` in its description/);
    });

    it('asks for the calm-hub index files only when calm-hub fails', () => {
        const plan = planReport({ version: '1.3.0', jobs: jobs({ cli: 'failure' }), runUrl: RUN_URL });

        assert.doesNotMatch(plan.body, /versions\.txt/);
        assert.match(plan.body, /Closes #ISSUE_NUMBER/);
    });

    it('reports a tool with no job as failing, with the run link', () => {
        const plan = planReport({
            version: '1.3.0',
            jobs: jobs().filter(({ name }) => name !== 'vscode'),
            runUrl: RUN_URL,
        });

        assert.equal(plan.action, 'create');
        assert.match(plan.body, new RegExp(`\\| vscode \\| no result \\| \\[Log\\]\\(${RUN_URL}\\) \\|`));
    });

    it('comments on the open issue when a tool still fails', () => {
        const plan = planReport({ version: '1.3.0', jobs: jobs({ cli: 'failure' }), openIssue, runUrl: RUN_URL });

        assert.equal(plan.action, 'comment');
        assert.equal(plan.issue, 42);
        assert.equal(plan.passed, false);
        assert.match(plan.body, /\| cli \| failure \|/);
        assert.doesNotMatch(plan.body, /## Reproduce/);
    });

    it('closes the open issue when all tools pass', () => {
        const plan = planReport({ version: '1.3.0', jobs: jobs(), openIssue, runUrl: RUN_URL });

        assert.equal(plan.action, 'close');
        assert.equal(plan.issue, 42);
        assert.equal(plan.passed, true);
        assert.match(plan.body, /All tools pass with `@finos\/calm-schema` 1\.3\.0/);
    });

    it('does nothing to issues when all tools pass and no issue is open', () => {
        assert.deepEqual(planReport({ version: '1.3.0', jobs: jobs(), runUrl: RUN_URL }), {
            action: 'none',
            passed: true,
            body: '',
        });
    });
});

describe('TOOLS', () => {
    for (const [tool, { workflow, commands }] of Object.entries(TOOLS)) {
        it(`${tool} runs the same commands as ${workflow}`, () => {
            const text = readFileSync(join(WORKFLOWS, workflow), 'utf8');
            for (const command of commands) {
                assert.ok(text.includes(command), `${workflow} has no "${command}" step`);
            }
        });
    }

    it('matches the matrix of calm-schema-compatibility.yml', () => {
        const text = readFileSync(join(WORKFLOWS, 'calm-schema-compatibility.yml'), 'utf8');
        const matrix = /^\s+tool: \[(.+)\]$/m.exec(text)?.[1].split(',').map(tool => tool.trim());

        assert.deepEqual(matrix, Object.keys(TOOLS));
    });
});

describe('calm-schema-compat.mjs', () => {
    let dir;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'calm-schema-compat-'));
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    function runScript(args, env) {
        return spawnSync(process.execPath, [SCRIPT, ...args], {
            encoding: 'utf8',
            env: { ...process.env, GITHUB_OUTPUT: '', ...env },
        });
    }

    // Puts an npm on PATH whose "npm view" knows 1.1.0, 1.2.0 and latest 1.2.0 only.
    function pathWithFakeNpm() {
        const bin = join(dir, 'bin');
        mkdirSync(bin);
        writeFileSync(
            join(bin, 'npm'),
            [
                '#!/bin/sh',
                'case "$2" in',
                '  @finos/calm-schema) echo 1.2.0 ;;',
                '  @finos/calm-schema@1.1.0|@finos/calm-schema@1.2.0) echo "${2#@finos/calm-schema@}" ;;',
                '  *) echo "npm error 404" >&2; exit 1 ;;',
                'esac',
            ].join('\n') + '\n',
        );
        chmodSync(join(bin, 'npm'), 0o755);
        return `${bin}:${process.env.PATH}`;
    }

    it('resolves an explicit version and the pinned version', () => {
        const result = runScript(['resolve'], {
            PATH: pathWithFakeNpm(),
            EVENT_NAME: 'workflow_dispatch',
            INPUT_VERSION: '1.1.0',
        });

        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /^version=1\.1\.0\npinned=\d+\.\d+\.\d+\n$/);
    });

    it('resolves the npm latest version on schedule', () => {
        const result = runScript(['resolve'], { PATH: pathWithFakeNpm(), EVENT_NAME: 'schedule' });

        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /^version=1\.2\.0\n/);
    });

    it('fails to resolve a version that is not on npm', () => {
        const result = runScript(['resolve'], {
            PATH: pathWithFakeNpm(),
            EVENT_NAME: 'workflow_dispatch',
            INPUT_VERSION: '9.9.9',
        });

        assert.equal(result.status, 1);
        assert.match(result.stderr, /@finos\/calm-schema 9\.9\.9 is not on npm/);
        assert.equal(result.stdout, '');
    });

    it('fails to resolve an invalid version', () => {
        const result = runScript(['resolve'], { EVENT_NAME: 'repository_dispatch', PAYLOAD_VERSION: '$(id)' });

        assert.equal(result.status, 1);
        assert.match(result.stderr, /version "\$\(id\)" is not <major>\.<minor>\.<patch>/);
    });

    it('decides to skip a scheduled run when a closed issue exists', () => {
        const issuesFile = join(dir, 'issues.json');
        writeFileSync(issuesFile, JSON.stringify([{ number: 7, title: issueTitle('1.3.0'), state: 'CLOSED' }]));

        const result = runScript(['decide'], {
            EVENT_NAME: 'schedule',
            VERSION: '1.3.0',
            PINNED: '1.2.0',
            PASSED: '',
            ISSUES_FILE: issuesFile,
        });

        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /::notice::Skipped: issue #7 exists for 1\.3\.0\./);
        assert.match(result.stdout, /^skip=true$/m);
    });

    it('decides to skip a scheduled run when the pass marker was found', () => {
        const result = runScript(['decide'], {
            EVENT_NAME: 'schedule',
            VERSION: '1.3.0',
            PINNED: '1.2.0',
            PASSED: 'true',
            ISSUES_FILE: join(dir, 'missing.json'),
        });

        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /^skip=true$/m);
    });

    it('decides to run when no issues file was written', () => {
        const result = runScript(['decide'], {
            EVENT_NAME: 'workflow_dispatch',
            VERSION: '1.3.0',
            PINNED: '1.2.0',
            ISSUES_FILE: join(dir, 'missing.json'),
        });

        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout, 'skip=false\n');
    });

    it('writes the report plan and the issue body', () => {
        const jobsFile = join(dir, 'jobs.json');
        const issuesFile = join(dir, 'issues.json');
        const bodyFile = join(dir, 'body.md');
        writeFileSync(jobsFile, JSON.stringify([{ jobs: jobs({ shared: 'failure' }) }]));
        writeFileSync(issuesFile, '[]');

        const result = runScript(['report'], {
            VERSION: '1.3.0',
            RUN_URL,
            JOBS_FILE: jobsFile,
            ISSUES_FILE: issuesFile,
            BODY_FILE: bodyFile,
        });

        assert.equal(result.status, 0, result.stderr);
        assert.equal(
            result.stdout,
            'action=create\nissue=\ntitle=Tools fail with @finos/calm-schema 1.3.0\npassed=false\nplaceholder=ISSUE_NUMBER\n',
        );
        assert.match(readFileSync(bodyFile, 'utf8'), /\| shared \| failure \|/);
    });

    it('fails for an unknown tool', () => {
        const result = runScript(['test', 'nope']);

        assert.equal(result.status, 1);
        assert.match(result.stderr, /unknown tool "nope"/);
    });

    it('prints the usage for an unknown command', () => {
        const result = runScript(['nope']);

        assert.equal(result.status, 1);
        assert.match(result.stderr, /Usage: node scripts\/calm-schema-compat\.mjs <resolve\|decide\|use\|test\|report>/);
    });
});
