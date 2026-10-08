import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const FIX_SCRIPT = fileURLToPath(new URL('./osv-fix-npm.sh', import.meta.url));
const THRESHOLD_SCRIPT = fileURLToPath(new URL('./osv-threshold.sh', import.meta.url));

let root;
let npmArgsFile;

beforeEach(() => {
    // realpath: the scripts strip $PWD from source paths, and macOS tmpdir is a symlink.
    root = realpathSync(mkdtempSync(join(tmpdir(), 'osv-fix-npm-')));
    npmArgsFile = join(root, 'npm-args.txt');
    // A stub npm on PATH records its arguments instead of touching the network.
    const stubNpm = join(root, 'npm');
    writeFileSync(stubNpm, '#!/usr/bin/env bash\nprintf \'%s\\n\' "$@" > "$NPM_ARGS_FILE"\n');
    chmodSync(stubNpm, 0o755);
});

afterEach(() => {
    rmSync(root, { recursive: true, force: true });
});

function finding(source, ecosystem, name, version, id, { cvss, ghsa } = {}) {
    return {
        source: { path: join(root, source), type: 'lockfile' },
        packages: [
            {
                package: { name, version, ecosystem },
                vulnerabilities: [{ id, ...(ghsa ? { database_specific: { severity: ghsa } } : {}) }],
                groups: [{ ids: [id], ...(cvss ? { max_severity: cvss } : {}) }],
            },
        ],
    };
}

function writeResults(results) {
    const path = join(root, 'osv-results.json');
    writeFileSync(path, JSON.stringify({ results }));
    return path;
}

function run(script, results) {
    return spawnSync('bash', [script, results, '5'], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, PATH: `${root}:${process.env.PATH}`, NPM_ARGS_FILE: npmArgsFile },
    });
}

const npmArgs = () => (existsSync(npmArgsFile) ? readFileSync(npmArgsFile, 'utf8').trim().split('\n') : null);

describe('osv-fix-npm.sh', () => {
    it('updates only the blocking npm packages from package-lock.json, once each', () => {
        const results = writeResults([
            finding('package-lock.json', 'npm', 'next', '15.5.25', 'GHSA-4jqv-mc3x-m676', { cvss: '6.3', ghsa: 'MODERATE' }),
            finding('package-lock.json', 'npm', 'next', '15.5.25', 'GHSA-mcj8-r9mp-w47p', { cvss: '6.3', ghsa: 'MODERATE' }),
            finding('package-lock.json', 'npm', 'katex', '0.16.47', 'GHSA-238p-pmpm-9mq7', { cvss: '2.1', ghsa: 'LOW' }),
            finding('calm-studio/apps/studio/src-tauri/Cargo.lock', 'crates.io', 'anyhow', '1.0.102', 'RUSTSEC-2026-0190', { cvss: '7.5' }),
        ]);

        const result = run(FIX_SCRIPT, results);

        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(npmArgs(), ['update', 'next', '--package-lock-only', '--no-audit', '--no-fund']);
    });

    it('treats an unscored MODERATE advisory as blocking', () => {
        const results = writeResults([
            finding('package-lock.json', 'npm', 'undici', '6.28.0', 'GHSA-3wwx-pv8p-q78v', { ghsa: 'MODERATE' }),
        ]);

        const result = run(FIX_SCRIPT, results);

        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(npmArgs(), ['update', 'undici', '--package-lock-only', '--no-audit', '--no-fund']);
    });

    it('does not run npm when nothing in package-lock.json is blocking', () => {
        const results = writeResults([
            finding('package-lock.json', 'npm', 'katex', '0.16.47', 'GHSA-238p-pmpm-9mq7', { cvss: '2.1', ghsa: 'LOW' }),
            finding('calm-hub/pom.xml', 'Maven', 'io.netty:netty-codec', '4.1.0', 'GHSA-xxxx-yyyy-zzzz', { cvss: '9.8' }),
        ]);

        const result = run(FIX_SCRIPT, results);

        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /No blocking npm finding/);
        assert.equal(npmArgs(), null);
    });
});

describe('osv-threshold.sh', () => {
    it('fails on a blocking finding and reports it', () => {
        const results = writeResults([
            finding('package-lock.json', 'npm', 'next', '15.5.25', 'GHSA-4jqv-mc3x-m676', { cvss: '6.3', ghsa: 'MODERATE' }),
            finding('package-lock.json', 'npm', 'katex', '0.16.47', 'GHSA-238p-pmpm-9mq7', { cvss: '2.1', ghsa: 'LOW' }),
        ]);

        const result = run(THRESHOLD_SCRIPT, results);

        assert.equal(result.status, 1);
        assert.match(result.stdout, /Findings: 2 total, 1 at or above CVSS 5\./);
        assert.match(result.stdout, /❌ next@15\.5\.25 \[package-lock\.json\] GHSA-4jqv-mc3x-m676 cvss=6\.3 MODERATE/);
    });

    it('passes when every finding is below the threshold or unscored', () => {
        const results = writeResults([
            finding('package-lock.json', 'npm', 'katex', '0.16.47', 'GHSA-238p-pmpm-9mq7', { cvss: '2.1', ghsa: 'LOW' }),
            finding('calm-studio/apps/studio/src-tauri/Cargo.lock', 'crates.io', 'anyhow', '1.0.102', 'RUSTSEC-2026-0190'),
        ]);

        const result = run(THRESHOLD_SCRIPT, results);

        assert.equal(result.status, 0, result.stdout);
        assert.match(result.stdout, /Findings: 2 total, 0 at or above CVSS 5\./);
    });
});
