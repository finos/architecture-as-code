import { fs, vol } from 'memfs';
import { loadCliConfig, loadAuthPlugin, loadDirectUrlAuthPlugin } from './cli-config';
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
    homedir: vi.fn(function () { return '/home/user'; }),
    
}));


const exampleConfig = {
    calmHubUrl: 'https://example.com/calmhub',
    allowedRemoteHosts: ['schemas.example.com'],
    authPluginPath: './auth-plugin.js'
};

const FIXTURES_DIR = resolve(__dirname, '../test_fixtures');
const JS_FIXTURE = resolve(FIXTURES_DIR, 'test-auth-plugin.js');
const DIRECT_URL_JS_FIXTURE = resolve(FIXTURES_DIR, 'test-direct-url-auth-plugin.js');

describe('cli-config', () => {
    beforeEach(() => {
        process.chdir('/');
    });

    afterEach(() => {
        vol.reset();
        vi.mocked(homedir).mockReturnValue('/home/user');
        vi.unstubAllEnvs();
    });

    it('loads user config from .calm.json in home dir', async () => {
        vol.fromJSON({
            '/home/user/.calm.json': JSON.stringify(exampleConfig)
        });
        const config = await loadCliConfig();
        expect(config).toEqual(exampleConfig);
    });

    it('returns empty config when .calm.json does not exist', async () => {
        const config = await loadCliConfig();
        expect(config).toEqual({ calmHubUrl: undefined, allowedRemoteHosts: undefined, authPluginPath: undefined, directUrlAuth: undefined });
    });

    it('returns empty config when .calm.json is invalid JSON', async () => {
        vol.fromJSON({
            '/home/user/.calm.json': 'invalid json'
        });
        await expect(loadCliConfig()).resolves.toEqual({ calmHubUrl: undefined, allowedRemoteHosts: undefined, authPluginPath: undefined, directUrlAuth: undefined });
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

    it('loads directUrlAuth from config', async () => {
        vol.fromJSON({
            '/home/user/.calm.json': JSON.stringify({
                directUrlAuth: {
                    module: DIRECT_URL_JS_FIXTURE,
                    configPath: '/configs/direct-url-auth.json'
                }
            }),
            [DIRECT_URL_JS_FIXTURE]: '',
        });

        const config = await loadCliConfig();
        expect(config).toEqual({
            directUrlAuth: {
                module: DIRECT_URL_JS_FIXTURE,
                configPath: '/configs/direct-url-auth.json'
            }
        });
    });

    it('loads direct URL auth module from absolute path and passes configPath to the constructor', async () => {
        vol.fromJSON({
            '/home/user/.calm.json': JSON.stringify({
                directUrlAuth: {
                    module: DIRECT_URL_JS_FIXTURE,
                    configPath: '/configs/direct-url-auth.json'
                }
            }),
            [DIRECT_URL_JS_FIXTURE]: '',
        });

        const config = await loadCliConfig();
        const directUrlAuthPlugin = await loadDirectUrlAuthPlugin(config.directUrlAuth!, false);
        await expect(directUrlAuthPlugin.getAuthHeaders('https://schemas.example.com/core.json', undefined))
            .resolves.toEqual({
                'Authorization': 'Bearer /configs/direct-url-auth.json',
                'X-Request-Body': undefined
            });
    });

    it('loads direct URL auth module with tilde path', async () => {
        vi.mocked(homedir).mockReturnValue(FIXTURES_DIR);

        vol.fromJSON({
            [resolve(FIXTURES_DIR, '.calm.json')]: JSON.stringify({
                directUrlAuth: {
                    module: '~/test-direct-url-auth-plugin.js'
                }
            }),
            [DIRECT_URL_JS_FIXTURE]: '',
        });

        const config = await loadCliConfig();
        const directUrlAuthPlugin = await loadDirectUrlAuthPlugin(config.directUrlAuth!, false);
        expect(directUrlAuthPlugin.getAuthHeaders).toBeDefined();
    });

    it('expands tilde in direct URL auth configPath before passing it to the constructor', async () => {
        vi.mocked(homedir).mockReturnValue(FIXTURES_DIR);

        vol.fromJSON({
            [resolve(FIXTURES_DIR, '.calm.json')]: JSON.stringify({
                directUrlAuth: {
                    module: '~/test-direct-url-auth-plugin.js',
                    configPath: '~/direct-url-auth.config.json'
                }
            }),
            [DIRECT_URL_JS_FIXTURE]: '',
        });

        const config = await loadCliConfig();
        const directUrlAuthPlugin = await loadDirectUrlAuthPlugin(config.directUrlAuth!, false);
        await expect(directUrlAuthPlugin.getAuthHeaders('https://schemas.example.com/core.json', undefined))
            .resolves.toEqual({
                'Authorization': `Bearer ${resolve(FIXTURES_DIR, 'direct-url-auth.config.json')}`,
                'X-Request-Body': undefined
            });
    });
    
    it('loads config props from environment variables', async () => {
        vi.stubEnv('CALM_HUB_URL', 'https://env-var.com/calmhub');
        vi.stubEnv('CALM_ALLOWED_REMOTE_HOSTS', 'env1.example.com,env2.example.com');
        vi.stubEnv('CALM_AUTH_PLUGIN_PATH', './env-auth-plugin.js');

        vol.fromJSON({
            '/home/user/.calm.json': '{}'
        });

        const config = await loadCliConfig();
        expect(config).toEqual({
            calmHubUrl: 'https://env-var.com/calmhub',
            allowedRemoteHosts: ['env1.example.com', 'env2.example.com'],
            authPluginPath: './env-auth-plugin.js',
            directUrlAuth: undefined
        });
    });
    
    it('loads config props from environment variables when config file is missing', async () => {
        vi.stubEnv('CALM_HUB_URL', 'https://env-var.com/calmhub');
        vi.stubEnv('CALM_ALLOWED_REMOTE_HOSTS', 'env1.example.com,env2.example.com');
        vi.stubEnv('CALM_AUTH_PLUGIN_PATH', './env-auth-plugin.js');

        const config = await loadCliConfig();
        expect(config).toEqual({
            calmHubUrl: 'https://env-var.com/calmhub',
            allowedRemoteHosts: ['env1.example.com', 'env2.example.com'],
            authPluginPath: './env-auth-plugin.js',
            directUrlAuth: undefined
        });
    });

    it('rejects an auth plugin path that does not end in .js', async () => {
        const nonJsPath = resolve(FIXTURES_DIR, 'something.txt');
        vol.fromJSON({ [nonJsPath]: '' });

        await expect(loadAuthPlugin(nonJsPath, false)).rejects.toThrow(/must have a .js extension/i);
    });

    it('rejects when the auth plugin file does not exist', async () => {
        await expect(loadAuthPlugin('/does-not-exist.js', false)).rejects.toThrow(/Auth plugin file not found/i);
    });

    it('rejects a direct URL auth module path that does not end in .js', async () => {
        const nonJsPath = resolve(FIXTURES_DIR, 'something.txt');
        vol.fromJSON({ [nonJsPath]: '' });

        await expect(loadDirectUrlAuthPlugin({ module: nonJsPath }, false)).rejects.toThrow(/must have a .js extension/i);
    });

    it('rejects when the direct URL auth module file does not exist', async () => {
        await expect(loadDirectUrlAuthPlugin({ module: '/does-not-exist.js' }, false)).rejects.toThrow(/direct URL auth module file not found/i);
    });

    it('wraps any error from the dynamic import in a friendly message', async () => {
        // empty .js file → import() returns no default export, triggering the "must export default class" branch
        const emptyJs = resolve(FIXTURES_DIR, 'empty-plugin.js');
        vol.fromJSON({ [emptyJs]: '' });

        await expect(loadAuthPlugin(emptyJs, false)).rejects.toThrow(/Error loading auth plugin/i);
    });

    it('wraps any error from the direct URL auth module import in a friendly message', async () => {
        const emptyJs = resolve(FIXTURES_DIR, 'empty-direct-url-plugin.js');
        vol.fromJSON({ [emptyJs]: '' });

        await expect(loadDirectUrlAuthPlugin({ module: emptyJs }, false)).rejects.toThrow(/Error loading direct URL auth module/i);
    });

    it('overrides config file with config props from environment variables', async () => {
        vi.stubEnv('CALM_HUB_URL', 'https://env-var.com/calmhub');
        vi.stubEnv('CALM_ALLOWED_REMOTE_HOSTS', 'env1.example.com,env2.example.com');
        vi.stubEnv('CALM_AUTH_PLUGIN_PATH', './env-auth-plugin.js');

        vol.fromJSON({
            '/home/user/.calm.json': JSON.stringify({
                calmHubUrl: 'https://example.com/wrong-calmhub-url',
                allowedRemoteHosts: ['wrong.example.com'],
                authPluginPath: './bad-auth-plugin.js'
            })
        });

        const config = await loadCliConfig();
        expect(config).toEqual({
            calmHubUrl: 'https://env-var.com/calmhub',
            allowedRemoteHosts: ['env1.example.com', 'env2.example.com'],
            authPluginPath: './env-auth-plugin.js',
            directUrlAuth: undefined
        });
    });
});
