// The changelog rules shared by the CLI, CALM Server and VS Code extension changelogs.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import createPreset from 'conventional-changelog-conventionalcommits';

const REPOSITORY_URL = 'https://github.com/finos/architecture-as-code';

export const SECTIONS = [
    { type: 'feat', section: '🚀 Features' },
    { type: 'fix', section: '🐛 Bug Fixes' },
    { type: 'perf', section: '⚡ Performance Improvements' },
    { type: 'revert', section: '⏪ Reverts' },
    { type: 'docs', section: '📚 Documentation' },
    { type: 'refactor', section: '♻️ Code Refactoring' },
];

// Unscoped changes of other types are repo-wide, e.g. docs for the whole monorepo.
const UNSCOPED_RELEASE_TYPES = ['feat', 'fix', 'perf', 'revert'];

// GitHub puts the PR title on the line after "Merge pull request #N from ...", so the parser reads the title as the header.
export const parserOpts = {
    noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES'],
    mergePattern: /^Merge pull request #(\d+) from (\S+)$/,
    mergeCorrespondence: ['id', 'source'],
};

const conventionalHeader = /^\w+(\([^)]*\))?!?: /;

export function gitIn(cwd) {
    return (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024 }).trim();
}

function lines(output) {
    return output ? output.split('\n') : [];
}

/**
 * The commits that a changelog lists, optionally only those that changed `paths`. Each PR reaches
 * main as one merge or squash commit, and its own commits would repeat it. PR titles are not
 * linted, so a PR whose title is not a conventional commit is listed by its branch commits.
 */
export function listedCommits(git, range, paths = []) {
    const hashes = [];
    for (const entry of git('log', '--first-parent', '--format=%H %P%x00%B%x01', range, '--', ...paths).split('\x01')) {
        const [refs, message = ''] = entry.trim().split('\x00');
        if (!refs) {
            continue;
        }
        const [hash, mainParent, branchParent] = refs.split(' ');
        const title = message.split('\n').filter(Boolean)[1] ?? '';
        hashes.push(hash);
        if (branchParent && !conventionalHeader.test(title)) {
            hashes.push(...lines(git('rev-list', `${mainParent}..${branchParent}`, '--', ...paths)));
        }
    }
    return hashes;
}

let listedOnMain;

/** The commits that a semantic-release changelog lists. Reading the merge history takes about 2s. */
export function listedCommitsOnMain() {
    listedOnMain ??= new Set(listedCommits(gitIn(process.cwd()), 'HEAD'));
    return listedOnMain;
}

export function isRepoWide(commit) {
    return !commit.scope && !UNSCOPED_RELEASE_TYPES.includes(commit.type);
}

/** Give a commit to the preset's transform: link the PR and drop references that are not issues. */
export function withPrLink(commit) {
    return {
        ...commit,
        subject: commit.merge && commit.subject ? `${commit.subject} (#${commit.id})` : commit.subject,
        // PR descriptions mention many issues, and the parser reads hex colours as issue numbers.
        references: commit.references.filter(ref => ref.action && /^\d+$/.test(ref.issue)),
    };
}

// A PR's branch can hold the same change twice, e.g. a commit and the squash of a nested PR.
// Separate PRs can share a subject, so never drop an entry that links its PR.
export function finalizeContext(context) {
    const prLink = / \(\[#\d+\]\([^)]*\)\)$/;
    const key = commit => `${commit.scope}:${(commit.subject ?? '').replace(prLink, '')}`;
    for (const group of context.commitGroups) {
        const linked = group.commits.filter(commit => prLink.test(commit.subject ?? ''));
        const seen = new Set(linked.map(key));
        group.commits = group.commits.filter(commit => {
            if (linked.includes(commit)) {
                return true;
            }
            if (seen.has(key(commit))) {
                return false;
            }
            seen.add(key(commit));
            return true;
        });
    }
    return context;
}

const SCOPED_RELEASE_TYPES = {
    feat: 'minor',
    fix: 'patch',
    perf: 'patch',
    revert: 'patch',
    docs: 'patch',
    chore: false,
    refactor: 'patch',
    test: false,
    style: false,
    ci: false,
};

export function releaseRules(scopes) {
    return [
        ...scopes.flatMap(scope =>
            Object.entries(SCOPED_RELEASE_TYPES).map(([type, release]) => ({ type, scope, release }))
        ),
        // A commit that matches no rule falls back to the analyzer's default rules, so other scopes need a rule.
        { scope: `!(${scopes.join('|')})`, release: false },
        // The analyzer takes the highest matching rule, so these must not match other scopes.
        ...UNSCOPED_RELEASE_TYPES.map(type => ({ type, scope: null, release: SCOPED_RELEASE_TYPES[type] })),
        // A `git revert` commit has no type or scope, so without this the default rules release a patch for a
        // revert of any package. Give the PR a `revert(<scope>):` title to release a revert.
        { revert: true, release: false },
    ];
}

/**
 * A semantic-release config that releases on `scopes` and on unscoped release types. The release
 * notes list each PR once, and the analyzer reads only the commits that the notes list, so a PR
 * with a conventional title is released on its title alone.
 */
export function releaseConfig({ product, tagFormat, scopes }) {
    const presetConfig = { scope: scopes, types: SECTIONS };
    const presetTransform = createPreset(presetConfig).writer.transform;

    function transform(commit, context) {
        if (commit.notes.length === 0 && (!listedCommitsOnMain().has(commit.hash) || isRepoWide(commit))) {
            return undefined;
        }
        return presetTransform(withPrLink(commit), context);
    }

    return {
        branches: ['main'],
        repositoryUrl: REPOSITORY_URL,
        tagFormat,
        ci: true,
        plugins: [
            [fileURLToPath(new URL('./release-analyzer.mjs', import.meta.url)), { preset: 'conventionalcommits', releaseRules: releaseRules(scopes), parserOpts }],
            ['@semantic-release/release-notes-generator', {
                preset: 'conventionalcommits',
                presetConfig,
                parserOpts,
                writerOpts: { transform, finalizeContext },
            }],
            ['@semantic-release/changelog', {
                changelogFile: 'CHANGELOG.md',
                changelogTitle: `# Changelog\n\nAll notable changes to the ${product} will be documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),\nand this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).`,
            }],
            ['@semantic-release/npm', { npmPublish: false }],
        ],
    };
}
