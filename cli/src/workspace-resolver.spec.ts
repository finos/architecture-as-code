import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { resolveWorkspaceBundlePathFromEnv, findGitRoot, findWorkspaceBundlePath } from './workspace-resolver';
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';

describe('workspace-resolver', () => {
    const testDir = path.join(__dirname, 'test-workspace-resolver');

    beforeAll(async () => {
        await mkdir(testDir, { recursive: true });
    });

    afterAll(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    describe('resolveWorkspaceBundlePathFromEnv', () => {
        const originalEnv = process.env.CALM_WORKSPACE_BUNDLE;

        afterEach(() => {
            if (originalEnv === undefined) {
                delete process.env.CALM_WORKSPACE_BUNDLE;
            } else {
                process.env.CALM_WORKSPACE_BUNDLE = originalEnv;
            }
        });

        it('should return null when env var is not set', () => {
            delete process.env.CALM_WORKSPACE_BUNDLE;
            expect(resolveWorkspaceBundlePathFromEnv()).toBeNull();
        });

        it('should return null when env var is empty string', () => {
            process.env.CALM_WORKSPACE_BUNDLE = '';
            expect(resolveWorkspaceBundlePathFromEnv()).toBeNull();
        });

        it('should return null when env var points to non-existent path', () => {
            process.env.CALM_WORKSPACE_BUNDLE = path.join(testDir, 'does-not-exist');
            expect(resolveWorkspaceBundlePathFromEnv()).toBeNull();
        });

        it('should return null when env var points to a file instead of directory', async () => {
            const filePath = path.join(testDir, 'env-file');
            await writeFile(filePath, 'not a directory');
            process.env.CALM_WORKSPACE_BUNDLE = filePath;
            expect(resolveWorkspaceBundlePathFromEnv()).toBeNull();
        });

        it('should return the path when env var points to an existing directory', async () => {
            const dirPath = path.join(testDir, 'env-bundle-dir');
            await mkdir(dirPath, { recursive: true });
            process.env.CALM_WORKSPACE_BUNDLE = dirPath;
            expect(resolveWorkspaceBundlePathFromEnv()).toBe(dirPath);
        });
    });

    describe('findGitRoot', () => {
        it('should return null when no .git directory exists above the path', () => {
            expect(findGitRoot('/tmp')).toBeNull();
        });

        it('should return the directory containing .git', async () => {
            const repo = path.join(testDir, 'repo-git');
            await mkdir(path.join(repo, '.git'), { recursive: true });

            expect(findGitRoot(repo)).toBe(repo);
        });

        it('should find .git from a nested subdirectory', async () => {
            const repo = path.join(testDir, 'repo-git-nested');
            await mkdir(path.join(repo, '.git'), { recursive: true });
            const nested = path.join(repo, 'a', 'b', 'c');
            await mkdir(nested, { recursive: true });

            expect(findGitRoot(nested)).toBe(repo);
        });
    });

    describe('findWorkspaceBundlePath', () => {
        const originalEnv = process.env.CALM_WORKSPACE_BUNDLE;

        afterEach(() => {
            if (originalEnv === undefined) {
                delete process.env.CALM_WORKSPACE_BUNDLE;
            } else {
                process.env.CALM_WORKSPACE_BUNDLE = originalEnv;
            }
        });

        it('should prefer env var over git root workspace', async () => {
            const envDir = path.join(testDir, 'env-preferred');
            await mkdir(envDir, { recursive: true });
            process.env.CALM_WORKSPACE_BUNDLE = envDir;

            // Even with a valid git workspace, env should win
            const repo = path.join(testDir, 'repo-env-preferred');
            await mkdir(path.join(repo, '.git'), { recursive: true });
            const wsDir = path.join(repo, '.calm-workspace');
            const bundleDir = path.join(wsDir, 'bundles', 'default');
            await mkdir(bundleDir, { recursive: true });

            expect(findWorkspaceBundlePath(repo)).toBe(envDir);
        });

        it('should return null when no git root and no env var', () => {
            delete process.env.CALM_WORKSPACE_BUNDLE;
            expect(findWorkspaceBundlePath('/tmp')).toBeNull();
        });

        it('should return null when git root has no .calm-workspace', async () => {
            delete process.env.CALM_WORKSPACE_BUNDLE;
            const repo = path.join(testDir, 'repo-no-ws');
            await mkdir(path.join(repo, '.git'), { recursive: true });

            expect(findWorkspaceBundlePath(repo)).toBeNull();
        });

        it('should return null when bundle directory does not exist', async () => {
            delete process.env.CALM_WORKSPACE_BUNDLE;
            const repo = path.join(testDir, 'repo-no-bundle');
            await mkdir(path.join(repo, '.git'), { recursive: true });
            // Create .calm-workspace but no bundles/default directory
            await mkdir(path.join(repo, '.calm-workspace'), { recursive: true });

            expect(findWorkspaceBundlePath(repo)).toBeNull();
        });

        it('should return bundle path when workspace and bundle directory exist', async () => {
            delete process.env.CALM_WORKSPACE_BUNDLE;
            const repo = path.join(testDir, 'repo-valid');
            await mkdir(path.join(repo, '.git'), { recursive: true });
            const wsDir = path.join(repo, '.calm-workspace');
            const bundleDir = path.join(wsDir, 'bundles', 'default');
            await mkdir(bundleDir, { recursive: true });

            expect(findWorkspaceBundlePath(repo)).toBe(bundleDir);
        });

        it('should use workspace name from workspace.json', async () => {
            delete process.env.CALM_WORKSPACE_BUNDLE;
            const repo = path.join(testDir, 'repo-named');
            await mkdir(path.join(repo, '.git'), { recursive: true });
            const wsDir = path.join(repo, '.calm-workspace');
            const bundleDir = path.join(wsDir, 'bundles', 'custom');
            await mkdir(bundleDir, { recursive: true });
            await writeFile(path.join(wsDir, 'workspace.json'), JSON.stringify({ name: 'custom' }));

            expect(findWorkspaceBundlePath(repo)).toBe(bundleDir);
        });

        it('should fallback to "default" when workspace.json has invalid JSON', async () => {
            delete process.env.CALM_WORKSPACE_BUNDLE;
            const repo = path.join(testDir, 'repo-bad-json');
            await mkdir(path.join(repo, '.git'), { recursive: true });
            const wsDir = path.join(repo, '.calm-workspace');
            const bundleDir = path.join(wsDir, 'bundles', 'default');
            await mkdir(bundleDir, { recursive: true });
            await writeFile(path.join(wsDir, 'workspace.json'), 'not valid json{{{');

            expect(findWorkspaceBundlePath(repo)).toBe(bundleDir);
        });
    });
});
