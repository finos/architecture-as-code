import { fs, vol } from 'memfs';
import { loadCliConfig } from './cli-config';

vi.mock('fs/promises', async () => {
    const memfs: { fs: typeof fs } = await vi.importActual('memfs');

    return memfs.fs.promises;
});

vi.mock('os', () => ({
    homedir: () => '/home/user'
}));

const exampleConfig = {
    calmHubUrl: 'https://example.com/calmhub'
};

const exampleConfig2 = {
    calmHubPlugin: '/my/plugin/script'
};

describe('cli-config', () => {
    beforeEach(() => {
        process.chdir('/');
    });

    afterEach(() => {
        vol.reset();
    });

    it('loads user config from .calm.json in home dir', async () => {
        vol.fromJSON({
            '/home/user/.calm.json': JSON.stringify(exampleConfig)
        });
        const config = await loadCliConfig();
        expect(config).toEqual(exampleConfig);
    });

    it('loads second user config from .calm.json in home dir', async () => {
        vol.fromJSON({
            '/home/user/.calm.json': JSON.stringify(exampleConfig2)
        });
        const config = await loadCliConfig();
        expect(config).toEqual(exampleConfig2);
    });

    it('returns null when .calm.json does not exist', async () => {
        const config = await loadCliConfig();
        expect(config).toBeNull();
    });

    it('return undefined when .calm.json is invalid JSON', async () => {
        vol.fromJSON({
            '/home/user/.calm.json': 'invalid json'
        });
        await expect(loadCliConfig()).resolves.toBeNull();
    });
});