import { execSync } from 'child_process';
import path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execa, type ResultPromise } from 'execa';

export interface CliInstall {
    tempDir: string;
    run(args: string[], opts?: { cwd?: string; env?: NodeJS.ProcessEnv }): ResultPromise;
    cleanup(): void;
}

/**
 * Packs the CLI package at `repoRoot` (cli/) via `npm pack`, installs the tarball into a fresh
 * temp dir, and returns a runner bound to the installed `calm` binary. Requires the CLI to
 * already be built (`npm run build:cli`) - `npm pack` reads package.json's `files: ["dist/"]`.
 */
export function installPackedCli(repoRoot: string, prefix: string): CliInstall {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));

    // A failure partway through (e.g. a flaky npm install) would otherwise strand the temp dir and
    // a stray .tgz inside repoRoot, since the caller never receives a CliInstall to clean up.
    let sourceTarball: string | undefined;
    try {
        const tgzName = execSync('npm pack', { cwd: repoRoot }).toString().trim();
        sourceTarball = path.join(repoRoot, tgzName);
        const targetTarball = path.join(tempDir, tgzName);
        fs.copyFileSync(sourceTarball, targetTarball);
        fs.unlinkSync(sourceTarball);
        sourceTarball = undefined;

        execSync('npm init -y', { cwd: tempDir, stdio: 'inherit' });
        execSync(`npm install ${targetTarball}`, { cwd: tempDir, stdio: 'inherit' });
    } catch (err) {
        if (sourceTarball && fs.existsSync(sourceTarball)) {
            fs.rmSync(sourceTarball, { force: true });
        }
        fs.rmSync(tempDir, { recursive: true, force: true });
        throw err;
    }

    const calmBin = path.join(tempDir, 'node_modules/.bin/calm');

    return {
        tempDir,
        run(args, opts) {
            const cp = execa(calmBin, args, {
                cwd: opts?.cwd ?? tempDir,
                env: opts?.env ? { ...process.env, ...opts.env } : process.env,
            });
            cp.stdout?.pipe(process.stdout);
            cp.stderr?.pipe(process.stderr);
            return cp;
        },
        cleanup() {
            fs.rmSync(tempDir, { recursive: true, force: true });
        },
    };
}
