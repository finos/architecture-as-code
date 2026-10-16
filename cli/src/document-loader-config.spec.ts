import type { ParseDocumentLoaderOptions } from './document-loader-config';

let cliConfigModule: typeof import('./cli-config');

describe('parseDocumentLoaderConfig', () => {
    const parseDocLoaderConfigForTest = async (options: ParseDocumentLoaderOptions) => {
        const configModule = await import('./document-loader-config');
        return configModule.parseDocumentLoaderConfig(options);
    };

    const createMockLogger = () => ({
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
    });

    beforeEach(async () => {
        vi.clearAllMocks();
        cliConfigModule = await import('./cli-config');
        vi.spyOn(cliConfigModule, 'loadCliConfig').mockResolvedValue({});
    });

    it('should parse calmhub url when provided', async () => {
        const options = await parseDocLoaderConfigForTest({
            calmHubUrl: 'calmhub'
        });
        expect(options.calmHubUrl).toEqual('calmhub');
    });

    it('sets workspaceBundlePath when a workspace bundle is found in the repo', async () => {
        const resolverModule = await import('./workspace-resolver');
        const spy = vi.spyOn(resolverModule, 'findWorkspaceManifestPath')
            .mockReturnValue('/repo/.calm-workspace/bundles/default');
        try {
            const options = await parseDocLoaderConfigForTest({});
            expect(options.workspaceBundlePath).toBe('/repo/.calm-workspace/bundles/default');
        } finally {
            spy.mockRestore();
        }
    });

    it('leaves workspaceBundlePath unset when no workspace bundle is found', async () => {
        const resolverModule = await import('./workspace-resolver');
        const spy = vi.spyOn(resolverModule, 'findWorkspaceManifestPath').mockReturnValue(null);
        try {
            const options = await parseDocLoaderConfigForTest({});
            expect(options.workspaceBundlePath).toBeUndefined();
        } finally {
            spy.mockRestore();
        }
    });

    it('uses the workspace bundle it is given and does not search for one', async () => {
        const resolverModule = await import('./workspace-resolver');
        const spy = vi.spyOn(resolverModule, 'findWorkspaceManifestPath');
        try {
            const options = await parseDocLoaderConfigForTest({ workspaceBundlePath: '/repo/bundle' });
            expect(options.workspaceBundlePath).toBe('/repo/bundle');
            expect(options.basePath).toBe('/repo/bundle');
            expect(spy).not.toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });

    it('should override calmhub url in file when provided', async () => {
        cliConfigModule = await import('./cli-config');
        vi.spyOn(cliConfigModule, 'loadCliConfig').mockResolvedValue({ calmHubUrl: 'calmhub-file' });

        const options = await parseDocLoaderConfigForTest({
            calmHubUrl: 'calmhub-cli'
        });
        expect(options.calmHubUrl).toEqual('calmhub-cli');
    });

    it('should parse schemaDirectoryPath when provided', async () => {
        const options = await parseDocLoaderConfigForTest({
            schemaDirectory: 'path'
        });
        expect(options.schemaDirectoryPath).toEqual('path');
    });

    it('should parse allowedRemoteHosts when provided', async () => {
        const options = await parseDocLoaderConfigForTest({
            allowedRemoteHosts: ['schemas.example.com']
        });
        expect(options.allowedRemoteHosts).toEqual(['schemas.example.com']);
    });

    it('should use allowedRemoteHosts from config when CLI does not provide them', async () => {
        cliConfigModule = await import('./cli-config');
        vi.spyOn(cliConfigModule, 'loadCliConfig').mockResolvedValue({
            allowedRemoteHosts: ['config.example.com']
        });

        const options = await parseDocLoaderConfigForTest({});
        expect(options.allowedRemoteHosts).toEqual(['config.example.com']);
    });

    it('should prefer CLI allowedRemoteHosts over config values', async () => {
        cliConfigModule = await import('./cli-config');
        vi.spyOn(cliConfigModule, 'loadCliConfig').mockResolvedValue({
            allowedRemoteHosts: ['config.example.com']
        });

        const options = await parseDocLoaderConfigForTest({
            allowedRemoteHosts: ['cli.example.com']
        });
        expect(options.allowedRemoteHosts).toEqual(['cli.example.com']);
    });

    it('keeps supported repositories when CLI allowedRemoteHosts override the config list', async () => {
        cliConfigModule = await import('./cli-config');
        const fakePlugin = { getAuthHeaders: vi.fn() };
        vi.spyOn(cliConfigModule, 'loadCliConfig').mockResolvedValue({
            allowedRemoteHosts: ['config.example.com'],
            directUrlAuthModule: '/fake/direct-url-auth.js',
            directUrlAuthAuthenticatedHosts: ['protected.example.com']
        });
        vi.spyOn(cliConfigModule, 'loadDirectUrlAuthPlugin').mockResolvedValue(fakePlugin as never);

        const options = await parseDocLoaderConfigForTest({
            allowedRemoteHosts: ['cli.example.com']
        });

        expect(options.allowedRemoteHosts).toEqual(['cli.example.com']);
        expect(options.directUrlAuthAuthenticatedHosts).toEqual(['protected.example.com']);
    });

    it('should set debug to true when verbose passed along', async () => {
        const options = await parseDocLoaderConfigForTest({
            verbose: true
        });
        expect(options.debug).toBeTruthy();
    });

    it('should default debug to false', async () => {
        const options = await parseDocLoaderConfigForTest({
        });
        expect(options.debug).toBeFalsy();
    });

    it('loads auth plugin from config file when authPluginPath is set', async () => {
        cliConfigModule = await import('./cli-config');
        const fakePlugin = { getAuthHeader: vi.fn() };
        vi.spyOn(cliConfigModule, 'loadCliConfig').mockResolvedValue({ authPluginPath: '/fake/plugin.js' });
        vi.spyOn(cliConfigModule, 'loadAuthPlugin').mockResolvedValue(fakePlugin as never);

        const options = await parseDocLoaderConfigForTest({});

        expect(cliConfigModule.loadAuthPlugin).toHaveBeenCalledWith('/fake/plugin.js', false);
        expect(options.authPlugin).toBe(fakePlugin);
    });

    it('uses the auth plugin it is given and does not load another', async () => {
        cliConfigModule = await import('./cli-config');
        const givenPlugin = { getAuthHeaders: vi.fn() };
        vi.spyOn(cliConfigModule, 'loadCliConfig').mockResolvedValue({ authPluginPath: '/fake/plugin.js' });
        const loadAuthPlugin = vi.spyOn(cliConfigModule, 'loadAuthPlugin');

        const options = await parseDocLoaderConfigForTest({ authPlugin: givenPlugin });

        expect(options.authPlugin).toBe(givenPlugin);
        expect(loadAuthPlugin).not.toHaveBeenCalled();
    });

    it('logs an error and continues when auth plugin loading throws', async () => {
        cliConfigModule = await import('./cli-config');
        vi.spyOn(cliConfigModule, 'loadCliConfig').mockResolvedValue({ authPluginPath: '/bad/plugin.js' });
        vi.spyOn(cliConfigModule, 'loadAuthPlugin').mockRejectedValue(new Error('module not found'));

        const options = await parseDocLoaderConfigForTest({});

        expect(options.authPlugin).toBeUndefined();
    });

    it('loads direct URL auth module from flattened config when configured', async () => {
        cliConfigModule = await import('./cli-config');
        const calmShared = await import('@finos/calm-shared');
        const mockLogger = createMockLogger();
        const fakePlugin = { getAuthHeaders: vi.fn() };
        vi.spyOn(calmShared, 'initLogger').mockReturnValue(mockLogger as never);
        vi.spyOn(cliConfigModule, 'loadCliConfig').mockResolvedValue({
            directUrlAuthModule: '/fake/direct-url-auth.js',
            directUrlAuthConfigPath: '/configs/direct-url-auth.json',
            directUrlAuthAuthenticatedHosts: ['schemas.example.com']
        });
        vi.spyOn(cliConfigModule, 'loadDirectUrlAuthPlugin').mockResolvedValue(fakePlugin as never);

        const options = await parseDocLoaderConfigForTest({});

        expect(cliConfigModule.loadDirectUrlAuthPlugin).toHaveBeenCalledWith({
            module: '/fake/direct-url-auth.js',
            configPath: '/configs/direct-url-auth.json',
            authenticatedHosts: ['schemas.example.com']
        }, false);
        expect(options.directUrlAuthPlugin).toBe(fakePlugin);
        expect(options.directUrlAuthAuthenticatedHosts).toEqual(['schemas.example.com']);
        expect(mockLogger.info).toHaveBeenNthCalledWith(
            1,
            'Loading direct URL auth module from config file: /fake/direct-url-auth.js'
        );
        expect(mockLogger.info).toHaveBeenNthCalledWith(
            2,
            'Direct URL auth configPath: /configs/direct-url-auth.json'
        );
    });

    it('logs "not specified" when direct URL auth configPath is omitted', async () => {
        cliConfigModule = await import('./cli-config');
        const calmShared = await import('@finos/calm-shared');
        const mockLogger = createMockLogger();
        const fakePlugin = { getAuthHeaders: vi.fn() };
        vi.spyOn(calmShared, 'initLogger').mockReturnValue(mockLogger as never);
        vi.spyOn(cliConfigModule, 'loadCliConfig').mockResolvedValue({
            directUrlAuthModule: '/fake/direct-url-auth.js',
            directUrlAuthAuthenticatedHosts: ['schemas.example.com']
        });
        vi.spyOn(cliConfigModule, 'loadDirectUrlAuthPlugin').mockResolvedValue(fakePlugin as never);

        const options = await parseDocLoaderConfigForTest({});

        expect(options.directUrlAuthPlugin).toBe(fakePlugin);
        expect(mockLogger.info).toHaveBeenNthCalledWith(
            1,
            'Loading direct URL auth module from config file: /fake/direct-url-auth.js'
        );
        expect(mockLogger.info).toHaveBeenNthCalledWith(
            2,
            'Direct URL auth configPath: not specified'
        );
    });

    it('fails when a flattened direct URL auth configuration is incomplete', async () => {
        cliConfigModule = await import('./cli-config');
        vi.spyOn(cliConfigModule, 'loadCliConfig').mockResolvedValue({
            directUrlAuthConfigPath: '/configs/direct-url-auth.json'
        });

        await expect(parseDocLoaderConfigForTest({}))
            .rejects.toThrow(/Direct URL authentication setup failed: directUrlAuth\.module must be a non-empty string/);
    });

    it('fails when direct URL auth module loading throws', async () => {
        cliConfigModule = await import('./cli-config');
        vi.spyOn(cliConfigModule, 'loadCliConfig').mockResolvedValue({
            directUrlAuthModule: '/bad/direct-url-auth.js',
            directUrlAuthAuthenticatedHosts: ['schemas.example.com']
        });
        vi.spyOn(cliConfigModule, 'loadDirectUrlAuthPlugin').mockRejectedValue(new Error('module not found'));

        await expect(parseDocLoaderConfigForTest({})).rejects.toThrow(/Direct URL authentication setup failed: module not found/);
    });
});
