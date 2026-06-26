import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { loadWorkspaceConfig, getWorkspaceConfigPath, DEFAULT_WORKSPACE_CONFIG } from './config';
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';

describe('workspace config', () => {
    const gitRoot = path.join(__dirname, 'test-config');
    const calmWorkspaceDir = path.join(gitRoot, '.calm-workspace');

    beforeAll(async () => {
        await mkdir(calmWorkspaceDir, { recursive: true });
    });

    afterAll(async () => {
        await rm(gitRoot, { recursive: true, force: true });
    });

    beforeEach(async () => {
        await rm(calmWorkspaceDir, { recursive: true, force: true });
        await mkdir(calmWorkspaceDir, { recursive: true });
    });

    const writeConfig = (content: string) =>
        writeFile(getWorkspaceConfigPath(gitRoot), content, 'utf8');

    it('getWorkspaceConfigPath points at .calm-workspace/config.json', () => {
        expect(getWorkspaceConfigPath('/repo')).toBe('/repo/.calm-workspace/config.json');
    });

    it('returns defaults when the config file is absent', async () => {
        const config = await loadWorkspaceConfig(gitRoot);
        expect(config).toEqual(DEFAULT_WORKSPACE_CONFIG);
    });

    it('returns defaults when the config file is invalid JSON', async () => {
        await writeConfig('not json {{{');
        const config = await loadWorkspaceConfig(gitRoot);
        expect(config).toEqual(DEFAULT_WORKSPACE_CONFIG);
    });

    it('honours valid values from the config file', async () => {
        await writeConfig(JSON.stringify({
            push: { onExisting: 'fail' },
            bump: { defaultIncrement: 'PATCH' },
        }));
        const config = await loadWorkspaceConfig(gitRoot);
        expect(config.push.onExisting).toBe('fail');
        expect(config.bump.defaultIncrement).toBe('PATCH');
    });

    it('falls back to defaults for individually missing or invalid fields', async () => {
        await writeConfig(JSON.stringify({
            push: { onExisting: 'nonsense' },
            bump: {},
        }));
        const config = await loadWorkspaceConfig(gitRoot);
        expect(config.push.onExisting).toBe('skip');
        expect(config.bump.defaultIncrement).toBe('MINOR');
    });
});
