import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as cliConfig from '../cli-config';
import * as hubOutput from './hub-output';
import { runCreateNamespace, runListArchitectures, runListNamespaces, 
    runPullArchitecture, runPushArchitecture,  printPushResult, 
    resolveCalmHubOptions,
    runCreateDomain, runListDomains, runCreateControlRequirement, runListControlRequirements,
    runPushControlRequirement, runPullControlRequirement, runPushControlConfiguration, runPullControlConfiguration,
    printIdCreateResult,
    runCreateControlConfiguration, runListControlConfigurations } from './hub-commands';

// We stub the entire @finos/calm-shared module so no real HTTP is made
vi.mock('@finos/calm-shared', () => {
    const mockClient = {
        createNamespace: vi.fn(),
        listNamespaces: vi.fn(),
        listArchitectures: vi.fn(),
        listPatterns: vi.fn(),
        listStandards: vi.fn(),
        // mapping-based push/pull primitives used by orchestratePush/pullDocument
        getMappedResourceVersions: vi.fn(),
        createNewMappedResource: vi.fn(),
        updateMappedResource: vi.fn(),
        getMappedResourceLatestVersion: vi.fn(),
        getMappedResourceByVersion: vi.fn(),
        createDomain: vi.fn(),
        listDomains: vi.fn(),
        createControl: vi.fn(),
        listControls: vi.fn(),
        listControlRequirements: vi.fn(),
        pushControlRequirement: vi.fn(),
        pullControlRequirement: vi.fn(),
        pushControlConfiguration: vi.fn(),
        pullControlConfiguration: vi.fn(),
        createControlConfiguration: vi.fn(),
        listControlConfigurations: vi.fn(),
        listControlRequirementVersions: vi.fn(),
        listControlConfigurationVersions: vi.fn()
    };
    return {
        CalmHubClient: vi.fn(function () { return mockClient; }),
        HubClientError: class HubClientError extends Error {
            constructor(public status: number, public error: string, public request: string) {
                super(`${status} ${error}`);
                this.name = 'HubClientError';
            }
        }
    };
});

vi.mock('fs/promises');
vi.mock('../cli-config');
vi.mock('./hub-output');

async function getSharedMocks() {
    const shared = await import('@finos/calm-shared');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockClient = new (shared.CalmHubClient as any)();
    return { shared, mockClient };
}

/**
 * Builds a minimal CALM document whose `$id` encodes the namespace and mapping.
 * orchestratePush derives the namespace and mapping from this `$id`, not from the CLI options.
 */
function pushDoc(mapping: string, namespace = 'finos'): string {
    return JSON.stringify({
        $id: `http://hub/calm/namespaces/${namespace}/mappings/${mapping}`,
        nodes: []
    });
}

describe('hub-commands', () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        vi.clearAllMocks();
        exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
            throw new Error('process.exit');
        }) as () => never);

        // Default: hub URL always resolves from options
        vi.mocked(cliConfig.loadCliConfig).mockResolvedValue(null);
        // Default: file read succeeds with a valid CALM document carrying a parseable $id
        vi.mocked(fs.readFile).mockResolvedValue(pushDoc('my-arch') as unknown as Uint8Array);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        // Silence output helpers
        vi.mocked(hubOutput.printJsonSuccess).mockImplementation(function () { return undefined; });
        vi.mocked(hubOutput.printTableSuccess).mockImplementation(function () { return undefined; });
        vi.mocked(hubOutput.printError).mockImplementation(function () { return undefined; });
        vi.mocked(hubOutput.parseOutputFormat).mockImplementation(function (v) { return v === 'pretty' ? 'pretty' : 'json'; });

        // Default: mapping has no existing versions, so push creates a new mapped resource
        const { mockClient } = await getSharedMocks();
        vi.mocked(mockClient.getMappedResourceVersions).mockResolvedValue([]);
    });

    afterEach(() => {
        exitSpy.mockRestore();
    });

    // ── resolveHubUrl ──────────────────────────────────────────────────────

    describe('resolveCalmHubOptions', () => {
        it('uses options.calmHubUrl when provided', async () => {
            const opts = await resolveCalmHubOptions({ calmHubUrl: 'http://hub.example.com' });
            expect(opts.calmHubUrl).toBe('http://hub.example.com');
        });

        it('falls back to ~/.calm.json calmHubUrl', async () => {
            vi.mocked(cliConfig.loadCliConfig).mockResolvedValue({ calmHubUrl: 'http://from-config.example.com' });
            const opts = await resolveCalmHubOptions({});
            expect(opts.calmHubUrl).toBe('http://from-config.example.com');
        });

        it('throws when no hub URL is available', async () => {
            await expect(resolveCalmHubOptions({})).rejects.toMatchObject({
                name: 'HubCommandError',
                status: 0,
                error: 'No CALM Hub URL provided. Use --calm-hub-url or set calmHubUrl in ~/.calm.json',
                request: 'resolve hub URL'
            });
            expect(hubOutput.printError).not.toHaveBeenCalled();
            expect(exitSpy).not.toHaveBeenCalled();
        });
        
        it('loads plugin when configured', async () => {
            vi.mocked(cliConfig.loadCliConfig).mockResolvedValue({ calmHubUrl: 'http://from-config.example.com', authPluginPath: './auth-plugin.js' });
            const plugin = { getAuthHeaders: vi.fn().mockResolvedValue({ 'Authorization': 'Bearer token' }) };
            vi.mocked(cliConfig.loadAuthPlugin).mockResolvedValue(plugin);

            const opts = await resolveCalmHubOptions({});
            expect(cliConfig.loadAuthPlugin).toHaveBeenCalledWith('./auth-plugin.js', false);
            expect(opts.authPlugin).toBe(plugin);
        });
    });

    // ── runPushArchitecture ────────────────────────────────────────────────

    describe('runPushArchitecture', () => {
        it('creates a new mapped resource when the mapping has no versions yet', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.createNewMappedResource).mockResolvedValue(
                'http://hub/calm/namespaces/finos/mappings/my-arch/versions/1.0.0'
            );

            await runPushArchitecture({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-arch',
                description: 'desc',
                file: 'arch.json'
            });

            expect(mockClient.getMappedResourceVersions).toHaveBeenCalledWith('finos', 'my-arch');
            expect(mockClient.createNewMappedResource).toHaveBeenCalledWith(
                'finos', 'my-arch', 'ARCHITECTURE', 'my-arch', 'desc', expect.any(String)
            );
            expect(mockClient.updateMappedResource).not.toHaveBeenCalled();
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(
                expect.objectContaining({ mapping: 'my-arch', namespace: 'finos', version: '1.0.0' })
            );
        });

        it('updates the existing mapped resource when versions already exist', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getMappedResourceVersions).mockResolvedValue(['1.0.0']);
            vi.mocked(mockClient.updateMappedResource).mockResolvedValue(
                'http://hub/calm/namespaces/finos/mappings/my-arch/versions/2.0.0'
            );

            await runPushArchitecture({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                file: 'arch.json'
            });

            expect(mockClient.updateMappedResource).toHaveBeenCalledWith('finos', 'my-arch', 'MINOR', expect.any(String));
            expect(mockClient.createNewMappedResource).not.toHaveBeenCalled();
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(
                expect.objectContaining({ mapping: 'my-arch', namespace: 'finos', version: '2.0.0' })
            );
        });

        it('writes the updated document id back to disk after pushing', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.createNewMappedResource).mockResolvedValue(
                'http://hub/calm/namespaces/finos/mappings/my-arch/versions/1.0.0'
            );

            await runPushArchitecture({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-arch',
                description: 'desc',
                file: 'arch.json'
            });

            expect(fs.writeFile).toHaveBeenCalledWith(
                'arch.json',
                expect.stringContaining('/calm/namespaces/finos/mappings/my-arch/versions/1.0.0'),
                'utf-8'
            );
        });

        it('exits with error when --name is missing while creating a new mapping', async () => {
            const { mockClient } = await getSharedMocks();

            await expect(runPushArchitecture({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                description: 'desc',
                file: 'arch.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, '--name is required when creating a new architecture', 'push architecture', 'json'
            );
            expect(mockClient.createNewMappedResource).not.toHaveBeenCalled();
        });

        it('exits with error when --description is missing while creating a new mapping', async () => {
            const { mockClient } = await getSharedMocks();

            await expect(runPushArchitecture({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-arch',
                file: 'arch.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, '--description is required when creating a new architecture', 'push architecture', 'json'
            );
            expect(mockClient.createNewMappedResource).not.toHaveBeenCalled();
        });

        it('exits when file cannot be read', async () => {
            vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
            await expect(runPushArchitecture({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-arch',
                description: 'desc',
                file: 'missing.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalled();
        });

        it('exits when file is not valid JSON', async () => {
            vi.mocked(fs.readFile).mockResolvedValue('not json' as unknown as Uint8Array);
            await expect(runPushArchitecture({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-arch',
                description: 'desc',
                file: 'bad.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalled();
        });

        it('exits when the document has no parseable $id metadata', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ nodes: [] }) as unknown as Uint8Array);
            await expect(runPushArchitecture({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-arch',
                description: 'desc',
                file: 'arch.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, expect.stringContaining('Failed to extract document metadata'), expect.any(String), 'json'
            );
        });

        it('prints table output when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.createNewMappedResource).mockResolvedValue(
                'http://hub/calm/namespaces/finos/mappings/my-arch/versions/1.0.0'
            );

            await runPushArchitecture({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-arch',
                description: 'desc',
                file: 'arch.json',
                format: 'pretty'
            });

            expect(hubOutput.printTableSuccess).toHaveBeenCalled();
            expect(hubOutput.printJsonSuccess).not.toHaveBeenCalled();
        });

        it('writes error output and exits on HubClientError', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.createNewMappedResource).mockRejectedValue(
                new shared.HubClientError(409, 'Version already exists', 'POST /calm/namespaces/finos/mappings/my-arch')
            );

            await expect(runPushArchitecture({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-arch',
                description: 'desc',
                file: 'arch.json'
            })).rejects.toThrow('process.exit');

            expect(hubOutput.printError).toHaveBeenCalledWith(409, 'Version already exists', expect.any(String), 'json');
        });
    });

    // ── runPullArchitecture ────────────────────────────────────────────────

    describe('runPullArchitecture', () => {
        it('pulls a specific version by mapping and prints JSON to stdout', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getMappedResourceByVersion).mockResolvedValue({ id: 1, architecture: '{}' });
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(function () { return undefined; });

            await runPullArchitecture({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', mapping: 'my-arch', version: '1.0.0' });

            expect(mockClient.getMappedResourceByVersion).toHaveBeenCalledWith('finos', 'my-arch', '1.0.0');
            expect(mockClient.getMappedResourceLatestVersion).not.toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"id": 1'));
            consoleSpy.mockRestore();
        });

        it('pulls the latest version when no version is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getMappedResourceLatestVersion).mockResolvedValue({ id: 1 });

            await runPullArchitecture({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', mapping: 'my-arch' });

            expect(mockClient.getMappedResourceLatestVersion).toHaveBeenCalledWith('finos', 'my-arch');
            expect(mockClient.getMappedResourceByVersion).not.toHaveBeenCalled();
        });

        it('writes to file when --output is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getMappedResourceByVersion).mockResolvedValue({ id: 1 });

            await runPullArchitecture({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', mapping: 'my-arch', version: '1.0.0', output: 'out.json' });

            expect(fs.writeFile).toHaveBeenCalledWith('out.json', expect.any(String), 'utf-8');
        });

        it('exits on HubClientError', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.getMappedResourceByVersion).mockRejectedValue(
                new shared.HubClientError(404, 'Not found', 'GET /calm/namespaces/finos/mappings/my-arch/versions/1.0.0')
            );

            await expect(runPullArchitecture({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', mapping: 'my-arch', version: '1.0.0' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(404, 'Not found', expect.any(String), 'json');
        });
    });

    // ── runListArchitectures ───────────────────────────────────────────────

    describe('runListArchitectures', () => {
        it('prints pretty error when no hub URL is available and format is pretty', async () => {
            await expect(runListArchitectures({ calmHubOptions: {}, namespace: 'finos', format: 'pretty' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0,
                'No CALM Hub URL provided. Use --calm-hub-url or set calmHubUrl in ~/.calm.json',
                'resolve hub URL',
                'pretty'
            );
        });

        it('prints JSON array of architectures', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listArchitectures).mockResolvedValue([
                { id: 1, name: 'arch-a', versions: ['1.0.0'] }
            ]);

            await runListArchitectures({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos' });

            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith([{ id: 1, name: 'arch-a', versions: ['1.0.0'] }]);
        });

        it('renders table when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listArchitectures).mockResolvedValue([
                { id: 1, name: 'arch-a', versions: ['1.0.0', '1.1.0'] }
            ]);

            await runListArchitectures({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', format: 'pretty' });

            expect(hubOutput.printTableSuccess).toHaveBeenCalled();
        });
    });

    // ── runCreateNamespace ─────────────────────────────────────────────────

    describe('runCreateNamespace', () => {
        it('calls createNamespace and prints result', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.createNamespace).mockResolvedValue({ name: 'my-org', location: '/calm/namespaces/my-org' });

            await runCreateNamespace({ calmHubOptions: { calmHubUrl: 'http://hub' }, name: 'my-org', description: 'My org' });

            expect(mockClient.createNamespace).toHaveBeenCalledWith('my-org', 'My org');
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith({ name: 'my-org', location: '/calm/namespaces/my-org' });
        });

        it('exits on 409 conflict', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.createNamespace).mockRejectedValue(
                new shared.HubClientError(409, 'Namespace already exists', 'POST /calm/namespaces')
            );

            await expect(runCreateNamespace({ calmHubOptions: { calmHubUrl: 'http://hub' }, name: 'my-org', description: 'My org' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(409, 'Namespace already exists', expect.any(String), 'json');
        });

        it('exits when description is missing', async () => {
            await expect(runCreateNamespace({ calmHubOptions: { calmHubUrl: 'http://hub' }, name: 'my-org' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0,
                '--description is required and must not be blank',
                'unknown',
                'json'
            );
        });

        it('exits when description is blank', async () => {
            await expect(runCreateNamespace({ calmHubOptions: { calmHubUrl: 'http://hub' }, name: 'my-org', description: '   ' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0,
                '--description is required and must not be blank',
                'unknown',
                'json'
            );
        });
    });

    // ── runListNamespaces ──────────────────────────────────────────────────

    describe('runListNamespaces', () => {
        it('prints JSON error when no hub URL is available by default', async () => {
            await expect(runListNamespaces({ calmHubOptions: {} })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0,
                'No CALM Hub URL provided. Use --calm-hub-url or set calmHubUrl in ~/.calm.json',
                'resolve hub URL',
                'json'
            );
        });

        it('prints JSON list of namespaces', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listNamespaces).mockResolvedValue([
                { name: 'finos', description: 'FINOS' }
            ]);

            await runListNamespaces({ calmHubOptions: { calmHubUrl: 'http://hub' } });

            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith([{ name: 'finos', description: 'FINOS' }]);
        });

        it('renders table when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listNamespaces).mockResolvedValue([{ name: 'finos', description: '' }]);

            await runListNamespaces({ calmHubOptions: { calmHubUrl: 'http://hub' }, format: 'pretty' });

            expect(hubOutput.printTableSuccess).toHaveBeenCalled();
        });
    });

    // ── printPushResult ────────────────────────────────────────────────────

    describe('printPushResult', () => {
        it('calls printTableSuccess with correct columns when format is pretty', async () => {
            printPushResult(
                { mapping: 'my-arch', version: '1.0.0', namespace: 'finos', location: 'http://hub' },
                'pretty'
            );

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [{ STATUS: 'Created', MAPPING: 'my-arch', VERSION: '1.0.0', LOCATION: 'http://hub' }],
                [
                    { key: 'STATUS', header: 'STATUS' },
                    { key: 'MAPPING', header: 'MAPPING' },
                    { key: 'VERSION', header: 'VERSION' },
                    { key: 'LOCATION', header: 'LOCATION' }
                ]
            );
            expect(hubOutput.printJsonSuccess).not.toHaveBeenCalled();
        });

        it('calls printJsonSuccess when format is json', async () => {
            const result = { mapping: 'my-arch', version: '1.0.0', namespace: 'finos', location: '/loc' };
            printPushResult(result, 'json');

            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(result);
            expect(hubOutput.printTableSuccess).not.toHaveBeenCalled();
        });
    });

    // ── runPushPattern ─────────────────────────────────────────────────────

    describe('runPushPattern', () => {
        it('creates a new mapped pattern when the mapping has no versions yet', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(fs.readFile).mockResolvedValue(pushDoc('my-pattern') as unknown as Uint8Array);
            vi.mocked(mockClient.createNewMappedResource).mockResolvedValue(
                'http://hub/calm/namespaces/finos/mappings/my-pattern/versions/1.0.0'
            );

            const { runPushPattern } = await import('./hub-commands');
            await runPushPattern({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-pattern',
                description: 'desc',
                file: 'pattern.json'
            });

            expect(mockClient.getMappedResourceVersions).toHaveBeenCalledWith('finos', 'my-pattern');
            expect(mockClient.createNewMappedResource).toHaveBeenCalledWith(
                'finos', 'my-pattern', 'PATTERN', 'my-pattern', 'desc', expect.any(String)
            );
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(
                expect.objectContaining({ mapping: 'my-pattern', namespace: 'finos', version: '1.0.0' })
            );
        });

        it('updates the existing mapped pattern when versions already exist', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(fs.readFile).mockResolvedValue(pushDoc('my-pattern') as unknown as Uint8Array);
            vi.mocked(mockClient.getMappedResourceVersions).mockResolvedValue(['1.0.0']);
            vi.mocked(mockClient.updateMappedResource).mockResolvedValue(
                'http://hub/calm/namespaces/finos/mappings/my-pattern/versions/2.0.0'
            );

            const { runPushPattern } = await import('./hub-commands');
            await runPushPattern({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                file: 'pattern.json'
            });

            expect(mockClient.updateMappedResource).toHaveBeenCalledWith('finos', 'my-pattern', 'MINOR', expect.any(String));
            expect(mockClient.createNewMappedResource).not.toHaveBeenCalled();
        });

        it('exits with error when --name is missing for a new pattern mapping', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(pushDoc('my-pattern') as unknown as Uint8Array);
            const { runPushPattern } = await import('./hub-commands');
            await expect(runPushPattern({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                file: 'pattern.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, '--name is required when creating a new pattern', 'push pattern', 'json'
            );
        });

        it('exits with error when --description is missing for a new pattern mapping', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(pushDoc('my-pattern') as unknown as Uint8Array);
            const { runPushPattern } = await import('./hub-commands');
            await expect(runPushPattern({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-pattern',
                file: 'pattern.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, '--description is required when creating a new pattern', 'push pattern', 'json'
            );
        });

        it('exits when file cannot be read', async () => {
            vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
            const { runPushPattern } = await import('./hub-commands');
            await expect(runPushPattern({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-pattern',
                description: 'desc',
                file: 'missing.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalled();
        });

        it('exits when file is not valid JSON', async () => {
            vi.mocked(fs.readFile).mockResolvedValue('not json' as unknown as Uint8Array);
            const { runPushPattern } = await import('./hub-commands');
            await expect(runPushPattern({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-pattern',
                description: 'desc',
                file: 'bad.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalled();
        });

        it('exits on HubClientError', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(fs.readFile).mockResolvedValue(pushDoc('my-pattern') as unknown as Uint8Array);
            vi.mocked(mockClient.createNewMappedResource).mockRejectedValue(
                new shared.HubClientError(409, 'Pattern already exists', 'POST /calm/namespaces/finos/mappings/my-pattern')
            );

            const { runPushPattern } = await import('./hub-commands');
            await expect(runPushPattern({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-pattern',
                description: 'desc',
                file: 'pattern.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(409, 'Pattern already exists', expect.any(String), 'json');
        });
    });

    // ── runPullPattern ─────────────────────────────────────────────────────

    describe('runPullPattern', () => {
        it('pulls a specific version by mapping and prints JSON to stdout', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getMappedResourceByVersion).mockResolvedValue({ id: 10, patternJson: '{}' });
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(function () { return undefined; });

            const { runPullPattern } = await import('./hub-commands');
            await runPullPattern({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', mapping: 'my-pattern', version: '1.0.0' });

            expect(mockClient.getMappedResourceByVersion).toHaveBeenCalledWith('finos', 'my-pattern', '1.0.0');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"id": 10'));
            consoleSpy.mockRestore();
        });

        it('pulls the latest version when no version is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getMappedResourceLatestVersion).mockResolvedValue({ id: 10 });

            const { runPullPattern } = await import('./hub-commands');
            await runPullPattern({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', mapping: 'my-pattern' });

            expect(mockClient.getMappedResourceLatestVersion).toHaveBeenCalledWith('finos', 'my-pattern');
            expect(mockClient.getMappedResourceByVersion).not.toHaveBeenCalled();
        });

        it('writes to file when --output is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getMappedResourceByVersion).mockResolvedValue({ id: 10 });

            const { runPullPattern } = await import('./hub-commands');
            await runPullPattern({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', mapping: 'my-pattern', version: '1.0.0', output: 'out.json' });

            expect(fs.writeFile).toHaveBeenCalledWith('out.json', expect.any(String), 'utf-8');
        });

        it('exits on HubClientError', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.getMappedResourceByVersion).mockRejectedValue(
                new shared.HubClientError(404, 'Pattern not found', 'GET /calm/namespaces/finos/mappings/my-pattern/versions/1.0.0')
            );

            const { runPullPattern } = await import('./hub-commands');
            await expect(runPullPattern({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', mapping: 'my-pattern', version: '1.0.0' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(404, 'Pattern not found', expect.any(String), 'json');
        });
    });

    // ── runListPatterns ────────────────────────────────────────────────────

    describe('runListPatterns', () => {
        it('prints JSON array of patterns', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listPatterns).mockResolvedValue([
                { id: 1, name: 'pattern-a', versions: ['1.0.0'] }
            ]);

            const { runListPatterns } = await import('./hub-commands');
            await runListPatterns({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos' });

            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith([{ id: 1, name: 'pattern-a', versions: ['1.0.0'] }]);
        });

        it('renders table with ID, NAME, VERSIONS when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listPatterns).mockResolvedValue([
                { id: 1, name: 'pattern-a', versions: ['1.0.0', '2.0.0'] }
            ]);

            const { runListPatterns } = await import('./hub-commands');
            await runListPatterns({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', format: 'pretty' });

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [{ ID: 1, NAME: 'pattern-a', VERSIONS: '1.0.0, 2.0.0' }],
                [
                    { key: 'ID', header: 'ID' },
                    { key: 'NAME', header: 'NAME' },
                    { key: 'VERSIONS', header: 'VERSIONS' }
                ]
            );
        });

        it('exits when no hub URL is available', async () => {
            const { runListPatterns } = await import('./hub-commands');
            await expect(runListPatterns({ calmHubOptions: {}, namespace: 'finos' })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalled();
        });
    });

    // ── runPushStandard ────────────────────────────────────────────────────

    describe('runPushStandard', () => {
        it('creates a new mapped standard when the mapping has no versions yet', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(fs.readFile).mockResolvedValue(pushDoc('my-standard') as unknown as Uint8Array);
            vi.mocked(mockClient.createNewMappedResource).mockResolvedValue(
                'http://hub/calm/namespaces/finos/mappings/my-standard/versions/1.0.0'
            );

            const { runPushStandard } = await import('./hub-commands');
            await runPushStandard({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-standard',
                description: 'desc',
                file: 'standard.json'
            });

            expect(mockClient.getMappedResourceVersions).toHaveBeenCalledWith('finos', 'my-standard');
            expect(mockClient.createNewMappedResource).toHaveBeenCalledWith(
                'finos', 'my-standard', 'STANDARD', 'my-standard', 'desc', expect.any(String)
            );
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(
                expect.objectContaining({ mapping: 'my-standard', namespace: 'finos', version: '1.0.0' })
            );
        });

        it('updates the existing mapped standard when versions already exist', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(fs.readFile).mockResolvedValue(pushDoc('my-standard') as unknown as Uint8Array);
            vi.mocked(mockClient.getMappedResourceVersions).mockResolvedValue(['1.0.0']);
            vi.mocked(mockClient.updateMappedResource).mockResolvedValue(
                'http://hub/calm/namespaces/finos/mappings/my-standard/versions/2.0.0'
            );

            const { runPushStandard } = await import('./hub-commands');
            await runPushStandard({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                file: 'standard.json'
            });

            expect(mockClient.updateMappedResource).toHaveBeenCalledWith('finos', 'my-standard', 'MINOR', expect.any(String));
            expect(mockClient.createNewMappedResource).not.toHaveBeenCalled();
        });

        it('exits when the standard file is not valid JSON', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(fs.readFile).mockResolvedValue('not valid json content' as unknown as Uint8Array);

            const { runPushStandard } = await import('./hub-commands');
            await expect(runPushStandard({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-standard',
                description: 'desc',
                file: 'standard.json'
            })).rejects.toThrow('process.exit');

            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, 'File is not valid JSON: standard.json', 'push standard standard.json', 'json'
            );
            expect(mockClient.createNewMappedResource).not.toHaveBeenCalled();
        });

        it('exits with error when --name is missing for a new standard mapping', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(pushDoc('my-standard') as unknown as Uint8Array);
            const { runPushStandard } = await import('./hub-commands');
            await expect(runPushStandard({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                file: 'standard.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, '--name is required when creating a new standard', 'push standard', 'json'
            );
        });

        it('exits with error when --description is missing for a new standard mapping', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(pushDoc('my-standard') as unknown as Uint8Array);
            const { runPushStandard } = await import('./hub-commands');
            await expect(runPushStandard({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-standard',
                file: 'standard.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, '--description is required when creating a new standard', 'push standard', 'json'
            );
        });

        it('exits when file cannot be read', async () => {
            vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
            const { runPushStandard } = await import('./hub-commands');
            await expect(runPushStandard({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-standard',
                description: 'desc',
                file: 'missing.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalled();
        });

        it('exits on HubClientError', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(fs.readFile).mockResolvedValue(pushDoc('my-standard') as unknown as Uint8Array);
            vi.mocked(mockClient.createNewMappedResource).mockRejectedValue(
                new shared.HubClientError(409, 'Standard already exists', 'POST /calm/namespaces/finos/mappings/my-standard')
            );

            const { runPushStandard } = await import('./hub-commands');
            await expect(runPushStandard({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-standard',
                description: 'desc',
                file: 'standard.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(409, 'Standard already exists', expect.any(String), 'json');
        });
    });

    // ── runPullStandard ────────────────────────────────────────────────────

    describe('runPullStandard', () => {
        it('pulls a specific version by mapping and prints JSON to stdout', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getMappedResourceByVersion).mockResolvedValue({ id: 20, standardJson: 'raw' });
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(function () { return undefined; });

            const { runPullStandard } = await import('./hub-commands');
            await runPullStandard({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', mapping: 'my-standard', version: '1.0.0' });

            expect(mockClient.getMappedResourceByVersion).toHaveBeenCalledWith('finos', 'my-standard', '1.0.0');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"id": 20'));
            consoleSpy.mockRestore();
        });

        it('pulls the latest version when no version is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getMappedResourceLatestVersion).mockResolvedValue({ id: 20 });

            const { runPullStandard } = await import('./hub-commands');
            await runPullStandard({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', mapping: 'my-standard' });

            expect(mockClient.getMappedResourceLatestVersion).toHaveBeenCalledWith('finos', 'my-standard');
            expect(mockClient.getMappedResourceByVersion).not.toHaveBeenCalled();
        });

        it('writes to file when --output is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getMappedResourceByVersion).mockResolvedValue({ id: 20 });

            const { runPullStandard } = await import('./hub-commands');
            await runPullStandard({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', mapping: 'my-standard', version: '1.0.0', output: 'out.txt' });

            expect(fs.writeFile).toHaveBeenCalledWith('out.txt', expect.any(String), 'utf-8');
        });

        it('exits on HubClientError', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.getMappedResourceByVersion).mockRejectedValue(
                new shared.HubClientError(404, 'Standard not found', 'GET /calm/namespaces/finos/mappings/my-standard/versions/1.0.0')
            );

            const { runPullStandard } = await import('./hub-commands');
            await expect(runPullStandard({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', mapping: 'my-standard', version: '1.0.0' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(404, 'Standard not found', expect.any(String), 'json');
        });
    });

    // ── runListStandards ───────────────────────────────────────────────────

    describe('runListStandards', () => {
        it('prints JSON array of standards', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listStandards).mockResolvedValue([
                { id: 1, name: 'standard-a', description: 'desc-a', versions: ['1.0.0'] }
            ]);

            const { runListStandards } = await import('./hub-commands');
            await runListStandards({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos' });

            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith([{ id: 1, name: 'standard-a', description: 'desc-a', versions: ['1.0.0'] }]);
        });

        it('renders table with ID, NAME, DESCRIPTION, VERSIONS when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listStandards).mockResolvedValue([
                { id: 1, name: 'standard-a', description: 'desc-a', versions: ['1.0.0'] }
            ]);

            const { runListStandards } = await import('./hub-commands');
            await runListStandards({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', format: 'pretty' });

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [{ ID: 1, NAME: 'standard-a', DESCRIPTION: 'desc-a', VERSIONS: '1.0.0' }],
                [
                    { key: 'ID', header: 'ID' },
                    { key: 'NAME', header: 'NAME' },
                    { key: 'DESCRIPTION', header: 'DESCRIPTION' },
                    { key: 'VERSIONS', header: 'VERSIONS' }
                ]
            );
        });

        it('exits when no hub URL is available', async () => {
            const { runListStandards } = await import('./hub-commands');
            await expect(runListStandards({ calmHubOptions: {}, namespace: 'finos' })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalled();
        });
    });

    // ── printIdCreateResult ────────────────────────────────────────────────

    describe('printIdCreateResult', () => {
        it('calls printTableSuccess with STATUS/ID/LOCATION when format is pretty', () => {
            printIdCreateResult({ id: 7, location: '/api/calm/domains/7' }, 'pretty');

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [{ STATUS: 'Created', ID: 7, LOCATION: '/api/calm/domains/7' }],
                [
                    { key: 'STATUS', header: 'STATUS' },
                    { key: 'ID', header: 'ID' },
                    { key: 'LOCATION', header: 'LOCATION' }
                ]
            );
        });

        it('calls printJsonSuccess with id and location when format is json', () => {
            printIdCreateResult({ id: 7, location: '/api/calm/domains/7' }, 'json');

            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith({ id: 7, location: '/api/calm/domains/7' });
            expect(hubOutput.printTableSuccess).not.toHaveBeenCalled();
        });
    });

    // ── runCreateDomain ────────────────────────────────────────────────────

    describe('runCreateDomain', () => {
        it('calls createDomain and prints JSON result', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.createDomain).mockResolvedValue({ name: 'risk', location: '/api/calm/domains/risk' });

            await runCreateDomain({ calmHubOptions: { calmHubUrl: 'http://hub' }, name: 'risk' });

            expect(mockClient.createDomain).toHaveBeenCalledWith('risk');
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith({ name: 'risk', location: '/api/calm/domains/risk' });
        });

        it('renders table when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.createDomain).mockResolvedValue({ name: 'risk', location: '/api/calm/domains/risk' });

            await runCreateDomain({ calmHubOptions: { calmHubUrl: 'http://hub' }, name: 'risk', format: 'pretty' });

            expect(hubOutput.printTableSuccess).toHaveBeenCalled();
        });

        it('exits on 409 conflict', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.createDomain).mockRejectedValue(
                new shared.HubClientError(409, 'Domain already exists', 'POST /api/calm/domains')
            );

            await expect(runCreateDomain({ calmHubOptions: { calmHubUrl: 'http://hub' }, name: 'risk' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(409, 'Domain already exists', expect.any(String), 'json');
        });

        it('exits when no hub URL is available', async () => {
            await expect(runCreateDomain({ calmHubOptions: {}, name: 'risk' })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalled();
        });
    });

    // ── runListDomains ─────────────────────────────────────────────────────

    describe('runListDomains', () => {
        it('prints JSON list of domains', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listDomains).mockResolvedValue([{ name: 'risk' }, { name: 'compliance' }]);

            await runListDomains({ calmHubOptions: { calmHubUrl: 'http://hub' } });

            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith([{ name: 'risk' }, { name: 'compliance' }]);
        });

        it('renders table when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listDomains).mockResolvedValue([{ name: 'risk' }]);

            await runListDomains({ calmHubOptions: { calmHubUrl: 'http://hub' }, format: 'pretty' });

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [{ NAME: 'risk' }],
                [{ key: 'NAME', header: 'NAME' }]
            );
        });

        it('exits when no hub URL is available', async () => {
            await expect(runListDomains({ calmHubOptions: {} })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalled();
        });
    });

    // ── runCreateControlRequirement ────────────────────────────────────────

    describe('runCreateControlRequirement', () => {
        it('calls createControl and prints JSON result', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.createControl).mockResolvedValue({ id: 42, location: '/api/calm/domains/risk/controls/42' });

            await runCreateControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                name: 'my-control',
                description: 'A control',
                file: 'req.json'
            });

            expect(mockClient.createControl).toHaveBeenCalledWith('risk', 'my-control', 'A control', expect.any(String));
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith({ id: 42, location: '/api/calm/domains/risk/controls/42' });
        });

        it('renders table when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.createControl).mockResolvedValue({ id: 42, location: '/api/calm/domains/risk/controls/42' });

            await runCreateControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                name: 'my-control',
                description: 'A control',
                file: 'req.json',
                format: 'pretty'
            });

            expect(hubOutput.printTableSuccess).toHaveBeenCalled();
        });

        it('exits when name is blank', async () => {
            await expect(runCreateControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                name: '   ',
                description: 'A control',
                file: 'req.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, '--name is required and must not be blank', 'unknown', 'json'
            );
        });

        it('exits when description is blank', async () => {
            await expect(runCreateControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                name: 'my-control',
                description: '   ',
                file: 'req.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, '--description is required and must not be blank', 'unknown', 'json'
            );
        });

        it('exits when file cannot be read', async () => {
            vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('ENOENT'));

            await expect(runCreateControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                name: 'my-control',
                description: 'A control',
                file: 'missing.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(0, expect.stringContaining('Could not read file'), expect.any(String), 'json');
        });

        it('exits when file is not valid JSON', async () => {
            vi.mocked(fs.readFile).mockResolvedValueOnce('not-json' as unknown as Uint8Array);

            await expect(runCreateControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                name: 'my-control',
                description: 'A control',
                file: 'bad.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(0, expect.stringContaining('not valid JSON'), expect.any(String), 'json');
        });

        it('exits on 409 conflict', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.createControl).mockRejectedValue(
                new shared.HubClientError(409, 'Control already exists', 'POST /api/calm/domains/risk/controls')
            );

            await expect(runCreateControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                name: 'my-control',
                description: 'A control',
                file: 'req.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(409, 'Control already exists', expect.any(String), 'json');
        });
    });

    // ── runListControlRequirements ─────────────────────────────────────────

    describe('runListControlRequirements', () => {
        it('prints JSON list of control requirements with versions', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listControlRequirements).mockResolvedValue([
                {
                    'control-id': 20,
                    name: 'Encryption At Rest Requirement Updated',
                    description: 'Updated control for encryption at rest',
                    versions: ['1.0.0']
                }
            ]);

            await runListControlRequirements({ calmHubOptions: { calmHubUrl: 'http://hub' }, domain: 'risk' });

            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith([
                {
                    'control-id': 20,
                    name: 'Encryption At Rest Requirement Updated',
                    description: 'Updated control for encryption at rest',
                    versions: ['1.0.0']
                }
            ]);
        });

        it('renders table when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listControlRequirements).mockResolvedValue([
                {
                    'control-id': 21,
                    name: 'Data Retention Requirement',
                    description: 'Control for data retention',
                    versions: ['1.0.0', '2.0.0']
                }
            ]);

            await runListControlRequirements({ calmHubOptions: { calmHubUrl: 'http://hub' }, domain: 'risk', format: 'pretty' });

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [{
                    'CONTROL-ID': 21,
                    NAME: 'Data Retention Requirement',
                    DESCRIPTION: 'Control for data retention',
                    VERSIONS: '1.0.0, 2.0.0'
                }],
                [
                    { key: 'CONTROL-ID', header: 'CONTROL-ID' },
                    { key: 'NAME', header: 'NAME' },
                    { key: 'DESCRIPTION', header: 'DESCRIPTION' },
                    { key: 'VERSIONS', header: 'VERSIONS' }
                ]
            );
        });

        it('renders blank description when not provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listControlRequirements).mockResolvedValue([
                { 'control-id': 1, name: 'control-a', versions: ['1.0.0'] }
            ]);

            await runListControlRequirements({ calmHubOptions: { calmHubUrl: 'http://hub' }, domain: 'risk', format: 'pretty' });

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [{ 'CONTROL-ID': 1, NAME: 'control-a', DESCRIPTION: '', VERSIONS: '1.0.0' }],
                [
                    { key: 'CONTROL-ID', header: 'CONTROL-ID' },
                    { key: 'NAME', header: 'NAME' },
                    { key: 'DESCRIPTION', header: 'DESCRIPTION' },
                    { key: 'VERSIONS', header: 'VERSIONS' }
                ]
            );
        });

        it('exits when no hub URL is available', async () => {
            await expect(runListControlRequirements({ calmHubOptions: {}, domain: 'risk' })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalled();
        });
    });

    // ── runPushControlRequirement ──────────────────────────────────────────

    describe('runPushControlRequirement', () => {
        it('calls pushControlRequirement and prints result', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pushControlRequirement).mockResolvedValue({
                id: 1, version: '1.0.0', location: '/api/calm/domains/risk/controls/1/requirement/versions/1.0.0'
            });

            await runPushControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                version: '1.0.0',
                name: 'req-name',
                description: 'req-description',
                file: 'req.json'
            });

            expect(mockClient.pushControlRequirement).toHaveBeenCalledWith('risk', 1, '1.0.0', 'req-name', 'req-description', expect.any(String));
            expect(mockClient.listControls).not.toHaveBeenCalled();
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 1, version: '1.0.0' }));
        });

        it('uses listControls fallback when name and description are omitted', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listControls).mockResolvedValue([{ id: 1, name: 'fallback-name', description: 'fallback-description' }]);
            vi.mocked(mockClient.pushControlRequirement).mockResolvedValue({
                id: 1, version: '1.0.0', location: '/api/calm/domains/risk/controls/1/requirement/versions/1.0.0'
            });

            await runPushControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                version: '1.0.0',
                file: 'req.json'
            });

            expect(mockClient.listControls).toHaveBeenCalledWith('risk');
            expect(mockClient.pushControlRequirement).toHaveBeenCalledWith(
                'risk',
                1,
                '1.0.0',
                'fallback-name',
                'fallback-description',
                expect.any(String)
            );
        });

        it('uses fallback only for missing name when description is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listControls).mockResolvedValue([{ id: 1, name: 'fallback-name', description: 'fallback-description' }]);
            vi.mocked(mockClient.pushControlRequirement).mockResolvedValue({
                id: 1, version: '1.0.0', location: '/api/calm/domains/risk/controls/1/requirement/versions/1.0.0'
            });

            await runPushControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                version: '1.0.0',
                description: 'cli-description',
                file: 'req.json'
            });

            expect(mockClient.listControls).toHaveBeenCalledWith('risk');
            expect(mockClient.pushControlRequirement).toHaveBeenCalledWith(
                'risk',
                1,
                '1.0.0',
                'fallback-name',
                'cli-description',
                expect.any(String)
            );
        });

        it('uses fallback only for missing description when name is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listControls).mockResolvedValue([{ id: 1, name: 'fallback-name', description: 'fallback-description' }]);
            vi.mocked(mockClient.pushControlRequirement).mockResolvedValue({
                id: 1, version: '1.0.0', location: '/api/calm/domains/risk/controls/1/requirement/versions/1.0.0'
            });

            await runPushControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                version: '1.0.0',
                name: 'cli-name',
                file: 'req.json'
            });

            expect(mockClient.listControls).toHaveBeenCalledWith('risk');
            expect(mockClient.pushControlRequirement).toHaveBeenCalledWith(
                'risk',
                1,
                '1.0.0',
                'cli-name',
                'fallback-description',
                expect.any(String)
            );
        });

        it('treats empty CLI values as missing and falls back to listControls', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listControls).mockResolvedValue([{ id: 1, name: 'fallback-name', description: 'fallback-description' }]);
            vi.mocked(mockClient.pushControlRequirement).mockResolvedValue({
                id: 1, version: '1.0.0', location: '/api/calm/domains/risk/controls/1/requirement/versions/1.0.0'
            });

            await runPushControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                version: '1.0.0',
                name: '   ',
                description: '\t',
                file: 'req.json'
            });

            expect(mockClient.listControls).toHaveBeenCalledWith('risk');
            expect(mockClient.pushControlRequirement).toHaveBeenCalledWith(
                'risk',
                1,
                '1.0.0',
                'fallback-name',
                'fallback-description',
                expect.any(String)
            );
        });

        it('exits when control is not found during fallback lookup', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listControls).mockResolvedValue([{ id: 2, name: 'other', description: 'other-desc' }]);

            await expect(runPushControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                version: '1.0.0',
                file: 'req.json'
            })).rejects.toThrow('process.exit');

            expect(hubOutput.printError).toHaveBeenCalledWith(
                0,
                'Control with id 1 not found in domain risk',
                expect.any(String),
                'json'
            );
            expect(mockClient.pushControlRequirement).not.toHaveBeenCalled();
        });

        it('exits when fallback control is missing name', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listControls).mockResolvedValue([{ id: 1, name: '', description: 'fallback-description' }]);

            await expect(runPushControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                version: '1.0.0',
                file: 'req.json'
            })).rejects.toThrow('process.exit');

            expect(hubOutput.printError).toHaveBeenCalledWith(
                0,
                'Control with id 1 in domain risk is missing name or description',
                expect.any(String),
                'json'
            );
            expect(mockClient.pushControlRequirement).not.toHaveBeenCalled();
        });

        it('exits when fallback control is missing description', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listControls).mockResolvedValue([{ id: 1, name: 'fallback-name', description: '' }]);

            await expect(runPushControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                version: '1.0.0',
                file: 'req.json'
            })).rejects.toThrow('process.exit');

            expect(hubOutput.printError).toHaveBeenCalledWith(
                0,
                'Control with id 1 in domain risk is missing name or description',
                expect.any(String),
                'json'
            );
            expect(mockClient.pushControlRequirement).not.toHaveBeenCalled();
        });

        it('renders table when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pushControlRequirement).mockResolvedValue({
                id: 1, version: '1.0.0', location: '/loc'
            });

            await runPushControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                version: '1.0.0',
                name: 'req-name',
                description: 'req-description',
                file: 'req.json',
                format: 'pretty'
            });

            expect(hubOutput.printTableSuccess).toHaveBeenCalled();
        });

        it('exits when controlId is not a valid integer', async () => {
            await expect(runPushControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: 'abc',
                version: '1.0.0',
                name: 'req-name',
                description: 'req-description',
                file: 'req.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(0, '--control-id must be a valid integer', expect.any(String), 'json');
        });

        it('exits when file cannot be read', async () => {
            vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('ENOENT'));

            await expect(runPushControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                version: '1.0.0',
                name: 'req-name',
                description: 'req-description',
                file: 'missing.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(0, expect.stringContaining('Could not read file'), expect.any(String), 'json');
        });

        it('exits on Hub error', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.pushControlRequirement).mockRejectedValue(
                new shared.HubClientError(400, 'Bad request', 'POST /api/calm/domains/risk/controls/1/requirement/versions/1.0.0')
            );

            await expect(runPushControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                version: '1.0.0',
                name: 'req-name',
                description: 'req-description',
                file: 'req.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(400, 'Bad request', expect.any(String), 'json');
        });
    });

    // ── runPullControlRequirement ──────────────────────────────────────────

    describe('runPullControlRequirement', () => {
        it('writes JSON to stdout', async () => {
            const { mockClient } = await getSharedMocks();
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(function () { return undefined; });
            vi.mocked(mockClient.pullControlRequirement).mockResolvedValue({ type: 'control-requirement', requirements: [] });

            await runPullControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                version: '1.0.0'
            });

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('control-requirement'));
            consoleSpy.mockRestore();
        });

        it('writes to file when --output is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pullControlRequirement).mockResolvedValue({ type: 'control-requirement', requirements: [] });

            await runPullControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                version: '1.0.0',
                output: 'out.json'
            });

            expect(fs.writeFile).toHaveBeenCalledWith('out.json', expect.stringContaining('control-requirement'), 'utf-8');
        });

        it('exits when controlId is not a valid integer', async () => {
            await expect(runPullControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: 'xyz',
                version: '1.0.0'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(0, '--control-id must be a valid integer', expect.any(String), 'json');
        });

        it('exits on Hub error', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.pullControlRequirement).mockRejectedValue(
                new shared.HubClientError(404, 'Not found', 'GET /api/calm/domains/risk/controls/99/requirement/versions/1.0.0')
            );

            await expect(runPullControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '99',
                version: '1.0.0'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(404, 'Not found', expect.any(String), 'json');
        });
    });

    // ── runPushControlConfiguration ────────────────────────────────────────

    describe('runPushControlConfiguration', () => {
        it('calls pushControlConfiguration and prints result', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pushControlConfiguration).mockResolvedValue({
                id: 1, version: '1.0.0', location: '/api/calm/domains/risk/controls/1/configurations/5/versions/1.0.0'
            });

            await runPushControlConfiguration({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                configId: '5',
                version: '1.0.0',
                file: 'cfg.json'
            });

            expect(mockClient.pushControlConfiguration).toHaveBeenCalledWith('risk', 1, 5, '1.0.0', expect.any(String));
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 1, version: '1.0.0' }));
        });

        it('exits when controlId is not a valid integer', async () => {
            await expect(runPushControlConfiguration({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: 'bad',
                configId: '5',
                version: '1.0.0',
                file: 'cfg.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(0, '--control-id must be a valid integer', expect.any(String), 'json');
        });

        it('exits when configId is not a valid integer', async () => {
            await runPushControlConfiguration({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                configId: 'cfg-1',
                version: '1.0.0',
                file: 'cfg.json'
            }).catch(() => undefined);
            expect(hubOutput.printError).toHaveBeenCalledWith(0, '--config-id must be a valid integer', expect.any(String), 'json');
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('exits when file cannot be read', async () => {
            vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('ENOENT'));

            await expect(runPushControlConfiguration({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                configId: '5',
                version: '1.0.0',
                file: 'missing.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(0, expect.stringContaining('Could not read file'), expect.any(String), 'json');
        });

        it('exits when file is not valid JSON', async () => {
            vi.mocked(fs.readFile).mockResolvedValueOnce('not-json' as unknown as Uint8Array);

            await expect(runPushControlConfiguration({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                configId: '5',
                version: '1.0.0',
                file: 'bad.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(0, expect.stringContaining('not valid JSON'), expect.any(String), 'json');
        });

        it('exits on Hub error', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.pushControlConfiguration).mockRejectedValue(
                new shared.HubClientError(400, 'Bad request', 'POST /api/calm/domains/risk/controls/1/configurations/5/versions/1.0.0')
            );

            await expect(runPushControlConfiguration({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                configId: '5',
                version: '1.0.0',
                file: 'cfg.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(400, 'Bad request', expect.any(String), 'json');
        });
    });

    // ── runPullControlConfiguration ────────────────────────────────────────

    describe('runPullControlConfiguration', () => {
        it('writes JSON to stdout', async () => {
            const { mockClient } = await getSharedMocks();
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(function () { return undefined; });
            vi.mocked(mockClient.pullControlConfiguration).mockResolvedValue({ type: 'control-configuration', config: {} });

            await runPullControlConfiguration({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                configId: '5',
                version: '1.0.0'
            });

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('control-configuration'));
            consoleSpy.mockRestore();
        });

        it('writes to file when --output is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pullControlConfiguration).mockResolvedValue({ type: 'control-configuration', config: {} });

            await runPullControlConfiguration({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                configId: '5',
                version: '1.0.0',
                output: 'out.json'
            });

            expect(fs.writeFile).toHaveBeenCalledWith('out.json', expect.stringContaining('control-configuration'), 'utf-8');
        });

        it('exits when controlId is not a valid integer', async () => {
            await expect(runPullControlConfiguration({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: 'xyz',
                configId: '5',
                version: '1.0.0'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(0, '--control-id must be a valid integer', expect.any(String), 'json');
        });

        it('exits when configId is not a valid integer', async () => {
            await runPushControlConfiguration({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                configId: 'cfg-1',
                version: '1.0.0',
                file: 'cfg.json'
            }).catch(() => undefined);
            expect(hubOutput.printError).toHaveBeenCalledWith(0, '--config-id must be a valid integer', expect.any(String), 'json');
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('exits on Hub error', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.pullControlConfiguration).mockRejectedValue(
                new shared.HubClientError(404, 'Not found', 'GET /api/calm/domains/risk/controls/99/configurations/5/versions/1.0.0')
            );

            await expect(runPullControlConfiguration({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '99',
                configId: '5',
                version: '1.0.0'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(404, 'Not found', expect.any(String), 'json');
        });
    });

    // ── runCreateControlConfiguration ─────────────────────────────────────────

    describe('runCreateControlConfiguration', () => {
        it('calls createControlConfiguration and prints JSON result', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.createControlConfiguration).mockResolvedValue({
                id: 5, location: '/api/calm/domains/risk/controls/1/configurations/5'
            });

            await runCreateControlConfiguration({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                file: 'cfg.json'
            });

            expect(mockClient.createControlConfiguration).toHaveBeenCalledWith('risk', 1, expect.any(String));
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith({ id: 5, location: '/api/calm/domains/risk/controls/1/configurations/5' });
        });

        it('renders table when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.createControlConfiguration).mockResolvedValue({
                id: 5, location: '/api/calm/domains/risk/controls/1/configurations/5'
            });

            await runCreateControlConfiguration({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                file: 'cfg.json',
                format: 'pretty'
            });

            expect(hubOutput.printTableSuccess).toHaveBeenCalled();
        });

        it('exits when controlId is not a valid integer', async () => {
            await expect(runCreateControlConfiguration({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: 'abc',
                file: 'cfg.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(0, '--control-id must be a valid integer', expect.any(String), 'json');
        });

        it('exits when file cannot be read', async () => {
            vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('ENOENT'));

            await expect(runCreateControlConfiguration({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                file: 'missing.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(0, expect.stringContaining('Could not read file'), expect.any(String), 'json');
        });

        it('exits on Hub error', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.createControlConfiguration).mockRejectedValue(
                new shared.HubClientError(404, 'Control not found', 'POST /api/calm/domains/risk/controls/99/configurations')
            );

            await expect(runCreateControlConfiguration({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '99',
                file: 'cfg.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(404, 'Control not found', expect.any(String), 'json');
        });
    });

    // ── runListControlConfigurations ──────────────────────────────────────────

    describe('runListControlConfigurations', () => {
        it('prints JSON list of configurations with versions', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listControlConfigurations).mockResolvedValue([1, 2, 3]);
            vi.mocked(mockClient.listControlConfigurationVersions)
                .mockResolvedValueOnce(['1.0.0'])
                .mockResolvedValueOnce(['1.0.0', '2.0.0'])
                .mockResolvedValueOnce(['3.0.0']);

            await runListControlConfigurations({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1'
            });

            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith([
                { 'config-id': 1, versions: ['1.0.0'] },
                { 'config-id': 2, versions: ['1.0.0', '2.0.0'] },
                { 'config-id': 3, versions: ['3.0.0'] }
            ]);
        });

        it('renders table when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listControlConfigurations).mockResolvedValue([1, 2]);
            vi.mocked(mockClient.listControlConfigurationVersions)
                .mockResolvedValueOnce(['1.0.0'])
                .mockResolvedValueOnce(['1.0.0', '2.0.0']);

            await runListControlConfigurations({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                format: 'pretty'
            });

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [
                    { 'CONFIG-ID': 1, VERSIONS: '1.0.0' },
                    { 'CONFIG-ID': 2, VERSIONS: '1.0.0, 2.0.0' }
                ],
                [
                    { key: 'CONFIG-ID', header: 'CONFIG-ID' },
                    { key: 'VERSIONS', header: 'VERSIONS' }
                ]
            );
        });

        it('sorts configurations by ID ascending before output', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listControlConfigurations).mockResolvedValue([3, 1]);
            vi.mocked(mockClient.listControlConfigurationVersions)
                .mockResolvedValueOnce(['1.0.0'])
                .mockResolvedValueOnce(['3.0.0']);

            await runListControlConfigurations({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1'
            });

            expect(mockClient.listControlConfigurationVersions).toHaveBeenNthCalledWith(1, 'risk', 1, 1);
            expect(mockClient.listControlConfigurationVersions).toHaveBeenNthCalledWith(2, 'risk', 1, 3);
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith([
                { 'config-id': 1, versions: ['1.0.0'] },
                { 'config-id': 3, versions: ['3.0.0'] }
            ]);
        });

        it('prints empty JSON array when there are no configurations', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listControlConfigurations).mockResolvedValue([]);

            await runListControlConfigurations({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1'
            });

            expect(mockClient.listControlConfigurationVersions).not.toHaveBeenCalled();
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith([]);
        });

        it('includes configurations that have no versions', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listControlConfigurations).mockResolvedValue([3]);
            vi.mocked(mockClient.listControlConfigurationVersions).mockResolvedValueOnce([]);

            await runListControlConfigurations({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                format: 'pretty'
            });

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [{ 'CONFIG-ID': 3, VERSIONS: '' }],
                [
                    { key: 'CONFIG-ID', header: 'CONFIG-ID' },
                    { key: 'VERSIONS', header: 'VERSIONS' }
                ]
            );
        });

        it('exits when controlId is not a valid integer', async () => {
            await expect(runListControlConfigurations({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: 'abc'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(0, '--control-id must be a valid integer', expect.any(String), 'json');
        });

        it('exits when no hub URL is available', async () => {
            await expect(runListControlConfigurations({ calmHubOptions: {}, domain: 'risk', controlId: '1' })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalled();
        });

        it('exits when a version lookup fails', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.listControlConfigurations).mockResolvedValue([1, 2]);
            vi.mocked(mockClient.listControlConfigurationVersions)
                .mockResolvedValueOnce(['1.0.0'])
                .mockRejectedValueOnce(new shared.HubClientError(404, 'Not found', 'GET /api/calm/domains/risk/controls/1/configurations/2/versions'));

            await expect(runListControlConfigurations({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1'
            })).rejects.toThrow('process.exit');

            expect(hubOutput.printError).toHaveBeenCalledWith(404, 'Not found', expect.any(String), 'json');
        });
    });

});
