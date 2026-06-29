import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as cliConfig from '../cli-config';
import * as hubOutput from './hub-output';
import { runCreateNamespace, runListArchitectures, runListNamespaces,
    runPullArchitecture, runPushArchitecture,  printPushResult,
    resolveCalmHubOptions,
    runCreateDomain, runListDomains, runListControls,
    runPushControlRequirement, runPullControlRequirement, runPushControlConfiguration, runPullControlConfiguration,
    printIdCreateResult,
    runListControlConfigurations } from './hub-commands';

// We stub the @finos/calm-shared HTTP client so no real HTTP is made, but keep the
// real (pure) document-id-utils helpers that orchestratePush relies on.
vi.mock('@finos/calm-shared', async () => {
    const documentIdUtils = await vi.importActual<Record<string, unknown>>('@finos/calm-shared/dist/hub/document-id-utils');
    // Real (pure) semver helpers used by pushDocument's version-bump path.
    const semver = await vi.importActual('@finos/calm-shared/dist/hub/semver');
    // Real (pure) canonical-equality helper used by pushDocument's fail-if-modified path.
    const canonical = await vi.importActual('@finos/calm-shared/dist/hub/canonical');
    const mockClient = {
        createNamespace: vi.fn(),
        listNamespaces: vi.fn(),
        // type-scoped mapping list used by runListMappedResources (architectures/patterns/standards)
        getNamespaceMappings: vi.fn(),
        // mapping-based push/pull primitives used by orchestratePush/pullDocument
        getMappedResourceVersions: vi.fn(),
        createMappedResourceVersion: vi.fn(),
        getMappedResourceLatestVersion: vi.fn(),
        getMappedResourceByVersion: vi.fn(),
        createDomain: vi.fn(),
        listDomains: vi.fn(),
        listControls: vi.fn(),
        listControlConfigurations: vi.fn(),
        getControlRequirementVersions: vi.fn(),
        getControlRequirementVersion: vi.fn(),
        createControlRequirementVersion: vi.fn(),
        getControlConfigurationVersions: vi.fn(),
        getControlConfigurationVersion: vi.fn(),
        createControlConfigurationVersion: vi.fn()
    };
    return {
        ...documentIdUtils,
        extractDocumentMetadata: vi.fn(documentIdUtils['extractDocumentMetadata'] as (...args: unknown[]) => unknown),
        ...semver,
        ...canonical,
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
 * Builds a minimal CALM document whose `$id` encodes the namespace, type, mapping and version.
 * orchestratePush derives the namespace and mapping from this `$id` (via the real
 * extractDocumentMetadata), not from the CLI options. The `title` becomes the resource name
 * when `--name` is not supplied.
 */
function pushDoc(mapping: string, type = 'architectures', namespace = 'finos'): string {
    return JSON.stringify({
        $id: `http://hub/calm/namespaces/${namespace}/${type}/${mapping}/versions/1.0.0`,
        title: mapping,
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
        it('creates a new mapped resource version when the mapping has no versions yet', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.createMappedResourceVersion).mockResolvedValue(
                'http://hub/calm/namespaces/finos/architectures/my-arch/versions/1.0.0'
            );

            await runPushArchitecture({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-arch',
                description: 'desc',
                file: 'arch.json'
            });

            expect(mockClient.getMappedResourceVersions).toHaveBeenCalledWith('finos', 'my-arch', 'architectures');
            expect(mockClient.createMappedResourceVersion).toHaveBeenCalledWith(
                expect.objectContaining({
                    namespace: 'finos', mapping: 'my-arch', type: 'architectures', version: '1.0.0', name: 'my-arch', description: 'desc'
                }),
                expect.any(String)
            );
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(
                expect.objectContaining({ mapping: 'my-arch', namespace: 'finos', version: '1.0.0' })
            );
        });

        it('creates a bumped version when versions already exist', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getMappedResourceVersions).mockResolvedValue(['1.0.0']);
            vi.mocked(mockClient.createMappedResourceVersion).mockResolvedValue(
                'http://hub/calm/namespaces/finos/architectures/my-arch/versions/2.0.0'
            );

            await runPushArchitecture({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                changeType: 'MAJOR',
                file: 'arch.json'
            });

            // name falls back to the document title, description defaults to '' when not provided
            expect(mockClient.createMappedResourceVersion).toHaveBeenCalledWith(
                expect.objectContaining({
                    namespace: 'finos', mapping: 'my-arch', type: 'architectures', version: '2.0.0', name: 'my-arch', description: ''
                }),
                expect.any(String)
            );
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(
                expect.objectContaining({ mapping: 'my-arch', namespace: 'finos', version: '2.0.0' })
            );
        });

        it('writes the updated document id back to disk after pushing', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.createMappedResourceVersion).mockResolvedValue(
                'http://hub/calm/namespaces/finos/architectures/my-arch/versions/1.0.0'
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
                expect.stringContaining('/calm/namespaces/finos/architectures/my-arch/versions/1.0.0'),
                'utf-8'
            );
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
            vi.mocked(mockClient.createMappedResourceVersion).mockResolvedValue(
                'http://hub/calm/namespaces/finos/architectures/my-arch/versions/1.0.0'
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
            vi.mocked(mockClient.createMappedResourceVersion).mockRejectedValue(
                new shared.HubClientError(409, 'Version already exists', 'POST /calm/namespaces/finos/architectures/my-arch/versions/1.0.0')
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

        it('exits when parsed metadata has no namespace', async () => {
            const { shared } = await getSharedMocks();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (vi.mocked(shared.extractDocumentMetadata) as any).mockReturnValueOnce({
                rawDocumentId: 'test', baseUrl: 'http://hub',
                namespace: undefined, mapping: 'my-arch',
                type: 'architectures', version: '1.0.0', name: 'my-arch'
            });

            await expect(runPushArchitecture({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-arch',
                description: 'desc',
                file: 'arch.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, expect.stringContaining('namespace and mapping'), expect.any(String), 'json'
            );
        });

        describe('--fail-if-modified', () => {
            it('creates 1.0.0 for a brand-new mapping even with the flag set', async () => {
                const { mockClient } = await getSharedMocks();
                vi.mocked(mockClient.getMappedResourceVersions).mockResolvedValue([]);
                vi.mocked(mockClient.createMappedResourceVersion).mockResolvedValue(
                    'http://hub/calm/namespaces/finos/architectures/my-arch/versions/1.0.0'
                );

                await runPushArchitecture({
                    calmHubOptions: { calmHubUrl: 'http://hub' },
                    file: 'arch.json',
                    failIfModified: true
                });

                expect(mockClient.getMappedResourceByVersion).not.toHaveBeenCalled();
                expect(mockClient.createMappedResourceVersion).toHaveBeenCalledWith(
                    expect.objectContaining({ version: '1.0.0' }),
                    expect.any(String)
                );
                expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(
                    expect.objectContaining({ status: 'created', version: '1.0.0' })
                );
            });

            it('skips (does not create a new version) when content is unchanged from the latest published version', async () => {
                const { mockClient } = await getSharedMocks();
                vi.mocked(mockClient.getMappedResourceVersions).mockResolvedValue(['1.0.0']);
                // The stored document is the local doc as Hub normalises it on the way in: $id at the
                // latest version and a defaulted empty description. The local file (pushDoc) has no
                // description and is only compared after the same normalisation, so this must match.
                vi.mocked(mockClient.getMappedResourceByVersion).mockResolvedValue({
                    $id: 'http://hub/calm/namespaces/finos/architectures/my-arch/versions/1.0.0',
                    title: 'my-arch',
                    description: '',
                    nodes: []
                });

                await runPushArchitecture({
                    calmHubOptions: { calmHubUrl: 'http://hub' },
                    file: 'arch.json',
                    failIfModified: true
                });

                expect(mockClient.getMappedResourceByVersion).toHaveBeenCalledWith('finos', 'my-arch', '1.0.0', 'architectures');
                expect(mockClient.createMappedResourceVersion).not.toHaveBeenCalled();
                expect(fs.writeFile).not.toHaveBeenCalled();
                expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(
                    expect.objectContaining({ status: 'skipped', version: '1.0.0' })
                );
            });

            it('does not flag a version-only difference (auto-bumped elsewhere) as modified', async () => {
                const { mockClient } = await getSharedMocks();
                // Hub has moved on to 1.1.0; the local file still declares 1.0.0 but the architecture
                // content is identical. Normalising to the latest version must make these compare equal.
                vi.mocked(mockClient.getMappedResourceVersions).mockResolvedValue(['1.0.0', '1.1.0']);
                vi.mocked(mockClient.getMappedResourceByVersion).mockResolvedValue({
                    $id: 'http://hub/calm/namespaces/finos/architectures/my-arch/versions/1.1.0',
                    title: 'my-arch',
                    description: '',
                    nodes: []
                });

                await runPushArchitecture({
                    calmHubOptions: { calmHubUrl: 'http://hub' },
                    file: 'arch.json',
                    failIfModified: true
                });

                expect(mockClient.getMappedResourceByVersion).toHaveBeenCalledWith('finos', 'my-arch', '1.1.0', 'architectures');
                expect(mockClient.createMappedResourceVersion).not.toHaveBeenCalled();
                expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(
                    expect.objectContaining({ status: 'skipped', version: '1.1.0' })
                );
            });

            it('fails clearly when Hub returns an empty body for the latest version', async () => {
                const { mockClient } = await getSharedMocks();
                vi.mocked(mockClient.getMappedResourceVersions).mockResolvedValue(['1.0.0']);
                vi.mocked(mockClient.getMappedResourceByVersion).mockResolvedValue(undefined as unknown as object);

                await expect(runPushArchitecture({
                    calmHubOptions: { calmHubUrl: 'http://hub' },
                    file: 'arch.json',
                    failIfModified: true
                })).rejects.toThrow('process.exit');

                expect(mockClient.createMappedResourceVersion).not.toHaveBeenCalled();
                expect(hubOutput.printError).toHaveBeenCalledWith(
                    0, expect.stringContaining('Could not read the latest published version'), expect.any(String), 'json'
                );
            });

            it('fails when the document has changed relative to the latest published version', async () => {
                const { mockClient } = await getSharedMocks();
                vi.mocked(mockClient.getMappedResourceVersions).mockResolvedValue(['1.0.0']);
                // Latest published version differs from the local document.
                vi.mocked(mockClient.getMappedResourceByVersion).mockResolvedValue({
                    $id: 'http://hub/calm/namespaces/finos/architectures/my-arch/versions/1.0.0',
                    title: 'my-arch',
                    nodes: [{ 'unique-id': 'added-on-disk' }]
                });

                await expect(runPushArchitecture({
                    calmHubOptions: { calmHubUrl: 'http://hub' },
                    file: 'arch.json',
                    failIfModified: true
                })).rejects.toThrow('process.exit');

                expect(mockClient.createMappedResourceVersion).not.toHaveBeenCalled();
                expect(fs.writeFile).not.toHaveBeenCalled();
                expect(hubOutput.printError).toHaveBeenCalledWith(
                    0, expect.stringContaining('has changed relative to the latest published version'), expect.any(String), 'json'
                );
            });
        });
    });

    // ── runPullArchitecture ────────────────────────────────────────────────

    describe('runPullArchitecture', () => {
        it('pulls a specific version by mapping and prints JSON to stdout', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getMappedResourceByVersion).mockResolvedValue({ id: 1, architecture: '{}' });
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(function () { return undefined; });

            await runPullArchitecture({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', mapping: 'my-arch', version: '1.0.0' });

            expect(mockClient.getMappedResourceByVersion).toHaveBeenCalledWith('finos', 'my-arch', '1.0.0', 'architectures');
            expect(mockClient.getMappedResourceLatestVersion).not.toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"id": 1'));
            consoleSpy.mockRestore();
        });

        it('pulls the latest version when no version is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getMappedResourceLatestVersion).mockResolvedValue({ id: 1 });

            await runPullArchitecture({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', mapping: 'my-arch' });

            expect(mockClient.getMappedResourceLatestVersion).toHaveBeenCalledWith('finos', 'my-arch', 'architectures');
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

        it('prints JSON array of architecture ids', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getNamespaceMappings).mockResolvedValue(['arch-a', 'arch-b']);

            await runListArchitectures({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos' });

            expect(mockClient.getNamespaceMappings).toHaveBeenCalledWith('finos', 'architectures');
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(['arch-a', 'arch-b']);
        });

        it('renders a single ID column when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getNamespaceMappings).mockResolvedValue(['arch-a', 'arch-b']);

            await runListArchitectures({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', format: 'pretty' });

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [{ MAPPING: 'arch-a' }, { MAPPING: 'arch-b' }],
                [{ key: 'MAPPING', header: 'MAPPING' }]
            );
        });

        it('exits on HubClientError from getNamespaceMappings', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.getNamespaceMappings).mockRejectedValue(
                new shared.HubClientError(503, 'Service unavailable', 'GET /calm/namespaces/finos/architectures')
            );

            await expect(runListArchitectures({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(503, 'Service unavailable', expect.any(String), 'json');
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

        it('renders table when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.createNamespace).mockResolvedValue({ name: 'my-org', location: '/calm/namespaces/my-org' });

            await runCreateNamespace({ calmHubOptions: { calmHubUrl: 'http://hub' }, name: 'my-org', description: 'My org', format: 'pretty' });

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [{ STATUS: 'Created', ID: 'my-org', LOCATION: '/calm/namespaces/my-org' }],
                expect.arrayContaining([expect.objectContaining({ key: 'STATUS' })])
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

        it('exits on HubClientError from listNamespaces', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.listNamespaces).mockRejectedValue(
                new shared.HubClientError(503, 'Service unavailable', 'GET /api/calm/namespaces')
            );

            await expect(runListNamespaces({ calmHubOptions: { calmHubUrl: 'http://hub' } }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(503, 'Service unavailable', expect.any(String), 'json');
        });
    });

    // ── printPushResult ────────────────────────────────────────────────────

    describe('printPushResult', () => {
        it('calls printTableSuccess with correct columns when format is pretty', async () => {
            printPushResult(
                { status: 'created', mapping: 'my-arch', version: '1.0.0', namespace: 'finos', location: 'http://hub' },
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

        it('shows an Unchanged status for a skipped push', async () => {
            printPushResult(
                { status: 'skipped', mapping: 'my-arch', version: '1.0.0', namespace: 'finos', location: 'http://hub' },
                'pretty'
            );

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [{ STATUS: 'Unchanged', MAPPING: 'my-arch', VERSION: '1.0.0', LOCATION: 'http://hub' }],
                expect.anything()
            );
        });

        it('calls printJsonSuccess when format is json', async () => {
            const result = { status: 'created' as const, mapping: 'my-arch', version: '1.0.0', namespace: 'finos', location: '/loc' };
            printPushResult(result, 'json');

            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(result);
            expect(hubOutput.printTableSuccess).not.toHaveBeenCalled();
        });
    });

    // ── runPushPattern ─────────────────────────────────────────────────────

    describe('runPushPattern', () => {
        it('creates a new mapped pattern version when the mapping has no versions yet', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(fs.readFile).mockResolvedValue(pushDoc('my-pattern', 'patterns') as unknown as Uint8Array);
            vi.mocked(mockClient.createMappedResourceVersion).mockResolvedValue(
                'http://hub/calm/namespaces/finos/patterns/my-pattern/versions/1.0.0'
            );

            const { runPushPattern } = await import('./hub-commands');
            await runPushPattern({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-pattern',
                description: 'desc',
                file: 'pattern.json'
            });

            expect(mockClient.getMappedResourceVersions).toHaveBeenCalledWith('finos', 'my-pattern', 'patterns');
            expect(mockClient.createMappedResourceVersion).toHaveBeenCalledWith(
                expect.objectContaining({
                    namespace: 'finos', mapping: 'my-pattern', type: 'patterns', version: '1.0.0', name: 'my-pattern', description: 'desc'
                }),
                expect.any(String)
            );
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(
                expect.objectContaining({ mapping: 'my-pattern', namespace: 'finos', version: '1.0.0' })
            );
        });

        it('creates a bumped pattern version when versions already exist', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(fs.readFile).mockResolvedValue(pushDoc('my-pattern', 'patterns') as unknown as Uint8Array);
            vi.mocked(mockClient.getMappedResourceVersions).mockResolvedValue(['1.0.0']);
            vi.mocked(mockClient.createMappedResourceVersion).mockResolvedValue(
                'http://hub/calm/namespaces/finos/patterns/my-pattern/versions/2.0.0'
            );

            const { runPushPattern } = await import('./hub-commands');
            await runPushPattern({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                changeType: 'MAJOR',
                file: 'pattern.json'
            });

            expect(mockClient.createMappedResourceVersion).toHaveBeenCalledWith(
                expect.objectContaining({
                    namespace: 'finos', mapping: 'my-pattern', type: 'patterns', version: '2.0.0', name: 'my-pattern', description: ''
                }),
                expect.any(String)
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
            vi.mocked(fs.readFile).mockResolvedValue(pushDoc('my-pattern', 'patterns') as unknown as Uint8Array);
            vi.mocked(mockClient.createMappedResourceVersion).mockRejectedValue(
                new shared.HubClientError(409, 'Pattern already exists', 'POST /calm/namespaces/finos/patterns/my-pattern/versions/1.0.0')
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

            expect(mockClient.getMappedResourceByVersion).toHaveBeenCalledWith('finos', 'my-pattern', '1.0.0', 'patterns');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"id": 10'));
            consoleSpy.mockRestore();
        });

        it('pulls the latest version when no version is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getMappedResourceLatestVersion).mockResolvedValue({ id: 10 });

            const { runPullPattern } = await import('./hub-commands');
            await runPullPattern({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', mapping: 'my-pattern' });

            expect(mockClient.getMappedResourceLatestVersion).toHaveBeenCalledWith('finos', 'my-pattern', 'patterns');
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
        it('prints JSON array of pattern ids', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getNamespaceMappings).mockResolvedValue(['pattern-a', 'pattern-b']);

            const { runListPatterns } = await import('./hub-commands');
            await runListPatterns({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos' });

            expect(mockClient.getNamespaceMappings).toHaveBeenCalledWith('finos', 'patterns');
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(['pattern-a', 'pattern-b']);
        });

        it('renders a single ID column when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getNamespaceMappings).mockResolvedValue(['pattern-a']);

            const { runListPatterns } = await import('./hub-commands');
            await runListPatterns({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', format: 'pretty' });

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [{ MAPPING: 'pattern-a' }],
                [{ key: 'MAPPING', header: 'MAPPING' }]
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
        it('creates a new mapped standard version when the mapping has no versions yet', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(fs.readFile).mockResolvedValue(pushDoc('my-standard', 'standards') as unknown as Uint8Array);
            vi.mocked(mockClient.createMappedResourceVersion).mockResolvedValue(
                'http://hub/calm/namespaces/finos/standards/my-standard/versions/1.0.0'
            );

            const { runPushStandard } = await import('./hub-commands');
            await runPushStandard({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                name: 'my-standard',
                description: 'desc',
                file: 'standard.json'
            });

            expect(mockClient.getMappedResourceVersions).toHaveBeenCalledWith('finos', 'my-standard', 'standards');
            expect(mockClient.createMappedResourceVersion).toHaveBeenCalledWith(
                expect.objectContaining({
                    namespace: 'finos', mapping: 'my-standard', type: 'standards', version: '1.0.0', name: 'my-standard', description: 'desc'
                }),
                expect.any(String)
            );
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(
                expect.objectContaining({ mapping: 'my-standard', namespace: 'finos', version: '1.0.0' })
            );
        });

        it('creates a bumped standard version when versions already exist', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(fs.readFile).mockResolvedValue(pushDoc('my-standard', 'standards') as unknown as Uint8Array);
            vi.mocked(mockClient.getMappedResourceVersions).mockResolvedValue(['1.0.0']);
            vi.mocked(mockClient.createMappedResourceVersion).mockResolvedValue(
                'http://hub/calm/namespaces/finos/standards/my-standard/versions/2.0.0'
            );

            const { runPushStandard } = await import('./hub-commands');
            await runPushStandard({
                calmHubOptions: { calmHubUrl: 'http://hub' },
                namespace: 'finos',
                changeType: 'MAJOR',
                file: 'standard.json'
            });

            expect(mockClient.createMappedResourceVersion).toHaveBeenCalledWith(
                expect.objectContaining({
                    namespace: 'finos', mapping: 'my-standard', type: 'standards', version: '2.0.0', name: 'my-standard', description: ''
                }),
                expect.any(String)
            );
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
                0, 'File is not valid JSON: standard.json', 'push standards standard.json', 'json'
            );
            expect(mockClient.createMappedResourceVersion).not.toHaveBeenCalled();
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
            vi.mocked(fs.readFile).mockResolvedValue(pushDoc('my-standard', 'standards') as unknown as Uint8Array);
            vi.mocked(mockClient.createMappedResourceVersion).mockRejectedValue(
                new shared.HubClientError(409, 'Standard already exists', 'POST /calm/namespaces/finos/standards/my-standard/versions/1.0.0')
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

            expect(mockClient.getMappedResourceByVersion).toHaveBeenCalledWith('finos', 'my-standard', '1.0.0', 'standards');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"id": 20'));
            consoleSpy.mockRestore();
        });

        it('pulls the latest version when no version is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getMappedResourceLatestVersion).mockResolvedValue({ id: 20 });

            const { runPullStandard } = await import('./hub-commands');
            await runPullStandard({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', mapping: 'my-standard' });

            expect(mockClient.getMappedResourceLatestVersion).toHaveBeenCalledWith('finos', 'my-standard', 'standards');
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
        it('prints JSON array of standard ids', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getNamespaceMappings).mockResolvedValue(['standard-a', 'standard-b']);

            const { runListStandards } = await import('./hub-commands');
            await runListStandards({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos' });

            expect(mockClient.getNamespaceMappings).toHaveBeenCalledWith('finos', 'standards');
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(['standard-a', 'standard-b']);
        });

        it('renders a single ID column when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getNamespaceMappings).mockResolvedValue(['standard-a']);

            const { runListStandards } = await import('./hub-commands');
            await runListStandards({ calmHubOptions: { calmHubUrl: 'http://hub' }, namespace: 'finos', format: 'pretty' });

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [{ MAPPING: 'standard-a' }],
                [{ key: 'MAPPING', header: 'MAPPING' }]
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

        it('exits on HubClientError from listDomains', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.listDomains).mockRejectedValue(
                new shared.HubClientError(503, 'Service unavailable', 'GET /calm/domains')
            );

            await expect(runListDomains({ calmHubOptions: { calmHubUrl: 'http://hub' } }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(503, 'Service unavailable', expect.any(String), 'json');
        });
    });

    // ── control document fixtures ──────────────────────────────────────────────

    const reqId = (version: string) => `http://hub/calm/domains/security/controls/access-control/requirement/versions/${version}`;
    const cfgId = (version: string) => `http://hub/calm/domains/security/controls/access-control/configurations/prod/versions/${version}`;
    const controlReqDoc = (version = '1.0.0') => JSON.stringify({ $id: reqId(version), nodes: [] });
    const controlConfigDoc = (version = '1.0.0') => JSON.stringify({ $id: cfgId(version), nodes: [] });

    // ── runPushControlRequirement ──────────────────────────────────────────────

    describe('runPushControlRequirement', () => {
        it('creates version 1.0.0 when the requirement has no versions yet', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(fs.readFile).mockResolvedValue(controlReqDoc() as unknown as Uint8Array);
            vi.mocked(mockClient.getControlRequirementVersions).mockResolvedValue([]);
            vi.mocked(mockClient.createControlRequirementVersion).mockResolvedValue(reqId('1.0.0'));

            await runPushControlRequirement({ calmHubOptions: { calmHubUrl: 'http://hub' }, file: 'req.json' });

            expect(mockClient.getControlRequirementVersions).toHaveBeenCalledWith('security', 'access-control');
            expect(mockClient.createControlRequirementVersion).toHaveBeenCalledWith('security', 'access-control', '1.0.0', expect.any(String));
            expect(fs.writeFile).toHaveBeenCalledWith('req.json', expect.stringContaining('/requirement/versions/1.0.0'), 'utf-8');
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(
                expect.objectContaining({ domain: 'security', controlName: 'access-control', version: '1.0.0' })
            );
        });

        it('bumps the version when versions already exist', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(fs.readFile).mockResolvedValue(controlReqDoc() as unknown as Uint8Array);
            vi.mocked(mockClient.getControlRequirementVersions).mockResolvedValue(['1.0.0']);
            vi.mocked(mockClient.createControlRequirementVersion).mockResolvedValue(reqId('2.0.0'));

            await runPushControlRequirement({ calmHubOptions: { calmHubUrl: 'http://hub' }, file: 'req.json', changeType: 'MAJOR' });

            expect(mockClient.createControlRequirementVersion).toHaveBeenCalledWith('security', 'access-control', '2.0.0', expect.any(String));
        });

        it('prints table when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(fs.readFile).mockResolvedValue(controlReqDoc() as unknown as Uint8Array);
            vi.mocked(mockClient.getControlRequirementVersions).mockResolvedValue([]);
            vi.mocked(mockClient.createControlRequirementVersion).mockResolvedValue(reqId('1.0.0'));

            await runPushControlRequirement({ calmHubOptions: { calmHubUrl: 'http://hub' }, file: 'req.json', format: 'pretty' });

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({ STATUS: 'Created', DOMAIN: 'security', CONTROL: 'access-control', VERSION: '1.0.0' })]),
                expect.arrayContaining([expect.objectContaining({ key: 'DOMAIN' })])
            );
        });

        it('exits when the document $id describes a configuration, not a requirement', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(controlConfigDoc() as unknown as Uint8Array);

            await expect(runPushControlRequirement({ calmHubOptions: { calmHubUrl: 'http://hub' }, file: 'req.json' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, expect.stringContaining('describes a control configuration, but a control requirement was expected'), expect.any(String), 'json'
            );
        });

        it('exits when the document has no parseable control $id', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ nodes: [] }) as unknown as Uint8Array);

            await expect(runPushControlRequirement({ calmHubOptions: { calmHubUrl: 'http://hub' }, file: 'req.json' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, expect.stringContaining('Failed to extract control document metadata'), expect.any(String), 'json'
            );
        });

        it('exits on HubClientError', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(fs.readFile).mockResolvedValue(controlReqDoc() as unknown as Uint8Array);
            vi.mocked(mockClient.getControlRequirementVersions).mockResolvedValue([]);
            vi.mocked(mockClient.createControlRequirementVersion).mockRejectedValue(
                new shared.HubClientError(409, 'Version already exists', 'POST /calm/domains/security/controls/access-control/requirement/versions/1.0.0')
            );

            await expect(runPushControlRequirement({ calmHubOptions: { calmHubUrl: 'http://hub' }, file: 'req.json' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(409, 'Version already exists', expect.any(String), 'json');
        });

        describe('--fail-if-modified', () => {
            it('creates 1.0.0 for a brand-new requirement even with the flag set', async () => {
                const { mockClient } = await getSharedMocks();
                vi.mocked(fs.readFile).mockResolvedValue(controlReqDoc() as unknown as Uint8Array);
                vi.mocked(mockClient.getControlRequirementVersions).mockResolvedValue([]);
                vi.mocked(mockClient.createControlRequirementVersion).mockResolvedValue(reqId('1.0.0'));

                await runPushControlRequirement({ calmHubOptions: { calmHubUrl: 'http://hub' }, file: 'req.json', failIfModified: true });

                expect(mockClient.getControlRequirementVersion).not.toHaveBeenCalled();
                expect(mockClient.createControlRequirementVersion).toHaveBeenCalledWith('security', 'access-control', '1.0.0', expect.any(String));
            });

            it('skips when the requirement is unchanged from the latest published version', async () => {
                const { mockClient } = await getSharedMocks();
                vi.mocked(fs.readFile).mockResolvedValue(controlReqDoc() as unknown as Uint8Array);
                vi.mocked(mockClient.getControlRequirementVersions).mockResolvedValue(['1.0.0']);
                // Stored doc normalised to its latest version (only the $id version differs from disk).
                vi.mocked(mockClient.getControlRequirementVersion).mockResolvedValue({ $id: reqId('1.0.0'), nodes: [] });

                await runPushControlRequirement({ calmHubOptions: { calmHubUrl: 'http://hub' }, file: 'req.json', failIfModified: true });

                expect(mockClient.getControlRequirementVersion).toHaveBeenCalledWith('security', 'access-control', '1.0.0');
                expect(mockClient.createControlRequirementVersion).not.toHaveBeenCalled();
                expect(fs.writeFile).not.toHaveBeenCalled();
                expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(
                    expect.objectContaining({ status: 'skipped', version: '1.0.0' })
                );
            });

            it('fails when the requirement has changed relative to the latest published version', async () => {
                const { mockClient } = await getSharedMocks();
                vi.mocked(fs.readFile).mockResolvedValue(controlReqDoc() as unknown as Uint8Array);
                vi.mocked(mockClient.getControlRequirementVersions).mockResolvedValue(['1.0.0']);
                vi.mocked(mockClient.getControlRequirementVersion).mockResolvedValue({ $id: reqId('1.0.0'), nodes: [{ 'unique-id': 'changed' }] });

                await expect(runPushControlRequirement({ calmHubOptions: { calmHubUrl: 'http://hub' }, file: 'req.json', failIfModified: true }))
                    .rejects.toThrow('process.exit');

                expect(mockClient.createControlRequirementVersion).not.toHaveBeenCalled();
                expect(hubOutput.printError).toHaveBeenCalledWith(
                    0, expect.stringContaining('has changed relative to the latest published version'), expect.any(String), 'json'
                );
            });
        });
    });

    // ── runPushControlConfiguration ────────────────────────────────────────────

    describe('runPushControlConfiguration', () => {
        it('creates version 1.0.0 when the configuration has no versions yet', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(fs.readFile).mockResolvedValue(controlConfigDoc() as unknown as Uint8Array);
            vi.mocked(mockClient.getControlConfigurationVersions).mockResolvedValue([]);
            vi.mocked(mockClient.createControlConfigurationVersion).mockResolvedValue(cfgId('1.0.0'));

            await runPushControlConfiguration({ calmHubOptions: { calmHubUrl: 'http://hub' }, file: 'config.json' });

            expect(mockClient.getControlConfigurationVersions).toHaveBeenCalledWith('security', 'access-control', 'prod');
            expect(mockClient.createControlConfigurationVersion).toHaveBeenCalledWith('security', 'access-control', 'prod', '1.0.0', expect.any(String));
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(
                expect.objectContaining({ domain: 'security', controlName: 'access-control', configName: 'prod', version: '1.0.0' })
            );
        });

        it('bumps the version when versions already exist', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(fs.readFile).mockResolvedValue(controlConfigDoc() as unknown as Uint8Array);
            vi.mocked(mockClient.getControlConfigurationVersions).mockResolvedValue(['1.0.0']);
            vi.mocked(mockClient.createControlConfigurationVersion).mockResolvedValue(cfgId('2.0.0'));

            await runPushControlConfiguration({ calmHubOptions: { calmHubUrl: 'http://hub' }, file: 'config.json', changeType: 'MAJOR' });

            expect(mockClient.createControlConfigurationVersion).toHaveBeenCalledWith('security', 'access-control', 'prod', '2.0.0', expect.any(String));
        });

        it('prints table with CONFIG column when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(fs.readFile).mockResolvedValue(controlConfigDoc() as unknown as Uint8Array);
            vi.mocked(mockClient.getControlConfigurationVersions).mockResolvedValue([]);
            vi.mocked(mockClient.createControlConfigurationVersion).mockResolvedValue(cfgId('1.0.0'));

            await runPushControlConfiguration({ calmHubOptions: { calmHubUrl: 'http://hub' }, file: 'config.json', format: 'pretty' });

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({ STATUS: 'Created', DOMAIN: 'security', CONTROL: 'access-control', CONFIG: 'prod', VERSION: '1.0.0' })]),
                expect.arrayContaining([expect.objectContaining({ key: 'CONFIG' })])
            );
        });

        it('exits when the document $id describes a requirement, not a configuration', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(controlReqDoc() as unknown as Uint8Array);

            await expect(runPushControlConfiguration({ calmHubOptions: { calmHubUrl: 'http://hub' }, file: 'config.json' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, expect.stringContaining('describes a control requirement, but a control configuration was expected'), expect.any(String), 'json'
            );
        });

        describe('--fail-if-modified', () => {
            it('skips when the configuration is unchanged from the latest published version', async () => {
                const { mockClient } = await getSharedMocks();
                vi.mocked(fs.readFile).mockResolvedValue(controlConfigDoc() as unknown as Uint8Array);
                vi.mocked(mockClient.getControlConfigurationVersions).mockResolvedValue(['1.0.0']);
                vi.mocked(mockClient.getControlConfigurationVersion).mockResolvedValue({ $id: cfgId('1.0.0'), nodes: [] });

                await runPushControlConfiguration({ calmHubOptions: { calmHubUrl: 'http://hub' }, file: 'config.json', failIfModified: true });

                expect(mockClient.getControlConfigurationVersion).toHaveBeenCalledWith('security', 'access-control', 'prod', '1.0.0');
                expect(mockClient.createControlConfigurationVersion).not.toHaveBeenCalled();
                expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(
                    expect.objectContaining({ status: 'skipped', configName: 'prod', version: '1.0.0' })
                );
            });

            it('fails when the configuration has changed relative to the latest published version', async () => {
                const { mockClient } = await getSharedMocks();
                vi.mocked(fs.readFile).mockResolvedValue(controlConfigDoc() as unknown as Uint8Array);
                vi.mocked(mockClient.getControlConfigurationVersions).mockResolvedValue(['1.0.0']);
                vi.mocked(mockClient.getControlConfigurationVersion).mockResolvedValue({ $id: cfgId('1.0.0'), nodes: [{ 'unique-id': 'changed' }] });

                await expect(runPushControlConfiguration({ calmHubOptions: { calmHubUrl: 'http://hub' }, file: 'config.json', failIfModified: true }))
                    .rejects.toThrow('process.exit');

                expect(mockClient.createControlConfigurationVersion).not.toHaveBeenCalled();
                expect(hubOutput.printError).toHaveBeenCalledWith(
                    0, expect.stringContaining('has changed relative to the latest published version'), expect.any(String), 'json'
                );
            });
        });
    });

    // ── runPullControlRequirement ──────────────────────────────────────────────

    describe('runPullControlRequirement', () => {
        it('pulls the latest version when no version is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getControlRequirementVersions).mockResolvedValue(['1.0.0', '2.0.0']);
            vi.mocked(mockClient.getControlRequirementVersion).mockResolvedValue({ id: 1 });
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(function () { return undefined; });

            await runPullControlRequirement({ calmHubOptions: { calmHubUrl: 'http://hub' }, domain: 'security', controlName: 'access-control' });

            expect(mockClient.getControlRequirementVersion).toHaveBeenCalledWith('security', 'access-control', '2.0.0');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"id": 1'));
            consoleSpy.mockRestore();
        });

        it('pulls a specific version when provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getControlRequirementVersion).mockResolvedValue({ id: 1 });

            await runPullControlRequirement({ calmHubOptions: { calmHubUrl: 'http://hub' }, domain: 'security', controlName: 'access-control', version: '1.0.0' });

            expect(mockClient.getControlRequirementVersion).toHaveBeenCalledWith('security', 'access-control', '1.0.0');
            expect(mockClient.getControlRequirementVersions).not.toHaveBeenCalled();
        });

        it('writes to file when --output is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getControlRequirementVersion).mockResolvedValue({ id: 1 });

            await runPullControlRequirement({ calmHubOptions: { calmHubUrl: 'http://hub' }, domain: 'security', controlName: 'access-control', version: '1.0.0', output: 'out.json' });

            expect(fs.writeFile).toHaveBeenCalledWith('out.json', expect.any(String), 'utf-8');
        });

        it('exits when there are no versions to pull', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getControlRequirementVersions).mockResolvedValue([]);

            await expect(runPullControlRequirement({ calmHubOptions: { calmHubUrl: 'http://hub' }, domain: 'security', controlName: 'access-control' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalled();
        });

        it('exits on HubClientError', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.getControlRequirementVersion).mockRejectedValue(
                new shared.HubClientError(404, 'Not found', 'GET /calm/domains/security/controls/access-control/requirement/versions/1.0.0')
            );

            await expect(runPullControlRequirement({ calmHubOptions: { calmHubUrl: 'http://hub' }, domain: 'security', controlName: 'access-control', version: '1.0.0' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(404, 'Not found', expect.any(String), 'json');
        });
    });

    // ── runPullControlConfiguration ────────────────────────────────────────────

    describe('runPullControlConfiguration', () => {
        it('pulls the latest version when no version is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getControlConfigurationVersions).mockResolvedValue(['1.0.0', '2.0.0']);
            vi.mocked(mockClient.getControlConfigurationVersion).mockResolvedValue({ id: 5 });

            await runPullControlConfiguration({ calmHubOptions: { calmHubUrl: 'http://hub' }, domain: 'security', controlName: 'access-control', configName: 'prod' });

            expect(mockClient.getControlConfigurationVersion).toHaveBeenCalledWith('security', 'access-control', 'prod', '2.0.0');
        });

        it('pulls a specific version when provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.getControlConfigurationVersion).mockResolvedValue({ id: 5 });

            await runPullControlConfiguration({ calmHubOptions: { calmHubUrl: 'http://hub' }, domain: 'security', controlName: 'access-control', configName: 'prod', version: '1.0.0' });

            expect(mockClient.getControlConfigurationVersion).toHaveBeenCalledWith('security', 'access-control', 'prod', '1.0.0');
            expect(mockClient.getControlConfigurationVersions).not.toHaveBeenCalled();
        });

        it('exits on HubClientError', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.getControlConfigurationVersion).mockRejectedValue(
                new shared.HubClientError(404, 'Not found', 'GET /calm/domains/security/controls/access-control/configurations/prod/versions/1.0.0')
            );

            await expect(runPullControlConfiguration({ calmHubOptions: { calmHubUrl: 'http://hub' }, domain: 'security', controlName: 'access-control', configName: 'prod', version: '1.0.0' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(404, 'Not found', expect.any(String), 'json');
        });
    });

    // ── runListControls ────────────────────────────────────────────────────────

    describe('runListControls', () => {
        it('prints JSON array of control summaries', async () => {
            const { mockClient } = await getSharedMocks();
            const controls = [{ id: 19, name: 'rate-limit', description: 'rate limit is needed' }];
            vi.mocked(mockClient.listControls).mockResolvedValue(controls);

            await runListControls({ calmHubOptions: { calmHubUrl: 'http://hub' }, domain: 'security' });

            expect(mockClient.listControls).toHaveBeenCalledWith('security');
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(controls);
        });

        it('renders a NAME/ID/DESCRIPTION table when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listControls).mockResolvedValue([{ id: 19, name: 'rate-limit', description: 'rate limit is needed' }]);

            await runListControls({ calmHubOptions: { calmHubUrl: 'http://hub' }, domain: 'security', format: 'pretty' });

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [{ NAME: 'rate-limit', ID: 19, DESCRIPTION: 'rate limit is needed' }],
                [
                    { key: 'NAME', header: 'NAME' },
                    { key: 'ID', header: 'ID' },
                    { key: 'DESCRIPTION', header: 'DESCRIPTION' }
                ]
            );
        });

        it('exits when no hub URL is available', async () => {
            await expect(runListControls({ calmHubOptions: {}, domain: 'security' })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalled();
        });

        it('exits on HubClientError', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.listControls).mockRejectedValue(
                new shared.HubClientError(500, 'Internal server error', 'GET /calm/domains/security/controls')
            );

            await expect(runListControls({ calmHubOptions: { calmHubUrl: 'http://hub' }, domain: 'security' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(500, 'Internal server error', expect.any(String), 'json');
        });
    });

    // ── runListControlConfigurations ───────────────────────────────────────────

    describe('runListControlConfigurations', () => {
        it('prints JSON array of configuration summaries', async () => {
            const { mockClient } = await getSharedMocks();
            const configs = [{ id: 1, name: 'prod' }, { id: 2, name: 'dev' }];
            vi.mocked(mockClient.listControlConfigurations).mockResolvedValue(configs);

            await runListControlConfigurations({ calmHubOptions: { calmHubUrl: 'http://hub' }, domain: 'security', controlName: 'access-control' });

            expect(mockClient.listControlConfigurations).toHaveBeenCalledWith('security', 'access-control');
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(configs);
        });

        it('renders a NAME/ID/DESCRIPTION table when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listControlConfigurations).mockResolvedValue([{ id: 1, name: 'prod' }]);

            await runListControlConfigurations({ calmHubOptions: { calmHubUrl: 'http://hub' }, domain: 'security', controlName: 'access-control', format: 'pretty' });

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [{ NAME: 'prod', ID: 1, DESCRIPTION: '' }],
                [
                    { key: 'NAME', header: 'NAME' },
                    { key: 'ID', header: 'ID' },
                    { key: 'DESCRIPTION', header: 'DESCRIPTION' }
                ]
            );
        });

        it('exits on HubClientError', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.listControlConfigurations).mockRejectedValue(
                new shared.HubClientError(500, 'Internal server error', 'GET /calm/domains/security/controls/access-control/configurations')
            );

            await expect(runListControlConfigurations({ calmHubOptions: { calmHubUrl: 'http://hub' }, domain: 'security', controlName: 'access-control' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(500, 'Internal server error', expect.any(String), 'json');
        });
    });

});
