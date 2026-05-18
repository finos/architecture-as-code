import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as cliConfig from '../cli-config';
import * as hubOutput from './hub-output';

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
        pullStandard: vi.fn()
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

    describe('resolveHubUrl', () => {
        it('uses options.calmHubUrl when provided', async () => {
            const { resolveHubUrl } = await import('./hub-commands');
            const url = await resolveHubUrl({ calmHubUrl: 'http://hub.example.com' });
            expect(url).toBe('http://hub.example.com');
        });

        it('falls back to ~/.calm.json calmHubUrl', async () => {
            vi.mocked(cliConfig.loadCliConfig).mockResolvedValue({ calmHubUrl: 'http://from-config.example.com' });
            const { resolveHubUrl } = await import('./hub-commands');
            const url = await resolveHubUrl({});
            expect(url).toBe('http://from-config.example.com');
        });

        it('throws when no hub URL is available', async () => {
            const { resolveHubUrl } = await import('./hub-commands');
            await expect(resolveHubUrl({})).rejects.toMatchObject({
                name: 'HubCommandError',
                status: 0,
                error: 'No CALM Hub URL provided. Use --calm-hub-url or set calmHubUrl in ~/.calm.json',
                request: 'resolve hub URL'
            });
            expect(hubOutput.printError).not.toHaveBeenCalled();
            expect(exitSpy).not.toHaveBeenCalled();
        });
    });

    // ── runPushArchitecture ────────────────────────────────────────────────

    describe('runPushArchitecture', () => {
        it('calls pushArchitecture and prints JSON result', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pushArchitecture).mockResolvedValue({
                id: 1, version: '1.0.0', location: '/calm/namespaces/finos/architectures/1/versions/1.0.0'
            });

            const { runPushArchitecture } = await import('./hub-commands');
            await runPushArchitecture({
                calmHubUrl: 'http://hub',
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

            const { runPushArchitecture } = await import('./hub-commands');
            await runPushArchitecture({
                calmHubUrl: 'http://hub',
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
            const { runPushArchitecture } = await import('./hub-commands');
            await expect(runPushArchitecture({
                calmHubUrl: 'http://hub',
                namespace: 'finos',
                name: 'my-arch',
                file: 'arch.json',
                id: '42'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalled();
        });

        it('exits with error when --id is not a valid integer', async () => {
            const { runPushArchitecture } = await import('./hub-commands');
            await expect(runPushArchitecture({
                calmHubUrl: 'http://hub',
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
            const { runPushArchitecture } = await import('./hub-commands');
            await expect(runPushArchitecture({
                calmHubUrl: 'http://hub',
                namespace: 'finos',
                file: 'arch.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalled();
        });

        it('exits with error when --description is missing and no --id is provided', async () => {
            const { runPushArchitecture } = await import('./hub-commands');
            await expect(runPushArchitecture({
                calmHubUrl: 'http://hub',
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

            const { runPushArchitecture } = await import('./hub-commands');
            await runPushArchitecture({
                calmHubUrl: 'http://hub',
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
            const { runPushArchitecture } = await import('./hub-commands');
            await expect(runPushArchitecture({
                calmHubUrl: 'http://hub',
                namespace: 'finos',
                name: 'my-arch',
                description: 'desc',
                file: 'missing.json'
            })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalled();
        });

        it('exits when file is not valid JSON', async () => {
            vi.mocked(fs.readFile).mockResolvedValue('not json' as unknown as Uint8Array);
            const { runPushArchitecture } = await import('./hub-commands');
            await expect(runPushArchitecture({
                calmHubUrl: 'http://hub',
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

            const { runPushArchitecture } = await import('./hub-commands');
            await runPushArchitecture({
                calmHubUrl: 'http://hub',
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

            const { runPushArchitecture } = await import('./hub-commands');
            await expect(runPushArchitecture({
                calmHubUrl: 'http://hub',
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

            const { runPullArchitecture } = await import('./hub-commands');
            await runPullArchitecture({ calmHubUrl: 'http://hub', namespace: 'finos', id: '1', version: '1.0.0' });

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"id": 1'));
            consoleSpy.mockRestore();
        });

        it('writes to file when --output is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pullArchitecture).mockResolvedValue({ id: 1 });

            const { runPullArchitecture } = await import('./hub-commands');
            await runPullArchitecture({ calmHubUrl: 'http://hub', namespace: 'finos', id: '1', version: '1.0.0', output: 'out.json' });

            expect(fs.writeFile).toHaveBeenCalledWith('out.json', expect.any(String), 'utf-8');
        });

        it('exits on HubClientError', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.pullArchitecture).mockRejectedValue(
                new shared.HubClientError(404, 'Not found', 'GET /calm/namespaces/finos/architectures/99/versions/1.0.0')
            );

            const { runPullArchitecture } = await import('./hub-commands');
            await expect(runPullArchitecture({ calmHubUrl: 'http://hub', namespace: 'finos', id: '99', version: '1.0.0' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(404, 'Not found', expect.any(String), 'json');
        });

        it('exits with error when --id is not a valid integer', async () => {
            const { runPullArchitecture } = await import('./hub-commands');
            await expect(runPullArchitecture({ calmHubUrl: 'http://hub', namespace: 'finos', id: 'not-a-number', version: '1.0.0' }))
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
            const { runListArchitectures } = await import('./hub-commands');
            await expect(runListArchitectures({ namespace: 'finos', format: 'pretty' }))
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

            const { runListArchitectures } = await import('./hub-commands');
            await runListArchitectures({ calmHubUrl: 'http://hub', namespace: 'finos' });

            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith([{ id: 1, name: 'arch-a', versions: ['1.0.0'] }]);
        });

        it('renders table when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listArchitectures).mockResolvedValue([
                { id: 1, name: 'arch-a', versions: ['1.0.0', '1.1.0'] }
            ]);

            const { runListArchitectures } = await import('./hub-commands');
            await runListArchitectures({ calmHubUrl: 'http://hub', namespace: 'finos', format: 'pretty' });

            expect(hubOutput.printTableSuccess).toHaveBeenCalled();
        });
    });

    // ── runCreateNamespace ─────────────────────────────────────────────────

    describe('runCreateNamespace', () => {
        it('calls createNamespace and prints result', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.createNamespace).mockResolvedValue({ name: 'my-org', location: '/calm/namespaces/my-org' });

            const { runCreateNamespace } = await import('./hub-commands');
            await runCreateNamespace({ calmHubUrl: 'http://hub', name: 'my-org', description: 'My org' });

            expect(mockClient.createNamespace).toHaveBeenCalledWith('my-org', 'My org');
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith({ name: 'my-org', location: '/calm/namespaces/my-org' });
        });

        it('exits on 409 conflict', async () => {
            const { mockClient, shared } = await getSharedMocks();
            vi.mocked(mockClient.createNamespace).mockRejectedValue(
                new shared.HubClientError(409, 'Namespace already exists', 'POST /calm/namespaces')
            );

            const { runCreateNamespace } = await import('./hub-commands');
            await expect(runCreateNamespace({ calmHubUrl: 'http://hub', name: 'my-org', description: 'My org' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(409, 'Namespace already exists', expect.any(String), 'json');
        });

        it('exits when description is missing', async () => {
            const { runCreateNamespace } = await import('./hub-commands');
            await expect(runCreateNamespace({ calmHubUrl: 'http://hub', name: 'my-org' }))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0,
                '--description is required and must not be blank',
                'unknown',
                'json'
            );
        });

        it('exits when description is blank', async () => {
            const { runCreateNamespace } = await import('./hub-commands');
            await expect(runCreateNamespace({ calmHubUrl: 'http://hub', name: 'my-org', description: '   ' }))
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
            const { runListNamespaces } = await import('./hub-commands');
            await expect(runListNamespaces({})).rejects.toThrow('process.exit');
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

            const { runListNamespaces } = await import('./hub-commands');
            await runListNamespaces({ calmHubUrl: 'http://hub' });

            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith([{ name: 'finos', description: 'FINOS' }]);
        });

        it('renders table when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listNamespaces).mockResolvedValue([{ name: 'finos', description: '' }]);

            const { runListNamespaces } = await import('./hub-commands');
            await runListNamespaces({ calmHubUrl: 'http://hub', format: 'pretty' });

            expect(hubOutput.printTableSuccess).toHaveBeenCalled();
        });
    });

    // ── printPushResult ────────────────────────────────────────────────────

    describe('printPushResult', () => {
        it('calls printTableSuccess with correct columns when format is pretty', async () => {
            const { printPushResult } = await import('./hub-commands');
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
            const { printPushResult } = await import('./hub-commands');
            printPushResult({ id: 2, location: '/calm/namespaces/finos/architectures/2' }, 'pretty');

            expect(hubOutput.printTableSuccess).toHaveBeenCalledWith(
                [expect.objectContaining({ VERSION: '' })],
                expect.any(Array)
            );
        });

        it('calls printJsonSuccess when format is json', async () => {
            const { printPushResult } = await import('./hub-commands');
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
            const { resolveVersionedMetadata } = await import('./hub-commands');

            const result = await resolveVersionedMetadata(mockClient, 'finos', 1, 'my-arch', 'my-desc', 'json');

            expect(result).toEqual({ name: 'my-arch', description: 'my-desc' });
            expect(mockClient.listArchitectures).not.toHaveBeenCalled();
        });

        it('fetches from Hub when name is absent', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listArchitectures).mockResolvedValue([
                { id: 1, name: 'fetched-arch', description: 'fetched-desc', versions: ['1.0.0'] }
            ]);
            const { resolveVersionedMetadata } = await import('./hub-commands');

            const result = await resolveVersionedMetadata(mockClient, 'finos', 1, undefined, 'my-desc', 'json');

            expect(mockClient.listArchitectures).toHaveBeenCalledWith('finos');
            expect(result).toEqual({ name: 'fetched-arch', description: 'my-desc' });
        });

        it('fetches from Hub when description is absent', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listArchitectures).mockResolvedValue([
                { id: 1, name: 'fetched-arch', description: 'fetched-desc', versions: ['1.0.0'] }
            ]);
            const { resolveVersionedMetadata } = await import('./hub-commands');

            const result = await resolveVersionedMetadata(mockClient, 'finos', 1, 'my-arch', undefined, 'json');

            expect(mockClient.listArchitectures).toHaveBeenCalledWith('finos');
            expect(result).toEqual({ name: 'my-arch', description: 'fetched-desc' });
        });

        it('exits when architecture ID is not found in namespace', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listArchitectures).mockResolvedValue([
                { id: 99, name: 'other-arch', description: 'other', versions: ['1.0.0'] }
            ]);
            const { resolveVersionedMetadata } = await import('./hub-commands');

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
            const { resolveVersionedMetadata } = await import('./hub-commands');

            await expect(resolveVersionedMetadata(mockClient, 'finos', 1, undefined, undefined, 'json'))
                .rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(500, 'Server error', expect.any(String), 'json');
        });
    });

    // ── pushVersioned ──────────────────────────────────────────────────────

    describe('pushVersioned', () => {
        it('exits when --version is missing', async () => {
            const { mockClient } = await getSharedMocks();
            const { pushVersioned } = await import('./hub-commands');

            await expect(pushVersioned(
                mockClient,
                { namespace: 'finos', file: 'arch.json', id: '1' },
                '{}',
                'json'
            )).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalledWith(
                0, '--version is required when --id is provided', 'push architecture', 'json'
            );
        });

        it('exits when --id is not a valid integer', async () => {
            const { mockClient } = await getSharedMocks();
            const { pushVersioned } = await import('./hub-commands');

            await expect(pushVersioned(
                mockClient,
                { namespace: 'finos', file: 'arch.json', id: 'not-a-number', version: '1.0.0' },
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
            const { pushVersioned } = await import('./hub-commands');

            const result = await pushVersioned(
                mockClient,
                { namespace: 'finos', file: 'arch.json', id: '5', version: '2.0.0', name: 'my-arch', description: 'desc' },
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
                calmHubUrl: 'http://hub',
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
                calmHubUrl: 'http://hub',
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
                calmHubUrl: 'http://hub',
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
                calmHubUrl: 'http://hub',
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
                calmHubUrl: 'http://hub',
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
                calmHubUrl: 'http://hub',
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
                calmHubUrl: 'http://hub',
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
                calmHubUrl: 'http://hub',
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
                calmHubUrl: 'http://hub',
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
            await runPullPattern({ calmHubUrl: 'http://hub', namespace: 'finos', id: '10', version: '1.0.0' });

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"id": 10'));
            consoleSpy.mockRestore();
        });

        it('writes to file when --output is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pullPattern).mockResolvedValue({ id: 10 });

            const { runPullPattern } = await import('./hub-commands');
            await runPullPattern({ calmHubUrl: 'http://hub', namespace: 'finos', id: '10', version: '1.0.0', output: 'out.json' });

            expect(fs.writeFile).toHaveBeenCalledWith('out.json', expect.any(String), 'utf-8');
        });

        it('exits with error when --id is not a valid integer', async () => {
            const { runPullPattern } = await import('./hub-commands');
            await expect(runPullPattern({ calmHubUrl: 'http://hub', namespace: 'finos', id: 'bad', version: '1.0.0' }))
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
            await expect(runPullPattern({ calmHubUrl: 'http://hub', namespace: 'finos', id: '99', version: '1.0.0' }))
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
            await runListPatterns({ calmHubUrl: 'http://hub', namespace: 'finos' });

            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith([{ id: 1, name: 'pattern-a', versions: ['1.0.0'] }]);
        });

        it('renders table with ID, NAME, VERSIONS when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listPatterns).mockResolvedValue([
                { id: 1, name: 'pattern-a', versions: ['1.0.0', '2.0.0'] }
            ]);

            const { runListPatterns } = await import('./hub-commands');
            await runListPatterns({ calmHubUrl: 'http://hub', namespace: 'finos', format: 'pretty' });

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
            await expect(runListPatterns({ namespace: 'finos' })).rejects.toThrow('process.exit');
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
                calmHubUrl: 'http://hub',
                namespace: 'finos',
                name: 'my-standard',
                description: 'desc',
                file: 'standard.txt'
            });

            expect(mockClient.pushStandard).toHaveBeenCalledWith('finos', 'my-standard', 'desc', expect.any(String));
            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 20, version: '1.0.0' }));
        });

        it('does NOT validate the standard file as JSON (raw content is allowed)', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(fs.readFile).mockResolvedValue('not valid json content' as unknown as Uint8Array);
            vi.mocked(mockClient.pushStandard).mockResolvedValue({
                id: 20, version: '1.0.0', location: '/calm/namespaces/finos/standards/20/versions/1.0.0'
            });

            const { runPushStandard } = await import('./hub-commands');
            await runPushStandard({
                calmHubUrl: 'http://hub',
                namespace: 'finos',
                name: 'my-standard',
                description: 'desc',
                file: 'standard.txt'
            });

            // Should NOT exit with error — raw content is valid for standards
            expect(mockClient.pushStandard).toHaveBeenCalledWith('finos', 'my-standard', 'desc', 'not valid json content');
        });

        it('calls pushStandardVersion when --id is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pushStandardVersion).mockResolvedValue({
                id: 20, version: '2.0.0', location: '/calm/namespaces/finos/standards/20/versions/2.0.0'
            });

            const { runPushStandard } = await import('./hub-commands');
            await runPushStandard({
                calmHubUrl: 'http://hub',
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
                calmHubUrl: 'http://hub',
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
                calmHubUrl: 'http://hub',
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
                calmHubUrl: 'http://hub',
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
                calmHubUrl: 'http://hub',
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
                calmHubUrl: 'http://hub',
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
                calmHubUrl: 'http://hub',
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
            await runPullStandard({ calmHubUrl: 'http://hub', namespace: 'finos', id: '20', version: '1.0.0' });

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"id": 20'));
            consoleSpy.mockRestore();
        });

        it('writes to file when --output is provided', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.pullStandard).mockResolvedValue({ id: 20 });

            const { runPullStandard } = await import('./hub-commands');
            await runPullStandard({ calmHubUrl: 'http://hub', namespace: 'finos', id: '20', version: '1.0.0', output: 'out.txt' });

            expect(fs.writeFile).toHaveBeenCalledWith('out.txt', expect.any(String), 'utf-8');
        });

        it('exits with error when --id is not a valid integer', async () => {
            const { runPullStandard } = await import('./hub-commands');
            await expect(runPullStandard({ calmHubUrl: 'http://hub', namespace: 'finos', id: 'bad', version: '1.0.0' }))
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
            await expect(runPullStandard({ calmHubUrl: 'http://hub', namespace: 'finos', id: '99', version: '1.0.0' }))
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
            await runListStandards({ calmHubUrl: 'http://hub', namespace: 'finos' });

            expect(hubOutput.printJsonSuccess).toHaveBeenCalledWith([{ id: 1, name: 'standard-a', description: 'desc-a', versions: ['1.0.0'] }]);
        });

        it('renders table with ID, NAME, DESCRIPTION, VERSIONS when format is pretty', async () => {
            const { mockClient } = await getSharedMocks();
            vi.mocked(mockClient.listStandards).mockResolvedValue([
                { id: 1, name: 'standard-a', description: 'desc-a', versions: ['1.0.0'] }
            ]);

            const { runListStandards } = await import('./hub-commands');
            await runListStandards({ calmHubUrl: 'http://hub', namespace: 'finos', format: 'pretty' });

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
            await expect(runListStandards({ namespace: 'finos' })).rejects.toThrow('process.exit');
            expect(hubOutput.printError).toHaveBeenCalled();
        });
    });
});
