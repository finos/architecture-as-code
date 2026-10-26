#!/usr/bin/env node
// Works out the next VS Code extension version from the changes since the last vscode-v* tag.
// Prints `key=value` lines for $GITHUB_OUTPUT. Usage: vscode-release-version.mjs [--force <kind>]
//
// An odd minor version is published as a pre-release, so an automatic bump keeps the parity of the
// minor: a preview gets a patch for each release, and a stable minor bump skips the odd minor. A
// forced release starts the next preview or stable line.

import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitIn } from './release-notes.mjs';
import { compareVersions, EXTENSION_PATH, keep, releaseCommits, TAG_PREFIX } from './vscode-changelog.mjs';

export const FORCED_KINDS = ['patch', 'preview', 'stable', 'major'];
const PATCH_TYPES = new Set(['fix', 'perf', 'revert']);

/** 'major', 'minor', 'patch', or undefined when no listed change releases the extension. */
export function changeLevel(commits) {
    let level;
    for (const commit of commits.filter(keep)) {
        if (commit.notes.length > 0) return 'major';
        if (commit.type === 'feat') level = 'minor';
        else if (PATCH_TYPES.has(commit.type)) level ??= 'patch';
    }
    return level;
}

export function isPreview(version) {
    return Number(version.split('.')[1]) % 2 === 1;
}

export function nextVersion(current, level) {
    const [major, minor, patch] = current.split('.').map(Number);
    if (isPreview(current) || level === 'patch') return `${major}.${minor}.${patch + 1}`;
    if (level === 'major') return `${major + 1}.0.0`;
    return `${major}.${minor + 2}.0`;
}

export function forcedVersion(current, kind) {
    const [major, minor, patch] = current.split('.').map(Number);
    switch (kind) {
        case 'patch':
            return `${major}.${minor}.${patch + 1}`;
        case 'preview':
            return `${major}.${minor + (isPreview(current) ? 2 : 1)}.0`;
        case 'stable':
            return `${major}.${minor + (isPreview(current) ? 1 : 2)}.0`;
        case 'major':
            return `${major + 1}.0.0`;
        default:
            throw new Error(`Unknown release kind "${kind}". Use one of: ${FORCED_KINDS.join(', ')}.`);
    }
}

export function latestTag(git) {
    return git('tag', '--list', `${TAG_PREFIX}*`)
        .split('\n')
        .map(tag => tag.slice(TAG_PREFIX.length))
        .filter(version => /^\d+\.\d+\.\d+$/.test(version))
        .sort(compareVersions)
        .at(-1);
}

export function planRelease(repoRoot, force) {
    const git = gitIn(repoRoot);
    const tagged = latestTag(git);
    const current = tagged ?? JSON.parse(readFileSync(join(repoRoot, EXTENSION_PATH, 'package.json'), 'utf8')).version;
    if (force) return { current, next: forcedVersion(current, force), level: force };
    const level = changeLevel(releaseCommits(git, tagged && `${TAG_PREFIX}${tagged}`, 'HEAD'));
    return level ? { current, next: nextVersion(current, level), level } : { current };
}

// realpath because argv[1] keeps symlinks but import.meta.url does not.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const forceIndex = process.argv.indexOf('--force');
    const force = forceIndex === -1 ? undefined : process.argv[forceIndex + 1];
    if (forceIndex !== -1 && !FORCED_KINDS.includes(force)) {
        throw new Error(`--force needs a release kind: ${FORCED_KINDS.join(', ')}.`);
    }
    const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    const plan = planRelease(repoRoot, force);
    console.log(`current-version=${plan.current}`);
    console.log(`should-release=${Boolean(plan.next)}`);
    if (plan.next) {
        console.log(`next-version=${plan.next}`);
        console.log(`release-type=${plan.level}`);
        console.log(`pre-release=${isPreview(plan.next)}`);
    }
}
