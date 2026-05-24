import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as cliConfig from '../cli-config';
import * as hubOutput from './hub-output';
import { runCreateNamespace, runListArchitectures, runListNamespaces, 
    runPullArchitecture, runPushArchitecture,  printPushResult, pushVersioned, 
    resolveCalmHubOptions, resolveVersionedMetadata,
    runCreateDomain, runListDomains, runCreateControlRequirement, runListControlRequirements,
    runPushControlRequirement, runPullControlRequirement, runPushControlConfiguration, runPullControlConfiguration,
    printIdCreateResult,
    runCreateControlConfiguration, runListControlConfigurations,
    runListControlRequirementVersions } from './hub-commands';

// We stub the entire @finos/calm-shared module so no real HTTP is made
vi.mock('@finos/calm-shared', () => {
    const mockClient = {
        createNamespace: vi.fn(),
        listNamespaces: vi.fn(),
        pushArchitecture: vi.fn(),
        pushArchitectureVersion: vi.fn(),
        listArchitectures: vi.fn(),
        pullArchitecture: vi.fn(),
        pushPattern: vi.fn(),
        pushPatternVersion: vi.fn(),
        listPatterns: vi.fn(),
        pullPattern: vi.fn(),
        pushStandard: vi.fn(),
        pushStandardVersion: vi.fn(),
        listStandards: vi.fn(),
        pullStandard: vi.fn(),
        createDomain: vi.fn(),
        listDomains: vi.fn(),
        createControl: vi.fn(),
        listControls: vi.fn(),
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
        CalmHubClient: vi.fn(() => mockClient),
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

describe('hub-commands', () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
            throw new Error('process.exit');
        }) as () => never);

        // Default: hub URL always resolves from options
        vi.mocked(cliConfig.loadCliConfig).mockResolvedValue(null);
        // Default: file read succeeds with valid JSON
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ nodes: [] }) as unknown as Uint8Array);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        // Silence output helpers
        vi.mocked(hubOutput.printJsonSuccess).mockImplementation(() => undefined);
        vi.mocked(hubOutput.printTableSuccess).mockImplementation(() => undefined);
        vi.mocked(hubOutput.printError).mockImplementation(() => undefined);
        vi.mocked(hubOutput.parseOutputFormat).mockImplementation((v) => v === 'pretty' ? 'pretty' : 'json');
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
        it('calls pushArchitecture and prints JSON result', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pushArchitecture).mockResolvedValue({
                id: 1, version: '1.0.0', location: '/calm/namespaces/finos/architectures/1/versions/1.0.0'
            });

            await runPushArchitecture({
                calmHubOptions: {
                    calmHubUrl: 'http://hub'
                },
                namespace: 'finos',
                name: 'my-arch',
                description: 'desc',
                file: 'arch.json'
            });

            expect(mockClient.pushArchitecture).toHaveBeenCalledWith('finos', 'my-arch', 'desc', expect.any(String));
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 1, version: '1.0.0' }));
        });

        it('calls pushArchitectureVersion when --id is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pushArchitectureVersion).mockResolvedValue({
                id: 42, version: '2.0.0', location: '/calm/namespaces/finos/architectures/42/versions/2.0.0'
            });

            await runPushArchitecture({
                calmHubOptions: {
                    calmHubUrl: 'http://hub',
                },
                namespace: 'finos',
                name: 'my-arch',
                description: 'desc',
                file: 'arch.json',
                id: '42',
                version: '2.0.0'
            });

            expect(mockClient.pushArchitectureVersion).toHaveBeenCalledWith('finos', 42, '2.0.0', 'my-arch', 'desc', expect.any(String));
        });

        it('exits with error when --id is given but --version is missing', async () => {
            await expect(runPushArchitecture({
                calmHubOptions: {
                    calmHubUrl: 'http://hub'
                },
                namespace: 'finos',
                name: 'my-arch',
                file: 'arch.json',
                id: '42'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalled();
        });

        it('exits with error when --id is not a valid integer', async () => {
            await expect(runPushArchitecture({
                calmHubOptions: {
                    calmHubUrl: 'http://hub'
                },
                namespace: 'finos',
                name: 'my-arch',
                description: 'desc',
                file: 'arch.json',
                id: 'abc',
                version: '1.0.0'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0,
                '--id must be a valid integer',
                'push architecture',
                expect.any(String)
            );
        });

        it('exits with error when --name is missing and no --id is provided', async () => {
            await expect(runPushArchitecture({
                calmHubOptions: {
                    calmHubUrl: 'http://hub'
                },
                namespace: 'finos',
                file: 'arch.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalled();
        });

        it('exits with error when --description is missing and no --id is provided', async () => {
            await expect(runPushArchitecture({
                calmHubOptions: {
                    calmHubUrl: 'http://hub'
                },
                namespace: 'finos',
                name: 'my-arch',
                file: 'arch.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0,
                '--description is required when creating a new architecture',
                'push architecture',
                expect.any(String)
            );
        });

        it('auto-fetches name and description from Hub when --id is provided and they are omitted', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listArchitectures).mockResolvedValue([
                { id: 42, name: 'my-arch', description: 'fetched desc', versions: ['1.0.0'] }
            ]);
            vi.mocked(mockClient.pushArchitectureVersion).mockResolvedValue({
                id: 42, version: '2.0.0', location: '/calm/namespaces/finos/architectures/42/versions/2.0.0'
            });

            await runPushArchitecture({
                calmHubOptions: {
                    calmHubUrl: 'http://hub'
                },
                namespace: 'finos',
                file: 'arch.json',
                id: '42',
                version: '2.0.0'
            });

            expect(mockClient.listArchitectures).toHaveBeenCalledWith('finos');
            expect(mockClient.pushArchitectureVersion).toHaveBeenCalledWith('finos', 42, '2.0.0', 'my-arch', 'fetched desc', expect.any(String));
        });

        it('exits when file cannot be read', async () => {
            vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
            await expect(runPushArchitecture({
                calmHubOptions: {
                    calmHubUrl: 'http://hub'
                },
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
                calmHubOptions: {
                    calmHubUrl: 'http://hub'
                },
                namespace: 'finos',
                name: 'my-arch',
                description: 'desc',
                file: 'bad.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalled();
        });

        it('prints table output when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pushArchitecture).mockResolvedValue({
                id: 1, version: '1.0.0', location: '/calm/namespaces/finos/architectures/1/versions/1.0.0'
            });

            await runPushArchitecture({
                calmHubOptions: {
                    calmHubUrl: 'http://hub'
                },
                namespace: 'finos',
                name: 'my-arch',
                description: 'desc',
                file: 'arch.json',
                format: 'pretty'
            });

            expect(hubOutput.printTableSuccess).toHaveBeenCalled();
            expect(hubOutput.printJsonSuccess).not.toHaveBeenCalled();
        });

        it('writes stderr error and exits on HubClientError', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.pushArchitecture).mockRejectedValue(
                new shared.HubClientError(409, 'Version already exists', 'POST /calm/namespaces/finos/architectures')
            );

            await expect(runPushArchitecture({
                calmHubOptions: {
                    calmHubUrl: 'http://hub'
                },
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
        it('prints JSON to stdout by default', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pullArchitecture).mockResolvedValue({ id: 1, architecture: '{}' });
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

            await runPullArchitecture({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', id: '1', version: '1.0.0' });

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"id": 1'));
            consoleSpy.mockRestore();
        });

        it('writes to file when --output is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pullArchitecture).mockResolvedValue({ id: 1 });

            await runPullArchitecture({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', id: '1', version: '1.0.0', output: 'out.json' });

            expect(fs.writeFile).toHaveBeenCalledWith('out.json', expect.any(String), 'utf-8');
        });

        it('exits on HubClientError', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.pullArchitecture).mockRejectedValue(
                new shared.HubClientError(404, 'Not found', 'GET /calm/namespaces/finos/architectures/99/versions/1.0.0')
            );

            await expect(runPullArchitecture({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', id: '99', version: '1.0.0' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(404, 'Not found', expect.any(String), 'json');
        });

        it('exits with error when --id is not a valid integer', async () => {
            await expect(runPullArchitecture({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', id: 'not-a-number', version: '1.0.0' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0,
                '--id must be a valid integer',
                'pull architecture',
                'json'
            );
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
            printPushResult({ id: 1, version: '1.0.0', location: '/calm/namespaces/finos/architectures/1/versions/1.0.0' }, 'pretty');

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [{ STATUS: 'Created', ID: 1, VERSION: '1.0.0', LOCATION: '/calm/namespaces/finos/architectures/1/versions/1.0.0' }],
                [
                    { key: 'STATUS', header: 'STATUS' },
                    { key: 'ID', header: 'ID' },
                    { key: 'VERSION', header: 'VERSION' },
                    { key: 'LOCATION', header: 'LOCATION' }
                ]
            );
            expect(hubOutput.printJsonSuccess).not.toHaveBeenCalled();
        });

        it('defaults version to empty string when version is undefined', async () => {
            printPushResult({ id: 2, location: '/calm/namespaces/finos/architectures/2' }, 'pretty');

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [expect.objectContaining({ VERSION: '' })],
                expect.any(Array)
            );
        });

        it('calls printJsonSuccess when format is json', async () => {
            const result = { id: 1, version: '1.0.0', location: '/loc' };
            printPushResult(result, 'json');

            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(result);
            expect(hubOutput.printTableSuccess).not.toHaveBeenCalled();
        });
    });

    // ── resolveVersionedMetadata ───────────────────────────────────────────

    describe('resolveVersionedMetadata', () => {
        it('returns provided name and description without fetching when both are supplied', async () => {
            const { mockClient } = await getSharedMocks();
            const result = await resolveVersionedMetadata(mockClient, 'finos', 1, 'my-arch', 'my-desc', 'json');

            expect(result).toEqual({ name: 'my-arch', description: 'my-desc' });
            expect(mockClient.listArchitectures).not.toHaveBeenCalled();
        });

        it('fetches from Hub when name is absent', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listArchitectures).mockResolvedValue([
                { id: 1, name: 'fetched-arch', description: 'fetched-desc', versions: ['1.0.0'] }
            ]);
            const result = await resolveVersionedMetadata(mockClient, 'finos', 1, undefined, 'my-desc', 'json');

            expect(mockClient.listArchitectures).toHaveBeenCalledWith('finos');
            expect(result).toEqual({ name: 'fetched-arch', description: 'my-desc' });
        });

        it('fetches from Hub when description is absent', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listArchitectures).mockResolvedValue([
                { id: 1, name: 'fetched-arch', description: 'fetched-desc', versions: ['1.0.0'] }
            ]);
            const result = await resolveVersionedMetadata(mockClient, 'finos', 1, 'my-arch', undefined, 'json');

            expect(mockClient.listArchitectures).toHaveBeenCalledWith('finos');
            expect(result).toEqual({ name: 'my-arch', description: 'fetched-desc' });
        });

        it('exits when architecture ID is not found in namespace', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listArchitectures).mockResolvedValue([
                { id: 99, name: 'other-arch', description: 'other', versions: ['1.0.0'] }
            ]);
            await expect(resolveVersionedMetadata(mockClient, 'finos', 1, undefined, undefined, 'json'))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0,
                'Architecture with id 1 not found in namespace finos',
                'push architecture',
                'json'
            );
        });

        it('exits when listArchitectures throws a HubClientError', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.listArchitectures).mockRejectedValue(
                new shared.HubClientError(500, 'Server error', 'GET /calm/namespaces/finos/architectures')
            );

            await expect(resolveVersionedMetadata(mockClient, 'finos', 1, undefined, undefined, 'json'))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(500, 'Server error', expect.any(String), 'json');
        });
    });

    // ── pushVersioned ──────────────────────────────────────────────────────

    describe('pushVersioned', () => {
        it('exits when --version is missing', async () => {
            const { mockClient } = await getSharedMocks();

            await expect(pushVersioned(
                mockClient,
                { calmHubOptions: {}, namespace: 'finos', file: 'arch.json', id: '1' },
                '{}',
                'json'
            )).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, '--version is required when --id is provided', 'push architecture', 'json'
            );
        });

        it('exits when --id is not a valid integer', async () => {
            const { mockClient } = await getSharedMocks();

            await expect(pushVersioned(
                mockClient,
                { calmHubOptions: {}, namespace: 'finos', file: 'arch.json', id: 'not-a-number', version: '1.0.0' },
                '{}',
                'json'
            )).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, '--id must be a valid integer', 'push architecture', 'json'
            );
        });

        it('calls pushArchitectureVersion with resolved metadata and returns result', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pushArchitectureVersion).mockResolvedValue({
                id: 5, version: '2.0.0', location: '/calm/namespaces/finos/architectures/5/versions/2.0.0'
            });

            const result = await pushVersioned(
                mockClient,
                { calmHubOptions: {}, namespace: 'finos', file: 'arch.json', id: '5', version: '2.0.0', name: 'my-arch', description: 'desc' },
                '{"nodes":[]}',
                'json'
            );

            expect(mockClient.pushArchitectureVersion).toHaveBeenCalledWith(
                'finos', 5, '2.0.0', 'my-arch', 'desc', '{"nodes":[]}'
            );
            expect(result).toEqual({ id: 5, version: '2.0.0', location: '/calm/namespaces/finos/architectures/5/versions/2.0.0' });
        });
    });

    // ── runPushPattern ─────────────────────────────────────────────────────

    describe('runPushPattern', () => {
        it('calls pushPattern and prints JSON result', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pushPattern).mockResolvedValue({
                id: 10, version: '1.0.0', location: '/calm/namespaces/finos/patterns/10/versions/1.0.0'
            });

            const { runPushPattern } = await import('./hub-commands');
            await runPushPattern({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-pattern',
                description: 'desc',
                file: 'pattern.json'
            });

            expect(mockClient.pushPattern).toHaveBeenCalledWith('finos', 'my-pattern', 'desc', expect.any(String));
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 10, version: '1.0.0' }));
        });

        it('calls pushPatternVersion when --id is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pushPatternVersion).mockResolvedValue({
                id: 10, version: '2.0.0', location: '/calm/namespaces/finos/patterns/10/versions/2.0.0'
            });

            const { runPushPattern } = await import('./hub-commands');
            await runPushPattern({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-pattern',
                description: 'desc',
                file: 'pattern.json',
                id: '10',
                version: '2.0.0'
            });

            expect(mockClient.pushPatternVersion).toHaveBeenCalledWith('finos', 10, '2.0.0', 'my-pattern', 'desc', expect.any(String));
        });

        it('auto-fetches name and description from Hub when --id provided and they are omitted', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listPatterns).mockResolvedValue([
                { id: 10, name: 'fetched-pattern', description: 'fetched-desc', versions: ['1.0.0'] }
            ]);
            vi.mocked(mockClient.pushPatternVersion).mockResolvedValue({
                id: 10, version: '2.0.0', location: '/calm/namespaces/finos/patterns/10/versions/2.0.0'
            });

            const { runPushPattern } = await import('./hub-commands');
            await runPushPattern({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                file: 'pattern.json',
                id: '10',
                version: '2.0.0'
            });

            expect(mockClient.listPatterns).toHaveBeenCalledWith('finos');
            expect(mockClient.pushPatternVersion).toHaveBeenCalledWith('finos', 10, '2.0.0', 'fetched-pattern', 'fetched-desc', expect.any(String));
        });

        it('exits with error when --name is missing for new pattern', async () => {
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

        it('exits with error when --description is missing for new pattern', async () => {
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

        it('exits with error when --ver is missing with --id', async () => {
            const { runPushPattern } = await import('./hub-commands');
            await expect(runPushPattern({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-pattern',
                description: 'desc',
                file: 'pattern.json',
                id: '10'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, '--ver is required when --id is provided', 'push pattern', 'json'
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
            vi.mocked(mockClient.pushPattern).mockRejectedValue(
                new shared.HubClientError(409, 'Pattern already exists', 'POST /calm/namespaces/finos/patterns')
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
        it('prints JSON to stdout by default', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pullPattern).mockResolvedValue({ id: 10, patternJson: '{}' });
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

            const { runPullPattern } = await import('./hub-commands');
            await runPullPattern({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', id: '10', version: '1.0.0' });

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"id": 10'));
            consoleSpy.mockRestore();
        });

        it('writes to file when --output is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pullPattern).mockResolvedValue({ id: 10 });

            const { runPullPattern } = await import('./hub-commands');
            await runPullPattern({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', id: '10', version: '1.0.0', output: 'out.json' });

            expect(fs.writeFile).toHaveBeenCalledWith('out.json', expect.any(String), 'utf-8');
        });

        it('exits with error when --id is not a valid integer', async () => {
            const { runPullPattern } = await import('./hub-commands');
            await expect(runPullPattern({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', id: 'bad', version: '1.0.0' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, '--id must be a valid integer', 'pull pattern', 'json'
            );
        });

        it('exits on HubClientError', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.pullPattern).mockRejectedValue(
                new shared.HubClientError(404, 'Pattern not found', 'GET /calm/namespaces/finos/patterns/99/versions/1.0.0')
            );

            const { runPullPattern } = await import('./hub-commands');
            await expect(runPullPattern({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', id: '99', version: '1.0.0' }))
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
        it('calls pushStandard and prints JSON result', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pushStandard).mockResolvedValue({
                id: 20, version: '1.0.0', location: '/calm/namespaces/finos/standards/20/versions/1.0.0'
            });

            const { runPushStandard } = await import('./hub-commands');
            await runPushStandard({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-standard',
                description: 'desc',
                file: 'standard.txt'
            });

            expect(mockClient.pushStandard).toHaveBeenCalledWith('finos', 'my-standard', 'desc', expect.any(String));
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 20, version: '1.0.0' }));
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
                file: 'standard.txt'
            })).rejects.toThrow('process.exit');

            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, 'File is not valid JSON: standard.txt', 'push standard standard.txt', 'json'
            );
            expect(mockClient.pushStandard).not.toHaveBeenCalled();
        });

        it('calls pushStandardVersion when --id is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pushStandardVersion).mockResolvedValue({
                id: 20, version: '2.0.0', location: '/calm/namespaces/finos/standards/20/versions/2.0.0'
            });

            const { runPushStandard } = await import('./hub-commands');
            await runPushStandard({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-standard',
                description: 'desc',
                file: 'standard.txt',
                id: '20',
                version: '2.0.0'
            });

            expect(mockClient.pushStandardVersion).toHaveBeenCalledWith('finos', 20, '2.0.0', 'my-standard', 'desc', expect.any(String));
        });

        it('auto-fetches name and description from Hub when --id provided and they are omitted', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listStandards).mockResolvedValue([
                { id: 20, name: 'fetched-standard', description: 'fetched-desc', versions: ['1.0.0'] }
            ]);
            vi.mocked(mockClient.pushStandardVersion).mockResolvedValue({
                id: 20, version: '2.0.0', location: '/calm/namespaces/finos/standards/20/versions/2.0.0'
            });

            const { runPushStandard } = await import('./hub-commands');
            await runPushStandard({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                file: 'standard.txt',
                id: '20',
                version: '2.0.0'
            });

            expect(mockClient.listStandards).toHaveBeenCalledWith('finos');
            expect(mockClient.pushStandardVersion).toHaveBeenCalledWith('finos', 20, '2.0.0', 'fetched-standard', 'fetched-desc', expect.any(String));
        });

        it('exits with error when --name is missing for new standard', async () => {
            const { runPushStandard } = await import('./hub-commands');
            await expect(runPushStandard({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                file: 'standard.txt'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, '--name is required when creating a new standard', 'push standard', 'json'
            );
        });

        it('exits with error when --description is missing for new standard', async () => {
            const { runPushStandard } = await import('./hub-commands');
            await expect(runPushStandard({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-standard',
                file: 'standard.txt'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, '--description is required when creating a new standard', 'push standard', 'json'
            );
        });

        it('exits with error when --ver is missing with --id', async () => {
            const { runPushStandard } = await import('./hub-commands');
            await expect(runPushStandard({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-standard',
                description: 'desc',
                file: 'standard.txt',
                id: '20'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, '--ver is required when --id is provided', 'push standard', 'json'
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
                file: 'missing.txt'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalled();
        });

        it('exits on HubClientError', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.pushStandard).mockRejectedValue(
                new shared.HubClientError(409, 'Standard already exists', 'POST /calm/namespaces/finos/standards')
            );

            const { runPushStandard } = await import('./hub-commands');
            await expect(runPushStandard({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-standard',
                description: 'desc',
                file: 'standard.txt'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(409, 'Standard already exists', expect.any(String), 'json');
        });
    });

    // ── runPullStandard ────────────────────────────────────────────────────

    describe('runPullStandard', () => {
        it('prints JSON to stdout by default', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pullStandard).mockResolvedValue({ id: 20, standardJson: 'raw' });
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

            const { runPullStandard } = await import('./hub-commands');
            await runPullStandard({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', id: '20', version: '1.0.0' });

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"id": 20'));
            consoleSpy.mockRestore();
        });

        it('writes to file when --output is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pullStandard).mockResolvedValue({ id: 20 });

            const { runPullStandard } = await import('./hub-commands');
            await runPullStandard({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', id: '20', version: '1.0.0', output: 'out.txt' });

            expect(fs.writeFile).toHaveBeenCalledWith('out.txt', expect.any(String), 'utf-8');
        });

        it('exits with error when --id is not a valid integer', async () => {
            const { runPullStandard } = await import('./hub-commands');
            await expect(runPullStandard({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', id: 'bad', version: '1.0.0' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, '--id must be a valid integer', 'pull standard', 'json'
            );
        });

        it('exits on HubClientError', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.pullStandard).mockRejectedValue(
                new shared.HubClientError(404, 'Standard not found', 'GET /calm/namespaces/finos/standards/99/versions/1.0.0')
            );

            const { runPullStandard } = await import('./hub-commands');
            await expect(runPullStandard({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', id: '99', version: '1.0.0' }))
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
            printIdCreateResult({ id: 7, location: '/calm/domains/7' }, 'pretty');

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [{ STATUS: 'Created', ID: 7, LOCATION: '/calm/domains/7' }],
                [
                    { key: 'STATUS', header: 'STATUS' },
                    { key: 'ID', header: 'ID' },
                    { key: 'LOCATION', header: 'LOCATION' }
                ]
            );
        });

        it('calls printJsonSuccess with id and location when format is json', () => {
            printIdCreateResult({ id: 7, location: '/calm/domains/7' }, 'json');

            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith({ id: 7, location: '/calm/domains/7' });
            expect(hubOutput.printTableSuccess).not.toHaveBeenCalled();
        });
    });

    // ── runCreateDomain ────────────────────────────────────────────────────

    describe('runCreateDomain', () => {
        it('calls createDomain and prints JSON result', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.createDomain).mockResolvedValue({ name: 'risk', location: '/calm/domains/risk' });

            await runCreateDomain({ calmHubOptions: { calmHubUrl: 'http://hub' }, name: 'risk' });

            expect(mockClient.createDomain).toHaveBeenCalledWith('risk');
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith({ name: 'risk', location: '/calm/domains/risk' });
        });

        it('renders table when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.createDomain).mockResolvedValue({ name: 'risk', location: '/calm/domains/risk' });

            await runCreateDomain({ calmHubOptions: { calmHubUrl: 'http://hub' }, name: 'risk', format: 'pretty' });

            expect(hubOutput.printTableSuccess).toHaveBeenCalled();
        });

        it('exits on 409 conflict', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.createDomain).mockRejectedValue(
                new shared.HubClientError(409, 'Domain already exists', 'POST /calm/domains')
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
            vi.mocked(mockClient.createControl).mockResolvedValue({ id: 42, location: '/calm/domains/risk/controls/42' });

            await runCreateControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                name: 'my-control',
                description: 'A control',
                file: 'req.json'
            });

            expect(mockClient.createControl).toHaveBeenCalledWith('risk', 'my-control', 'A control', expect.any(String));
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith({ id: 42, location: '/calm/domains/risk/controls/42' });
        });

        it('renders table when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.createControl).mockResolvedValue({ id: 42, location: '/calm/domains/risk/controls/42' });

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
                new shared.HubClientError(409, 'Control already exists', 'POST /calm/domains/risk/controls')
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
        it('prints JSON list of controls', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listControls).mockResolvedValue([{ id: 1, name: 'control-a' }]);

            await runListControlRequirements({ calmHubOptions: { calmHubUrl: 'http://hub' }, domain: 'risk' });

            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith([{ id: 1, name: 'control-a' }]);
        });

        it('renders table when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listControls).mockResolvedValue([{ id: 1, name: 'control-a' }]);

            await runListControlRequirements({ calmHubOptions: { calmHubUrl: 'http://hub' }, domain: 'risk', format: 'pretty' });

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [{ ID: 1, NAME: 'control-a' }],
                [
                    { key: 'ID', header: 'ID' },
                    { key: 'NAME', header: 'NAME' }
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
                id: 1, version: '1.0.0', location: '/calm/domains/risk/controls/1/requirement/versions/1.0.0'
            });

            await runPushControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                version: '1.0.0',
                file: 'req.json'
            });

            expect(mockClient.pushControlRequirement).toHaveBeenCalledWith('risk', 1, '1.0.0', expect.any(String));
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 1, version: '1.0.0' }));
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
                file: 'missing.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(0, expect.stringContaining('Could not read file'), expect.any(String), 'json');
        });

        it('exits on Hub error', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.pushControlRequirement).mockRejectedValue(
                new shared.HubClientError(400, 'Bad request', 'POST /calm/domains/risk/controls/1/requirement/versions/1.0.0')
            );

            await expect(runPushControlRequirement({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                version: '1.0.0',
                file: 'req.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(400, 'Bad request', expect.any(String), 'json');
        });
    });

    // ── runPullControlRequirement ──────────────────────────────────────────

    describe('runPullControlRequirement', () => {
        it('writes JSON to stdout', async () => {
            const { mockClient } = await getSharedMocks();
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
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
                new shared.HubClientError(404, 'Not found', 'GET /calm/domains/risk/controls/99/requirement/versions/1.0.0')
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
                id: 1, version: '1.0.0', location: '/calm/domains/risk/controls/1/configurations/5/versions/1.0.0'
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
                new shared.HubClientError(400, 'Bad request', 'POST /calm/domains/risk/controls/1/configurations/5/versions/1.0.0')
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
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
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
                new shared.HubClientError(404, 'Not found', 'GET /calm/domains/risk/controls/99/configurations/5/versions/1.0.0')
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
                id: 5, location: '/calm/domains/risk/controls/1/configurations/5'
            });

            await runCreateControlConfiguration({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                file: 'cfg.json'
            });

            expect(mockClient.createControlConfiguration).toHaveBeenCalledWith('risk', 1, expect.any(String));
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith({ id: 5, location: '/calm/domains/risk/controls/1/configurations/5' });
        });

        it('renders table when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.createControlConfiguration).mockResolvedValue({
                id: 5, location: '/calm/domains/risk/controls/1/configurations/5'
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
                new shared.HubClientError(404, 'Control not found', 'POST /calm/domains/risk/controls/99/configurations')
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
                { id: 1, versions: ['1.0.0'] },
                { id: 2, versions: ['1.0.0', '2.0.0'] },
                { id: 3, versions: ['3.0.0'] }
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
                    { ID: 1, VERSIONS: '1.0.0' },
                    { ID: 2, VERSIONS: '1.0.0, 2.0.0' }
                ],
                [
                    { key: 'ID', header: 'ID' },
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
                { id: 1, versions: ['1.0.0'] },
                { id: 3, versions: ['3.0.0'] }
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
                [{ ID: 3, VERSIONS: '' }],
                [
                    { key: 'ID', header: 'ID' },
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
                .mockRejectedValueOnce(new shared.HubClientError(404, 'Not found', 'GET /calm/domains/risk/controls/1/configurations/2/versions'));

            await expect(runListControlConfigurations({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1'
            })).rejects.toThrow('process.exit');

            expect(hubOutput.printError).toHaveBeenCalledWith(404, 'Not found', expect.any(String), 'json');
        });
    });

    // ── runListControlRequirementVersions ─────────────────────────────────────

    describe('runListControlRequirementVersions', () => {
        it('prints JSON list of versions', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listControlRequirementVersions).mockResolvedValue(['1.0.0', '2.0.0']);

            await runListControlRequirementVersions({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1'
            });

            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(['1.0.0', '2.0.0']);
        });

        it('renders table when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listControlRequirementVersions).mockResolvedValue(['1.0.0']);

            await runListControlRequirementVersions({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '1',
                format: 'pretty'
            });

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [{ VERSION: '1.0.0' }],
                [{ key: 'VERSION', header: 'VERSION' }]
            );
        });

        it('exits when controlId is not a valid integer', async () => {
            await expect(runListControlRequirementVersions({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: 'abc'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(0, '--control-id must be a valid integer', expect.any(String), 'json');
        });

        it('exits on Hub error', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.listControlRequirementVersions).mockRejectedValue(
                new shared.HubClientError(404, 'Not found', 'GET /calm/domains/risk/controls/99/requirement/versions')
            );

            await expect(runListControlRequirementVersions({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                domain: 'risk',
                controlId: '99'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(404, 'Not found', expect.any(String), 'json');
        });
    });

});
