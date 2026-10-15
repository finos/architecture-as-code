import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { compareVersions, EXTENSION_PATH, generateChangelog, keep } from './vscode-changelog.mjs';

let repo;

function git(...args) {
    return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

function write(path, content) {
    mkdirSync(join(repo, path, '..'), { recursive: true });
    writeFileSync(join(repo, path), content);
}

function setVersion(version) {
    write(`${EXTENSION_PATH}/package.json`, JSON.stringify({ version }));
}

function commit(path, ...messages) {
    write(path, `${Math.random()}`);
    git('add', '-A');
    git('commit', '-q', ...messages.flatMap(m => ['-m', m]));
}

function mergeBranch(branch, title, ...branchMessages) {
    git('checkout', '-q', '-b', branch);
    for (const message of branchMessages) commit(`${EXTENSION_PATH}/src/${branch}.ts`, message);
    git('checkout', '-q', 'main');
    git('merge', '-q', '--no-ff', branch, '-m', `Merge pull request #${branch.length} from me/${branch}`, '-m', title);
}

beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'vscode-changelog-'));
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    git('config', 'commit.gpgsign', 'false');
    git('config', 'tag.gpgsign', 'false');
});

afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
});

describe('compareVersions', () => {
    it('sorts by number, not text', () => {
        assert.deepEqual(['0.0.12', '0.1.0', '0.0.9'].sort(compareVersions), ['0.0.9', '0.0.12', '0.1.0']);
    });
});

describe('keep', () => {
    const parsed = (type, scope, notes = []) => ({ type, scope, notes });

    it('keeps scoped changes and unscoped release types', () => {
        assert.equal(keep(parsed('docs', 'vscode')), true);
        assert.equal(keep(parsed('fix', null)), true);
    });

    it('hides unscoped non-release types, which are repo-wide', () => {
        assert.equal(keep(parsed('docs', null)), false);
        assert.equal(keep(parsed('refactor', null)), false);
    });

    it('hides dependency updates, even with a breaking-change note', () => {
        assert.equal(keep(parsed('fix', 'deps')), false);
        assert.equal(keep(parsed('chore', 'deps-dev', [{ title: 'BREAKING CHANGE', text: 'x' }])), false);
    });
});

describe('generateChangelog', () => {
    beforeEach(() => {
        setVersion('0.1.0');
        commit(`${EXTENSION_PATH}/src/a.ts`, 'feat(vscode): first feature');
        git('tag', '-a', 'vscode-v0.1.0', '-m', '0.1.0');

        commit('cli/src/index.ts', 'feat(cli): change outside the extension');
        commit(`${EXTENSION_PATH}/src/b.ts`, 'fix(deps): update a dependency');
        commit(`${EXTENSION_PATH}/AGENTS.md`, 'docs: repo-wide guide update');
        mergeBranch('free', 'Free text PR title', 'fix(vscode): fix from a free-text PR');
        mergeBranch('conventional', 'feat(vscode): feature from a PR', 'wip', 'more wip');
        setVersion('0.2.0');
        commit(`${EXTENSION_PATH}/README.md`, 'chore(vscode): bump version to 0.2.0');
    });

    it('adds a section for the untagged package.json version, newest first', async () => {
        const changelog = await generateChangelog(repo, '2026-01-02');
        const latest = changelog.indexOf('## [0.2.0](https://github.com/finos/architecture-as-code/compare/vscode-v0.1.0...vscode-v0.2.0) (2026-01-02)');
        const first = changelog.indexOf('## 0.1.0 (');
        assert.ok(latest > 0, changelog);
        assert.ok(first > latest, changelog);
        assert.match(changelog, /first feature/);
    });

    it('lists a conventional PR once, by its title', async () => {
        const changelog = await generateChangelog(repo, '2026-01-02');
        assert.match(changelog, /\*\*vscode:\*\* feature from a PR \(\[#12\]/);
        assert.doesNotMatch(changelog, /wip/);
    });

    it('lists the branch commits of a PR with a free-text title', async () => {
        const changelog = await generateChangelog(repo, '2026-01-02');
        assert.match(changelog, /\*\*vscode:\*\* fix from a free-text PR/);
        assert.doesNotMatch(changelog, /Free text PR title/);
    });

    it('leaves out other paths, dependency updates, repo-wide docs and chores', async () => {
        const changelog = await generateChangelog(repo, '2026-01-02');
        for (const hidden of ['outside the extension', 'update a dependency', 'repo-wide guide', 'bump version']) {
            assert.doesNotMatch(changelog, new RegExp(hidden));
        }
    });

    it('says so when a release has no user-facing changes', async () => {
        git('tag', '-a', 'vscode-v0.2.0', '-m', '0.2.0');
        commit(`${EXTENSION_PATH}/src/c.ts`, 'test(vscode): add a test');
        git('tag', '-a', 'vscode-v0.2.1', '-m', '0.2.1');
        setVersion('0.2.1');
        const changelog = await generateChangelog(repo, '2026-01-02');
        assert.match(changelog, /vscode-v0\.2\.0\.\.\.vscode-v0\.2\.1\) \(\d{4}-\d{2}-\d{2}\)\n\n\* No user-facing changes to the extension\./);
    });
});
