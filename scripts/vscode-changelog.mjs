#!/usr/bin/env node
// Writes calm-plugins/vscode/CHANGELOG.md from the vscode-v* tags, in the CLI changelog format.
// Run it in the version-bump PR: a package.json version with no tag yet gets a section for the
// changes since the last tag. The whole file is generated again each time, so do not edit it.
//
// The extension is released by hand, so this does not use semantic-release. A change belongs to
// a release when it touched calm-plugins/vscode: the extension's history uses many scope spellings,
// and PRs for other packages also change it.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import createPreset from 'conventional-changelog-conventionalcommits';
import { CommitParser } from 'conventional-commits-parser';
import { writeChangelogString } from 'conventional-changelog-writer';
import { finalizeContext, gitIn, isRepoWide, listedCommits, parserOpts, SECTIONS, withPrLink } from './release-notes.mjs';

export const EXTENSION_PATH = 'calm-plugins/vscode';
export const TAG_PREFIX = 'vscode-v';
const REPOSITORY = { host: 'https://github.com', owner: 'finos', repository: 'architecture-as-code' };
const HIDDEN_SCOPES = new Set(['deps', 'deps-dev']);
const NO_CHANGES = '* No user-facing changes to the extension.';

const TITLE = '# Changelog\n\nAll notable changes to the CALM VS Code extension will be documented in this file.\n\n'
    + 'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),\n'
    + 'and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n'
    + 'Odd minor versions (e.g. 0.9.x) are published as pre-releases.';

export function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pa[i] - pb[i];
    }
    return 0;
}

function lines(output) {
    return output ? output.split('\n') : [];
}

/** Releases oldest first: one per tag, then the package.json version if it has no tag yet. */
export function listReleases(git, packageVersion, today) {
    const tagged = lines(git('tag', '--list', `${TAG_PREFIX}*`))
        .map(tag => tag.slice(TAG_PREFIX.length))
        .filter(version => /^\d+\.\d+\.\d+$/.test(version))
        .sort(compareVersions)
        .map(version => {
            const ref = `${TAG_PREFIX}${version}`;
            return { version, ref, date: git('log', '-1', '--format=%cs', `${ref}^{commit}`) };
        });
    if (packageVersion && !tagged.some(release => release.version === packageVersion)) {
        tagged.push({ version: packageVersion, ref: 'HEAD', date: today });
    }
    return tagged;
}

/** The commits of one release that changed the extension. */
export function releaseCommits(git, from, to) {
    const parser = new CommitParser(parserOpts);
    return listedCommits(git, from ? `${from}..${to}` : to, [EXTENSION_PATH])
        .map(hash => ({ ...parser.parse(git('log', '-1', '--format=%B', hash)), hash }));
}

// Dependency updates stay hidden even with a breaking-change note: those notes are about the dependency.
export function keep(commit) {
    if (HIDDEN_SCOPES.has(commit.scope)) return false;
    return !isRepoWide(commit) || commit.notes.length > 0;
}

/** Markdown for one release, in the CLI changelog format. */
export async function renderRelease(release, previous, commits) {
    const preset = await createPreset({ types: SECTIONS });
    const presetTransform = preset.writer.transform;
    const transform = (commit, context) => keep(commit) ? presetTransform(withPrLink(commit), context) : undefined;
    const context = {
        ...REPOSITORY,
        version: release.version,
        date: release.date,
        previousTag: previous?.ref === undefined ? undefined : `${TAG_PREFIX}${previous.version}`,
        currentTag: `${TAG_PREFIX}${release.version}`,
        linkCompare: Boolean(previous),
    };
    const markdown = (await writeChangelogString(commits, context, { ...preset.writer, transform, finalizeContext })).trim();
    return markdown.includes('\n') ? markdown : `${markdown}\n\n${NO_CHANGES}`;
}

export async function generateChangelog(repoRoot, today = new Date().toISOString().slice(0, 10)) {
    const git = gitIn(repoRoot);
    const packageVersion = JSON.parse(readFileSync(join(repoRoot, EXTENSION_PATH, 'package.json'), 'utf8')).version;
    const releases = listReleases(git, packageVersion, today);
    const sections = [];
    for (const [i, release] of releases.entries()) {
        const previous = releases[i - 1];
        sections.push(await renderRelease(release, previous, releaseCommits(git, previous?.ref, release.ref)));
    }
    return `${TITLE}\n\n${sections.reverse().join('\n\n')}\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    const file = join(repoRoot, EXTENSION_PATH, 'CHANGELOG.md');
    writeFileSync(file, await generateChangelog(repoRoot));
    console.log(`Wrote ${file}`);
}
