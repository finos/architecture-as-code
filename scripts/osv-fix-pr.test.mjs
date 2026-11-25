import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const PR_SCRIPT = fileURLToPath(new URL('./osv-fix-pr.sh', import.meta.url));
const FIX_BRANCH = 'osv-fix/npm';
const BOT = 'github-actions[bot]';
const UPDATED_LOCKFILE = '{"lockfile":"updated"}\n';

let root;
let clone;
let ghLog;
let env;

function git(...args) {
    return execFileSync('git', args, { cwd: clone, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function commitAs(author, message) {
    git('-c', `user.name=${author}`, '-c', 'user.email=test@example.com', 'commit', '--quiet', '--all', '--message', message);
}

beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'osv-fix-pr-')));
    clone = root;
    ghLog = join(root, 'gh.log');
    // A stub gh on PATH records its arguments. `pr list` prints the open pull request number.
    const bin = join(root, 'bin');
    mkdirSync(bin);
    writeFileSync(
        join(bin, 'gh'),
        [
            '#!/usr/bin/env bash',
            'echo "$*" >> "$GH_LOG"',
            'case "$1 $2" in',
            '  "pr list") [ -z "$GH_LIST_FAILS" ] || exit 1; [ -z "$GH_OPEN_PR" ] || echo "$GH_OPEN_PR" ;;',
            '  "pr edit") cp "${@: -1}" "$GH_BODY" ;;',
            '  "pr create") echo "https://example.com/pull/1"; while [ "$1" != "--body-file" ]; do shift; done; cp "$2" "$GH_BODY" ;;',
            'esac',
            '',
        ].join('\n')
    );
    chmodSync(join(bin, 'gh'), 0o755);
    env = {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        // Keep the developer's git configuration (signing, hooks) out of the test repositories.
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_NOSYSTEM: '1',
        GH_LOG: ghLog,
        GH_BODY: join(root, 'pr-body.md'),
        GH_OPEN_PR: '',
        GH_LIST_FAILS: '',
        FIX_BRANCH,
        GITHUB_REPOSITORY_OWNER: 'finos',
        GITHUB_STEP_SUMMARY: join(root, 'summary.md'),
    };

    git('init', '--quiet', '--bare', '--initial-branch=main', 'origin.git');
    git('clone', '--quiet', 'origin.git', 'clone');
    clone = join(root, 'clone');
    git('checkout', '--quiet', '-b', 'main');
    writeFileSync(join(clone, 'package-lock.json'), '{"lockfile":"main"}\n');
    git('add', 'package-lock.json');
    commitAs('A Maintainer', 'chore: seed');
    git('push', '--quiet', 'origin', 'main');
    writeFileSync(join(root, 'osv-after.txt'), 'Findings: 1 total, 1 at or above CVSS 5.\n');
});

afterEach(() => {
    rmSync(root, { recursive: true, force: true });
});

// Puts a fix branch on the remote, as an earlier run or a maintainer left it.
function existingFixBranch(lockfile, { maintainerCommit = false } = {}) {
    git('checkout', '--quiet', '-b', FIX_BRANCH);
    writeFileSync(join(clone, 'package-lock.json'), lockfile);
    commitAs(BOT, 'fix(deps): update vulnerable npm packages in package-lock.json');
    if (maintainerCommit) {
        writeFileSync(join(clone, 'pom.xml'), '<project/>\n');
        git('add', 'pom.xml');
        commitAs('A Maintainer', 'fix(calm-hub): update guava');
    }
    git('push', '--quiet', 'origin', FIX_BRANCH);
    git('checkout', '--quiet', 'main');
}

// Runs the script on main with the lockfile that `npm update` produced.
function run(clean, extraEnv = {}) {
    writeFileSync(join(clone, 'package-lock.json'), UPDATED_LOCKFILE);
    return spawnSync('bash', [PR_SCRIPT, clean, join(root, 'osv-after.txt'), 'https://example.com/run/1'], {
        cwd: clone,
        encoding: 'utf8',
        env: { ...env, ...extraEnv },
    });
}

const remoteHead = () => spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${FIX_BRANCH}`], { cwd: join(root, 'origin.git'), encoding: 'utf8', env }).stdout.trim();
const remoteLockfile = () => execFileSync('git', ['show', `${FIX_BRANCH}:package-lock.json`], { cwd: join(root, 'origin.git'), encoding: 'utf8', env });
// The gh calls after the `pr list` lookup.
const ghCalls = () => (existsSync(ghLog) ? readFileSync(ghLog, 'utf8').trim().split('\n').slice(1) : []);
const prBody = () => readFileSync(env.GH_BODY, 'utf8');

describe('osv-fix-pr.sh', () => {
    it('opens a draft pull request when blocking findings remain', () => {
        const result = run('false');

        assert.equal(result.status, 0, result.stderr);
        assert.equal(remoteLockfile(), UPDATED_LOCKFILE);
        const [create, ...others] = ghCalls();
        assert.match(create, /^pr create --base main --head osv-fix\/npm .* --draft$/);
        assert.deepEqual(others, []);
        assert.match(prBody(), /Blocking findings remain after the update, so this pull request is a draft/);
        assert.match(prBody(), /Findings: 1 total, 1 at or above CVSS 5\./);
    });

    it('opens a pull request that is ready for review when the re-scan is clean', () => {
        const result = run('true');

        assert.equal(result.status, 0, result.stderr);
        assert.equal(remoteLockfile(), UPDATED_LOCKFILE);
        const [create] = ghCalls();
        assert.match(create, /^pr create /);
        assert.doesNotMatch(create, /--draft/);
        assert.match(prBody(), /has no blocking findings/);
    });

    it('pushes a new lockfile to the open pull request and marks it ready when the re-scan is clean', () => {
        existingFixBranch('{"lockfile":"earlier fix"}\n');
        const before = remoteHead();

        const result = run('true', { GH_OPEN_PR: '77' });

        assert.equal(result.status, 0, result.stderr);
        assert.notEqual(remoteHead(), before);
        assert.equal(remoteLockfile(), UPDATED_LOCKFILE);
        assert.deepEqual(ghCalls().map((call) => call.replace(/ --title .*/, '')), ['pr edit 77', 'pr ready 77']);
    });

    it('converts the open pull request to a draft when the lockfile is the same but blocking findings remain', () => {
        existingFixBranch(UPDATED_LOCKFILE);
        const before = remoteHead();

        const result = run('false', { GH_OPEN_PR: '77' });

        assert.equal(result.status, 0, result.stderr);
        assert.equal(remoteHead(), before);
        assert.deepEqual(ghCalls().map((call) => call.replace(/ --title .*/, '')), ['pr edit 77', 'pr ready 77 --undo']);
        assert.match(prBody(), /this pull request is a draft/);
    });

    it('does nothing when the fix branch has the same lockfile and no open pull request', () => {
        existingFixBranch(UPDATED_LOCKFILE);
        const before = remoteHead();

        const result = run('false');

        assert.equal(result.status, 0, result.stderr);
        assert.equal(remoteHead(), before);
        assert.deepEqual(ghCalls(), []);
    });

    it('leaves a fix branch with commits by a maintainer as it is', () => {
        existingFixBranch('{"lockfile":"earlier fix"}\n', { maintainerCommit: true });
        const before = remoteHead();

        const result = run('false', { GH_OPEN_PR: '77' });

        assert.equal(result.status, 0, result.stderr);
        assert.equal(remoteHead(), before);
        assert.equal(existsSync(ghLog), false);
        assert.match(result.stdout, /commits by a maintainer/);
    });

    it('fails when the open pull request lookup fails, so a blocked pull request cannot stay ready', () => {
        existingFixBranch(UPDATED_LOCKFILE);

        const result = run('false', { GH_LIST_FAILS: 'yes' });

        assert.notEqual(result.status, 0);
        assert.doesNotMatch(result.stdout, /Nothing to do/);
    });
});
