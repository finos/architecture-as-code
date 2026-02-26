import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { cleanWorkspaceBundle, cleanAllWorkspaces, ensureWorkspaceBundle, getActiveWorkspace, listWorkspaces } from './workspace';
import { MANIFEST_FILENAME } from './bundle';
import { mkdir, writeFile, rm, readdir, readFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

describe('workspace', () => {
    const testDir = path.join(__dirname, 'test-workspace');
    const calmWorkspacePath = path.join(testDir, '.calm-workspace');
    const bundlesPath = path.join(calmWorkspacePath, 'bundles');
    const workspaceJsonPath = path.join(calmWorkspacePath, 'workspace.json');

    beforeAll(async () => {
        // Create a test directory
        await mkdir(testDir, { recursive: true });
    });

    afterAll(async () => {
        // Cleanup the test directory
        await rm(testDir, { recursive: true, force: true });
    });

    describe('getActiveWorkspace', () => {
        beforeEach(async () => {
            await mkdir(calmWorkspacePath, { recursive: true });
        });

        it('should throw error when workspace.json contains invalid JSON', async () => {
            await writeFile(workspaceJsonPath, 'not valid json');
            await expect(() => getActiveWorkspace(testDir))
                .rejects
                .toThrow();
        });

        it('should return null when workspace.json is missing name property', async () => {
            await writeFile(workspaceJsonPath, '{"other": "value"}');
            const result = await getActiveWorkspace(testDir);
            expect(result).toBeNull();
        });

        it('should return null when name is not a string', async () => {
            await writeFile(workspaceJsonPath, '{"name": 123}');
            const result = await getActiveWorkspace(testDir);
            expect(result).toBeNull();
        });

        it('should return the workspace name when valid', async () => {
            await writeFile(workspaceJsonPath, '{"name": "my-workspace"}');
            const result = await getActiveWorkspace(testDir);
            expect(result).toBe('my-workspace');
        });
    });

    describe('cleanWorkspaceBundle', () => {
        beforeEach(async () => {
            // Setup dummy workspaces with files directories
            await ensureWorkspaceBundle(testDir, 'test-bundle');
            const testFilesPath = path.join(bundlesPath, 'test-bundle', 'files');
            await mkdir(testFilesPath, { recursive: true });
            await writeFile(path.join(testFilesPath, 'file1.json'), '{}');
            await writeFile(path.join(bundlesPath, 'test-bundle', MANIFEST_FILENAME), '{"doc1": "files/file1.json"}');

            await ensureWorkspaceBundle(testDir, 'another-bundle');
            const anotherFilesPath = path.join(bundlesPath, 'another-bundle', 'files');
            await mkdir(anotherFilesPath, { recursive: true });
            await writeFile(path.join(anotherFilesPath, 'file2.json'), '{}');
            await writeFile(path.join(bundlesPath, 'another-bundle', MANIFEST_FILENAME), '{"doc2": "files/file2.json"}');
        });

        it('should delete files directory and reset manifest but keep the workspace', async () => {
            // Pre-check
            expect(await listWorkspaces(testDir)).toContain('test-bundle');
            expect(await listWorkspaces(testDir)).toContain('another-bundle');
            expect(existsSync(path.join(bundlesPath, 'test-bundle', 'files', 'file1.json'))).toBe(true);

            // Run clean on specific bundle
            await cleanWorkspaceBundle(testDir, 'test-bundle');

            // Post-check - test-bundle should still exist but be clean
            const workspaces = await listWorkspaces(testDir);
            expect(workspaces).toContain('test-bundle');
            expect(workspaces).toContain('another-bundle');

            // Files directory should be deleted
            expect(existsSync(path.join(bundlesPath, 'test-bundle', 'files'))).toBe(false);

            // Manifest should be empty
            const manifest = JSON.parse(await readFile(path.join(bundlesPath, 'test-bundle', MANIFEST_FILENAME), 'utf8'));
            expect(manifest).toEqual({});

            // Another bundle should be untouched
            expect(existsSync(path.join(bundlesPath, 'another-bundle', 'files', 'file2.json'))).toBe(true);
            const anotherManifest = JSON.parse(await readFile(path.join(bundlesPath, 'another-bundle', MANIFEST_FILENAME), 'utf8'));
            expect(anotherManifest).toEqual({ 'doc2': 'files/file2.json' });
        });
    });

    describe('cleanAllWorkspaces', () => {
        beforeEach(async () => {
            // Setup dummy workspaces
            await ensureWorkspaceBundle(testDir, 'test-bundle');
            await writeFile(path.join(bundlesPath, 'test-bundle', 'file1.json'), '{}');
            await ensureWorkspaceBundle(testDir, 'another-bundle');
            await writeFile(path.join(bundlesPath, 'another-bundle', 'file2.json'), '{}');
        });

        it('should delete all bundles and reset the manifest', async () => {
            // Pre-check
            expect(await listWorkspaces(testDir)).toContain('test-bundle');
            expect(await listWorkspaces(testDir)).toContain('another-bundle');
            expect(await getActiveWorkspace(testDir)).toBe('another-bundle');

            // Run clean all
            await cleanAllWorkspaces(testDir);

            // Post-check
            expect(existsSync(bundlesPath)).toBe(true); // bundles folder should still exist
            const bundles = await readdir(bundlesPath);
            expect(bundles.length).toBe(0); // but be empty

            const workspaceJson = JSON.parse(await readFile(workspaceJsonPath, 'utf8'));
            expect(workspaceJson).toEqual({});
        });
    });
});
