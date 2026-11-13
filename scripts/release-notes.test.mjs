import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { analyzeCommits } from '@semantic-release/commit-analyzer';

import { analyzeCommits as analyzeListedCommits } from './release-analyzer.mjs';
import { expandForkMerges, finalizeContext, gitIn, isRepoWide, listedCommits, parserOpts, releaseConfig, releaseRules, splitForkMerge, withPrLink } from './release-notes.mjs';
import { generateNotes } from './release-notes-generator.mjs';

const FORK_MERGE = [
    'Merge commit from fork',
    '',
    '* fix(calm-server): never read a local file that a request references',
    '',
    'The loader read any local path.',
    '* this bullet is part of the body',
    '',
    'Co-Authored-By: A <a@example.com>',
    '',
    '* test(shared): refuse a host outside the allowlist',
    '',
    '---------',
    '',
    'Co-authored-by: B <b@example.com>',
].join('\n');

describe('splitForkMerge', () => {
    it('gives the message of each commit that a fork merge holds, without the trailers', () => {
        assert.deepEqual(splitForkMerge(FORK_MERGE), [
            'fix(calm-server): never read a local file that a request references\n\nThe loader read any local path.\n'
                + '* this bullet is part of the body\n\nCo-Authored-By: A <a@example.com>',
            'test(shared): refuse a host outside the allowlist',
        ]);
    });

    it('keeps any other message as it is', () => {
        assert.deepEqual(splitForkMerge('fix(cli): a fix\n\n* fix(shared): a bullet'), ['fix(cli): a fix\n\n* fix(shared): a bullet']);
    });

    it('keeps a fork merge with no conventional commits as it is', () => {
        assert.deepEqual(splitForkMerge('Merge commit from fork\n\n* wip'), ['Merge commit from fork\n\n* wip']);
    });

    it('gives each commit the hash of the fork merge', () => {
        const commits = expandForkMerges([{ hash: 'abc', message: FORK_MERGE }, { hash: 'def', message: 'fix(cli): a fix' }]);
        assert.deepEqual(commits.map(commit => commit.hash), ['abc', 'abc', 'def']);
    });
});

describe('releaseRules', () => {
    const analyze = (...messages) => analyzeCommits(
        { preset: 'conventionalcommits', releaseRules: releaseRules(['calm-server', 'shared']), parserOpts },
        { commits: expandForkMerges(messages.map((message, i) => ({ hash: `${i}`, message }))), logger: { log() {} } },
    );

    it('releases on the commits that a fork merge holds', async () => {
        assert.equal(await analyze(FORK_MERGE), 'patch');
        assert.equal(await analyze(FORK_MERGE.replace('calm-server', 'calm-hub')), null);
    });

    it('releases on the given scopes', async () => {
        assert.equal(await analyze('feat(calm-server): add an endpoint'), 'minor');
        assert.equal(await analyze('docs(shared): fix a typo'), 'patch');
        assert.equal(await analyze('chore(calm-server): tidy up'), null);
    });

    it('does not release on other scopes, even for a feature', async () => {
        assert.equal(await analyze('feat(calm-hub): add an endpoint'), null);
        assert.equal(await analyze('fix(cli): fix a bug'), null);
    });

    it('releases on unscoped release types only', async () => {
        assert.equal(await analyze('fix: fix a bug'), 'patch');
        assert.equal(await analyze('docs: repo-wide docs'), null);
    });

    it('does not release on a plain git revert', async () => {
        assert.equal(await analyze('Revert "feat(calm-server): add an endpoint"\n\nThis reverts commit abc1234.'), null);
    });
});

describe('releaseConfig', () => {
    const plugins = config => config.plugins.map(([name]) => name);

    it('updates package.json by default', () => {
        assert.ok(plugins(releaseConfig({ product: 'P', tagFormat: 'p-v${version}', scopes: ['p'] })).includes('@semantic-release/npm'));
    });

    it('leaves out the npm plugin for a product with no package.json', () => {
        const config = releaseConfig({ product: 'P', tagFormat: 'p-v${version}', scopes: ['p'], npmPackage: false });
        assert.ok(!plugins(config).includes('@semantic-release/npm'));
        assert.ok(plugins(config).includes('@semantic-release/changelog'));
    });

    it('gives the paths to the analyzer', () => {
        const [, analyzerConfig] = releaseConfig({ product: 'P', tagFormat: 'p-v${version}', scopes: ['p'], paths: ['p'] }).plugins[0];
        assert.deepEqual(analyzerConfig.paths, ['p']);
    });
});

describe('generateNotes', () => {
    it('lists each commit that a fork merge holds', async () => {
        const notes = await generateNotes({ preset: 'conventionalcommits' }, {
            commits: [{ hash: 'abc1234', message: FORK_MERGE }],
            lastRelease: {},
            nextRelease: { version: '1.0.0' },
            options: { repositoryUrl: 'https://github.com/finos/architecture-as-code' },
            cwd: process.cwd(),
            logger: { log() {} },
        });
        assert.match(notes, /\*\*calm-server:\*\* never read a local file/);
        assert.doesNotMatch(notes, /Merge commit from fork/);
    });
});

describe('isRepoWide', () => {
    it('is true only for unscoped changes that do not release', () => {
        assert.equal(isRepoWide({ type: 'docs', scope: null }), true);
        assert.equal(isRepoWide({ type: 'fix', scope: null }), false);
        assert.equal(isRepoWide({ type: 'docs', scope: 'cli' }), false);
    });
});

describe('withPrLink', () => {
    it('links the PR of a merge commit and keeps only issue references that an action names', () => {
        const commit = withPrLink({
            merge: 'Merge pull request #12 from me/branch',
            id: '12',
            subject: 'add a feature',
            references: [{ action: 'Closes', issue: '3' }, { action: null, issue: '4' }, { action: 'Closes', issue: 'fff' }],
        });
        assert.equal(commit.subject, 'add a feature (#12)');
        assert.deepEqual(commit.references, [{ action: 'Closes', issue: '3' }]);
    });
});

describe('finalizeContext', () => {
    const entry = (scope, subject) => ({ scope, subject });

    it('drops a repeated entry but keeps PR links and other scopes', () => {
        const linked = 'same ([#1](https://example.com/1))';
        const context = finalizeContext({
            commitGroups: [{ commits: [entry('', 'same'), entry('', linked), entry('', linked), entry('a', 'same'), entry('', 'other'), entry('', 'other')] }],
        });
        assert.deepEqual(context.commitGroups[0].commits, [entry('', linked), entry('', linked), entry('a', 'same'), entry('', 'other')]);
    });
});

describe('listedCommits', () => {
    let repo;
    let git;

    function commit(path, message) {
        mkdirSync(join(repo, path, '..'), { recursive: true });
        writeFileSync(join(repo, path), `${Math.random()}`);
        git('add', '-A');
        git('commit', '-q', '-m', message);
        return git('rev-parse', 'HEAD');
    }

    function mergeBranch(branch, title, ...branchCommits) {
        git('checkout', '-q', '-b', branch);
        const hashes = branchCommits.map(([path, message]) => commit(path, message));
        git('checkout', '-q', 'main');
        git('merge', '-q', '--no-ff', branch, '-m', `Merge pull request #1 from me/${branch}`, '-m', title);
        return { merge: git('rev-parse', 'HEAD'), branch: hashes };
    }

    beforeEach(() => {
        repo = mkdtempSync(join(tmpdir(), 'release-notes-'));
        git = gitIn(repo);
        git('init', '-q', '-b', 'main');
        git('config', 'user.email', 'test@example.com');
        git('config', 'user.name', 'Test');
        git('config', 'commit.gpgsign', 'false');
        commit('README.md', 'chore: initial commit');
    });

    afterEach(() => {
        rmSync(repo, { recursive: true, force: true });
    });

    it('lists a PR with a conventional title by its merge commit only', () => {
        const pr = mergeBranch('conventional', 'feat(cli): a feature', ['cli/a.ts', 'wip']);
        assert.ok(listedCommits(git, 'HEAD').includes(pr.merge));
        assert.ok(!listedCommits(git, 'HEAD').includes(pr.branch[0]));
    });

    it('lists the branch commits of a PR with a free-text title', () => {
        const pr = mergeBranch('free', 'A free-text title', ['cli/a.ts', 'fix(cli): a fix'], ['cli/b.ts', 'feat(cli): a feature']);
        assert.ok(pr.branch.every(hash => listedCommits(git, 'HEAD').includes(hash)));
    });

    it('lists only the commits that changed the given paths', () => {
        const direct = commit('server/a.ts', 'fix(server): a direct fix');
        const other = commit('cli/a.ts', 'fix(cli): another package');
        const pr = mergeBranch('free', 'A free-text title', ['server/b.ts', 'fix(server): a fix'], ['cli/b.ts', 'fix(cli): a fix']);
        const listed = listedCommits(git, 'HEAD', ['server']);
        assert.ok(listed.includes(direct));
        assert.ok(listed.includes(pr.branch[0]));
        assert.ok(!listed.includes(other));
        assert.ok(!listed.includes(pr.branch[1]));
    });

    it('releases only on the commits that changed the given paths', async () => {
        const hub = commit('hub/a.java', 'fix(deps): update a hub dependency');
        const other = commit('cli/a.ts', 'feat(deps): update a CLI dependency');
        const analyze = paths => analyzeListedCommits(
            { preset: 'conventionalcommits', releaseRules: releaseRules(['hub', 'deps']), parserOpts, paths },
            { commits: [hub, other].map(hash => ({ hash, message: git('log', '-1', '--format=%B', hash) })), logger: { log() {} } },
        );
        const cwd = process.cwd();
        process.chdir(repo);
        try {
            assert.equal(await analyze([':(top)hub']), 'patch');
            assert.equal(await analyze([':(top)cli']), 'minor');
        } finally {
            process.chdir(cwd);
        }
    });
});
