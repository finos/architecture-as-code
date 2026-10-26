import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { EXTENSION_PATH } from './vscode-changelog.mjs';
import { changeLevel, forcedVersion, isPreview, nextVersion, planRelease } from './vscode-release-version.mjs';

const BREAKING = [{ title: 'BREAKING CHANGE', text: 'x' }];
const parsed = (type, scope = 'vscode', notes = []) => ({ type, scope, notes });

describe('changeLevel', () => {
    it('takes the largest change', () => {
        assert.equal(changeLevel([parsed('fix')]), 'patch');
        assert.equal(changeLevel([parsed('fix'), parsed('feat'), parsed('perf')]), 'minor');
        assert.equal(changeLevel([parsed('feat'), parsed('refactor', 'vscode', BREAKING)]), 'major');
    });

    it('does not release for other types, repo-wide changes or dependency updates', () => {
        assert.equal(changeLevel([parsed('docs'), parsed('refactor'), parsed('chore')]), undefined);
        assert.equal(changeLevel([parsed('docs', null, BREAKING)]), 'major');
        assert.equal(changeLevel([parsed('chore', null)]), undefined);
        assert.equal(changeLevel([parsed('fix', 'deps'), parsed('feat', 'deps-dev', BREAKING)]), undefined);
    });
});

describe('nextVersion', () => {
    it('gives a preview a patch for any change, so it stays a pre-release', () => {
        for (const level of ['patch', 'minor', 'major']) assert.equal(nextVersion('0.9.1', level), '0.9.2');
    });

    it('keeps a stable minor even', () => {
        assert.equal(nextVersion('1.2.3', 'patch'), '1.2.4');
        assert.equal(nextVersion('1.2.3', 'minor'), '1.4.0');
        assert.equal(nextVersion('1.2.3', 'major'), '2.0.0');
        assert.equal(isPreview(nextVersion('1.2.3', 'minor')), false);
    });
});

describe('forcedVersion', () => {
    it('starts the next preview or stable line', () => {
        assert.equal(forcedVersion('0.9.1', 'patch'), '0.9.2');
        assert.equal(forcedVersion('0.9.1', 'stable'), '0.10.0');
        assert.equal(forcedVersion('0.9.1', 'preview'), '0.11.0');
        assert.equal(forcedVersion('0.10.2', 'preview'), '0.11.0');
        assert.equal(forcedVersion('0.10.2', 'stable'), '0.12.0');
        assert.equal(forcedVersion('0.9.1', 'major'), '1.0.0');
    });

    it('rejects an unknown kind', () => {
        assert.throws(() => forcedVersion('0.9.1', 'minor'), /Unknown release kind "minor"/);
    });
});

describe('planRelease', () => {
    let repo;

    function git(...args) {
        return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
    }

    function commit(path, message) {
        mkdirSync(join(repo, path, '..'), { recursive: true });
        writeFileSync(join(repo, path), `${Math.random()}`);
        git('add', '-A');
        git('commit', '-q', '-m', message);
    }

    beforeEach(() => {
        repo = mkdtempSync(join(tmpdir(), 'vscode-release-version-'));
        git('init', '-q', '-b', 'main');
        git('config', 'user.email', 'test@example.com');
        git('config', 'user.name', 'Test');
        git('config', 'commit.gpgsign', 'false');
        git('config', 'tag.gpgsign', 'false');
        commit(`${EXTENSION_PATH}/package.json`, 'chore(vscode): start');
        writeFileSync(join(repo, EXTENSION_PATH, 'package.json'), JSON.stringify({ version: '0.9.0' }));
        git('commit', '-q', '-am', 'chore(vscode): set the version');
    });

    afterEach(() => {
        rmSync(repo, { recursive: true, force: true });
    });

    it('releases the changes to the extension since the last tag', () => {
        git('tag', '-a', 'vscode-v0.9.0', '-m', '0.9.0');
        commit(`${EXTENSION_PATH}/src/a.ts`, 'feat(vscode): add a feature');
        assert.deepEqual(planRelease(repo), { current: '0.9.0', next: '0.9.1', level: 'minor' });
    });

    it('does not release for changes outside the extension', () => {
        git('tag', '-a', 'vscode-v0.9.0', '-m', '0.9.0');
        commit('cli/src/a.ts', 'feat(cli): add a feature');
        assert.deepEqual(planRelease(repo), { current: '0.9.0' });
    });

    it('takes the current version from the newest tag, not package.json', () => {
        git('tag', '-a', 'vscode-v0.9.0', '-m', '0.9.0');
        commit(`${EXTENSION_PATH}/src/a.ts`, 'fix(vscode): fix a bug');
        git('tag', '-a', 'vscode-v0.9.1', '-m', '0.9.1');
        commit(`${EXTENSION_PATH}/src/b.ts`, 'fix(vscode): fix another bug');
        assert.deepEqual(planRelease(repo), { current: '0.9.1', next: '0.9.2', level: 'patch' });
    });

    it('uses the package.json version when there is no tag', () => {
        commit(`${EXTENSION_PATH}/src/a.ts`, 'fix(vscode): fix a bug');
        assert.deepEqual(planRelease(repo), { current: '0.9.0', next: '0.9.1', level: 'patch' });
    });

    it('releases a forced version with no changes', () => {
        git('tag', '-a', 'vscode-v0.9.0', '-m', '0.9.0');
        assert.deepEqual(planRelease(repo, 'stable'), { current: '0.9.0', next: '0.10.0', level: 'stable' });
    });
});
