import { fs, vol } from 'memfs';
import { loadCliConfig, loadAuthPlugin } from './cli-config';
import { resolve } from 'path';
import { homedir } from 'os';


vi.mock('fs/promises', async () => {
    const memfs: { fs: typeof fs } = await vi.importActual('memfs');

    return memfs.fs.promises;
});

vi.mock('fs', async () => {
    const memfs: { fs: typeof fs } = await vi.importActual('memfs');
    return memfs.fs;
});

vi.mock('os', () => ({
    homedir: vi.fn(() => '/home/user')
}));

const exampleConfig = {
    calmHubUrl: 'https://example.com/calmhub',
    allowedRemoteHosts: ['schemas.example.com'],
    authPluginPath: './auth-plugin.js'
};

const FIXTURES_DIR = resolve(__dirname, '../test_fixtures');
const JS_FIXTURE = resolve(FIXTURES_DIR, 'test-auth-plugin.js');
const TS_FIXTURE = resolve(FIXTURES_DIR, 'test-auth-plugin.ts');

describe('cli-config', () => {
    beforeEach(() => {
        process.chdir('/');
    });

    afterEach(() => {
        vol.reset();
        vi.mocked(homedir).mockReturnValue('/home/user');
    });

    it('loads user config from .calm.json in home dir', async () => {
        vol.fromJSON({
            '/home/user/.calm.json': JSON.stringify(exampleConfig)
        });
        const config = await loadCliConfig();
        expect(config).toEqual(exampleConfig);
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

    it('replaces homedir in auth plugin path', async () => {
        vol.fromJSON({
            '/home/user/.calm.json': JSON.stringify({
                authPluginPath: '~/my-auth-plugin.js'
            })
        });

        const config = await loadCliConfig();
        expect(config).toEqual({
            authPluginPath: '~/my-auth-plugin.js'
        });
    });

    it('loads JavaScript auth plugin from absolute path', async () => {
        vol.fromJSON({
            '/home/user/.calm.json': JSON.stringify({ authPluginPath: JS_FIXTURE }),
            // just register this file exists. the actual loading mechanism, import(), will be handled by node which is mocked in the test environment to return a valid auth plugin.
            [JS_FIXTURE]: '',
        });

        const config = await loadCliConfig();
        expect(config).toEqual({ authPluginPath: JS_FIXTURE });

        const authPlugin = await loadAuthPlugin(config!.authPluginPath!, false);
        expect(authPlugin.getAuthHeaders).toBeDefined();
    });

    it('loads TypeScript auth plugin from absolute path', async () => {
        vol.fromJSON({
            '/home/user/.calm.json': JSON.stringify({ authPluginPath: TS_FIXTURE }),
            // just register this file exists. the actual loading mechanism, import(), will be handled by ts-node which is mocked in the test environment to return a valid auth plugin.
            [TS_FIXTURE]: '',
        });

        const config = await loadCliConfig();
        expect(config).toEqual({ authPluginPath: TS_FIXTURE });

        const authPlugin = await loadAuthPlugin(config!.authPluginPath!, false);
        expect(authPlugin.getAuthHeaders).toBeDefined();
    });

    it('loads JavaScript auth plugin with tilde path', async () => {
        // Point homedir at FIXTURES_DIR so ~/test-auth-plugin.js resolves to the real fixture file
        vi.mocked(homedir).mockReturnValue(FIXTURES_DIR);

        vol.fromJSON({
            [resolve(FIXTURES_DIR, '.calm.json')]: JSON.stringify({ authPluginPath: '~/test-auth-plugin.js' }),
            [JS_FIXTURE]: '',
        });

        const config = await loadCliConfig();
        expect(config).toEqual({ authPluginPath: '~/test-auth-plugin.js' });

        const authPlugin = await loadAuthPlugin(config!.authPluginPath!, false);
        expect(authPlugin.getAuthHeaders).toBeDefined();
    });

    it('loads TypeScript auth plugin with tilde path', async () => {
        // Point homedir at FIXTURES_DIR so ~/test-auth-plugin.ts resolves to the real fixture file
        vi.mocked(homedir).mockReturnValue(FIXTURES_DIR);

        vol.fromJSON({
            [resolve(FIXTURES_DIR, '.calm.json')]: JSON.stringify({ authPluginPath: '~/test-auth-plugin.ts' }),
            [TS_FIXTURE]: '',
        });

        const config = await loadCliConfig();
        expect(config).toEqual({ authPluginPath: '~/test-auth-plugin.ts' });

        const authPlugin = await loadAuthPlugin(config!.authPluginPath!, false);
        expect(authPlugin.getAuthHeaders).toBeDefined();
    });
});
