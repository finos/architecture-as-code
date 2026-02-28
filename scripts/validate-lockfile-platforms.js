#!/usr/bin/env node

/**
 * Validates that package-lock.json contains platform-specific optional
 * dependencies for all platforms used in CI.
 *
 * npm has a known bug (https://github.com/npm/cli/issues/4828) where running
 * `npm install` with an existing node_modules directory can prune optional
 * platform-specific packages for platforms other than the current machine.
 * This causes CI failures on Linux runners when the lockfile was regenerated
 * on macOS without first deleting node_modules.
 *
 * This script catches the problem early by checking that every package with
 * darwin variants also has corresponding linux-x64 variants.
 */

'use strict';

const { readFileSync } = require('fs');
const { join } = require('path');

const lockfilePath = join(__dirname, '..', 'package-lock.json');

let lockfile;
try {
    lockfile = JSON.parse(readFileSync(lockfilePath, 'utf8'));
} catch (err) {
    console.error(`Failed to read package-lock.json: ${err.message}`);
    process.exit(1);
}

const packages = lockfile.packages || {};

// Collect all platform-specific packages (those with both os and cpu fields)
// and group them by their base package name.
//
// Naming conventions:
//   @esbuild/darwin-arm64         -> base: @esbuild   (os after /)
//   @rollup/rollup-darwin-arm64   -> base: @rollup/rollup  (os after -)
//   @tailwindcss/oxide-darwin-x64 -> base: @tailwindcss/oxide  (os after -)
//   lightningcss-darwin-arm64     -> base: lightningcss  (os after -)
//
// We strip the trailing [-/]<os>-<cpu>[-<abi>] suffix to derive the base name.

const osPattern = 'linux|darwin|win32|android|freebsd|openbsd|netbsd|sunos|aix';
const suffixRegex = new RegExp(`[-/](?:${osPattern})[-/].*$`);

const groups = new Map();

for (const [key, meta] of Object.entries(packages)) {
    if (!meta.os || !meta.cpu) continue;

    // Normalise: strip leading node_modules/ (and nested node_modules/ paths)
    const name = key.replace(/^(.+\/)?node_modules\//, '');

    // The os segment may follow a dash (@rollup/rollup-darwin-arm64) or a
    // slash (@esbuild/darwin-arm64).  The regex handles both separators.
    const base = name.replace(suffixRegex, '');
    if (base === name) continue; // no recognisable platform suffix

    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push({ name, os: meta.os, cpu: meta.cpu });
}

// For every group that contains darwin variants, verify that linux-x64
// variants are also present (our CI runners are linux-x64).

const missing = [];

for (const [base, variants] of groups) {
    const hasDarwin = variants.some(v => v.os.includes('darwin'));
    if (!hasDarwin) continue;

    const hasLinuxX64 = variants.some(
        v => v.os.includes('linux') && v.cpu.includes('x64')
    );

    if (!hasLinuxX64) {
        const darwinNames = variants
            .filter(v => v.os.includes('darwin'))
            .map(v => v.name);
        // Determine the separator used between base and os
        // e.g. @esbuild/darwin-arm64 uses "/" while @rollup/rollup-darwin-arm64 uses "-"
        const sep = darwinNames[0].startsWith(base + '/') ? '/' : '-';
        missing.push({ base, sep, darwinNames });
    }
}

if (missing.length > 0) {
    console.error('Lockfile platform validation failed!\n');
    console.error(
        'The following packages have darwin variants but are missing linux-x64 variants.\n' +
        'This will cause CI failures on Linux runners.\n'
    );
    for (const { base, sep, darwinNames } of missing) {
        console.error(`  ${base}`);
        for (const name of darwinNames) {
            console.error(`    found:   ${name}`);
        }
        console.error(`    missing: ${base}${sep}linux-x64-*\n`);
    }
    console.error(
        'Fix: regenerate the lockfile from a clean state:\n\n' +
        '  rm -rf node_modules package-lock.json && npm install\n'
    );
    process.exit(1);
}

console.log(
    `Lockfile platform check passed: ${groups.size} platform-specific package groups validated.`
);
