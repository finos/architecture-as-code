import { describe, it, expect, afterAll } from 'vitest';
import { copyFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';

const TEMPLATE_PACKAGE_JSON = join(__dirname, 'package.json');

// The purpose of this test is to ensure that the docusaurus template bundle's dependencies can be
// resolved. This is a long-running test because it involves "npm install", which can take some time.
//
// Without this test, we might not discover peer dependency conflicts until after a release is produced
// and a user tries to use the template bundle.
describe('docusaurus template bundle dependencies', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'calm-docusaurus-'));

    afterAll(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should resolve without peer dependency conflicts (long running test)', async () => {
        copyFileSync(TEMPLATE_PACKAGE_JSON, join(tmpDir, 'package.json'));

        const exitCode = await new Promise<number>((resolve, reject) => {
            const stderr: string[] = [];
            const proc = spawn('npm', ['install', '--package-lock-only', '--prefix', tmpDir]);
            proc.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk.toString()));
            proc.on('close', (code) => resolve(code ?? 1));
            proc.on('error', reject);
        });

        expect(exitCode).toBe(0);
    }, 120_000);
});
