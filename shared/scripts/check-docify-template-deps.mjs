// Checks that npm can resolve the dependencies of the docusaurus template bundle. Without it, a peer dependency
// conflict shows only when a user installs a generated site. It reads the npm registry, so it is not part of
// `npm test`: .github/workflows/validate-docify-template-deps.yml runs it.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const templatePackageJson = path.resolve(scriptDir, '../src/docify/template-bundles/docusaurus/package.json');

// Outside the repository, as a generated site is, so that the root package.json and .npmrc do not apply.
const siteDir = mkdtempSync(path.join(tmpdir(), 'calm-docusaurus-'));
try {
    copyFileSync(templatePackageJson, path.join(siteDir, 'package.json'));
    const { status, error } = spawnSync('npm', ['install', '--package-lock-only'], {
        cwd: siteDir,
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });
    if (error) throw error;
    if (status !== 0) {
        console.error(`npm cannot resolve the dependencies of ${path.relative(process.cwd(), templatePackageJson)}`);
        process.exitCode = 1;
    }
} finally {
    rmSync(siteDir, { recursive: true, force: true });
}
