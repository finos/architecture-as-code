import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { cleanWorkspaceBundle, cleanAllWorkspaces, ensureWorkspaceBundle, getActiveWorkspace, listWorkspaces } from './workspace';
import { mkdir, writeFile, rm, readdir } from 'fs/promises';
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

    describe('cleanWorkspaceBundle', () => {
        beforeEach(async () => {
            // Setup dummy workspaces
            await ensureWorkspaceBundle(testDir, 'test-bundle');
            await writeFile(path.join(bundlesPath, 'test-bundle', 'file1.json'), '{}');
            await ensureWorkspaceBundle(testDir, 'another-bundle');
            await writeFile(path.join(bundlesPath, 'another-bundle', 'file2.json'), '{}');
        });

        it('should delete only the specified workspace bundle', async () => {
            // Pre-check
            expect(await listWorkspaces(testDir)).toContain('test-bundle');
            expect(await listWorkspaces(testDir)).toContain('another-bundle');

            // Run clean on specific bundle
            await cleanWorkspaceBundle(testDir, 'test-bundle');

            // Post-check - only test-bundle should be deleted
            const workspaces = await listWorkspaces(testDir);
            expect(workspaces).not.toContain('test-bundle');
            expect(workspaces).toContain('another-bundle');
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

// Little helper to read file, since it is not exported from workspace.ts
async function readFile(filePath: string, encoding: string): Promise<string> {
    const { readFile } = await import('fs/promises');
    return await readFile(filePath, { encoding });
}
