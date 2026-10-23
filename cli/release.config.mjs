import { execFileSync } from 'node:child_process';
import createPreset from 'conventional-changelog-conventionalcommits';

const RELEASE_SCOPES = ['cli', 'shared', 'calm-models', 'calm-ai', 'calm-widgets'];

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

const UNSCOPED_RELEASE_TYPES = ['feat', 'fix', 'perf', 'revert'];

const releaseRules = [
    ...RELEASE_SCOPES.flatMap(scope =>
        Object.entries(SCOPED_RELEASE_TYPES).map(([type, release]) => ({ type, scope, release }))
    ),
    // A commit that matches no rule falls back to the analyzer's default rules, so other scopes need a rule.
    { scope: `!(${RELEASE_SCOPES.join('|')})`, release: false },
    // The analyzer takes the highest matching rule, so these must not match other scopes.
    ...UNSCOPED_RELEASE_TYPES.map(type => ({ type, scope: null, release: SCOPED_RELEASE_TYPES[type] })),
    // A `git revert` commit has no type or scope, so without this the default rules release a patch for a
    // revert of any package. Give the PR a `revert(<scope>):` title to release a revert.
    { revert: true, release: false },
];

// GitHub puts the PR title on the line after "Merge pull request #N from ...", so the parser reads the title as the header.
const parserOpts = {
    noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES'],
    mergePattern: /^Merge pull request #(\d+) from (\S+)$/,
    mergeCorrespondence: ['id', 'source'],
};

const presetConfig = {
    scope: RELEASE_SCOPES,
    types: [
        { type: 'feat', section: '🚀 Features' },
        { type: 'fix', section: '🐛 Bug Fixes' },
        { type: 'perf', section: '⚡ Performance Improvements' },
        { type: 'revert', section: '⏪ Reverts' },
        { type: 'docs', section: '📚 Documentation' },
        { type: 'refactor', section: '♻️ Code Refactoring' },
    ],
};

const presetTransform = createPreset(presetConfig).writer.transform;

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024 });

// Each PR reaches main as one merge or squash commit. The PR's own commits would repeat it.
const mainline = new Set(git('rev-list', '--first-parent', 'HEAD').split('\n'));

// PR titles are not linted, so use the branch commits of a PR whose title is not a conventional commit.
// release-analyzer.mjs gives the analyzer only these commits, so the PR title decides the release.
const conventionalHeader = /^\w+(\([^)]*\))?!?: /;
export const listed = new Set(mainline);
for (const merge of git('log', '--first-parent', '--merges', '--format=%H %P%x00%B%x01', 'HEAD').split('\x01')) {
    const [refs, message = ''] = merge.trim().split('\x00');
    const [, mainParent, branchParent] = refs.split(' ');
    const title = message.split('\n').filter(Boolean)[1] ?? '';
    if (branchParent && !conventionalHeader.test(title)) {
        git('rev-list', `${mainParent}..${branchParent}`).split('\n').forEach(branchCommit => listed.add(branchCommit));
    }
}

function transform(commit, context) {
    if (commit.notes.length === 0) {
        if (!listed.has(commit.hash)) {
            return undefined;
        }
        // List only the unscoped changes that trigger a release, so repo-wide docs stay out.
        if (!commit.scope && !UNSCOPED_RELEASE_TYPES.includes(commit.type)) {
            return undefined;
        }
    }
    return presetTransform({
        ...commit,
        subject: commit.merge && commit.subject ? `${commit.subject} (#${commit.id})` : commit.subject,
        // PR descriptions mention many issues, and the parser reads hex colours as issue numbers.
        references: commit.references.filter(ref => ref.action && /^\d+$/.test(ref.issue)),
    }, context);
}

// A PR's branch can hold the same change twice, e.g. a commit and the squash of a nested PR.
// Separate PRs can share a subject, so never drop an entry that links its PR.
function finalizeContext(context) {
    const prLink = / \(\[#\d+\]\([^)]*\)\)$/;
    for (const group of context.commitGroups) {
        const linked = group.commits.filter(commit => prLink.test(commit.subject ?? ''));
        const seen = new Set(linked.map(commit => commit.subject.replace(prLink, '')));
        group.commits = group.commits.filter(commit => {
            if (linked.includes(commit)) {
                return true;
            }
            if (seen.has(commit.subject)) {
                return false;
            }
            seen.add(commit.subject);
            return true;
        });
    }
    return context;
}

export default {
    branches: ['main'],
    repositoryUrl: 'https://github.com/finos/architecture-as-code',
    tagFormat: 'cli-v${version}',
    ci: true,
    plugins: [
        ['./release-analyzer.mjs', { preset: 'conventionalcommits', releaseRules, parserOpts }],
        ['@semantic-release/release-notes-generator', {
            preset: 'conventionalcommits',
            presetConfig,
            parserOpts,
            writerOpts: { transform, finalizeContext },
        }],
        ['@semantic-release/changelog', {
            changelogFile: 'CHANGELOG.md',
            changelogTitle: '# Changelog\n\nAll notable changes to the CALM CLI will be documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),\nand this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).',
        }],
        ['@semantic-release/npm', { npmPublish: false }],
    ],
};
