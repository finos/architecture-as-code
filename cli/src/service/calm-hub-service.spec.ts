import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CalmHubService, extractVersionFromLocationHeader } from './calm-hub-service';
import { CLIConfig } from '../cli-config';

const makeAxios = (overrides: Record<string, unknown> = {}) => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    ...overrides,
});

describe('extractVersionFromLocationHeader', () => {
    it('extracts version from a standard location header', () => {
        expect(extractVersionFromLocationHeader('/calm/namespaces/com.example/my-arch/versions/1.2.3'))
            .toBe('1.2.3');
    });

    it('extracts version with semver-like string', () => {
        expect(extractVersionFromLocationHeader('/calm/namespaces/ns/doc/versions/2.0.0'))
            .toBe('2.0.0');
    });

    it('throws when location header is missing', () => {
        expect(() => extractVersionFromLocationHeader('')).toThrow('No Location header');
    });

    it('throws when location header has unexpected format', () => {
        expect(() => extractVersionFromLocationHeader('/some/other/path')).toThrow('Unexpected Location header format');
    });
});

describe('CalmHubService', () => {
    let ax: ReturnType<typeof makeAxios>;
    let service: CalmHubService;

    beforeEach(() => {
        ax = makeAxios();
        service = new CalmHubService('https://calmhub.example.com', ax as never);
    });

    describe('fromCliConfig', () => {
        it('creates a service when calmHubUrl is set', () => {
            const config: CLIConfig = { calmHubUrl: 'https://calmhub.example.com' };
            const svc = CalmHubService.fromCliConfig(config);
            expect(svc).toBeInstanceOf(CalmHubService);
        });

        it('throws when calmHubUrl is not set', () => {
            const config: CLIConfig = {};
            expect(() => CalmHubService.fromCliConfig(config)).toThrow('No CalmHub instance configured');
        });
    });

    describe('getCalmHubResourceVersions', () => {
        it('calls GET on the versions URL', async () => {
            ax.get.mockResolvedValue({ data: ['1.0.0', '1.1.0'] });
            await service.getCalmHubResourceVersions('com.example', 'my-arch');
            expect(ax.get).toHaveBeenCalledWith('/calm/namespaces/com.example/my-arch/versions');
        });

        it('returns the axios response', async () => {
            const response = { data: ['1.0.0'] };
            ax.get.mockResolvedValue(response);
            const result = await service.getCalmHubResourceVersions('com.example', 'my-arch');
            expect(result).toBe(response);
        });
    });

    describe('getCalmHubResourceLatestVersion', () => {
        it('calls GET on the latest version URL', async () => {
            ax.get.mockResolvedValue({ data: { $id: 'my-arch' } });
            await service.getCalmHubResourceLatestVersion('com.example', 'my-arch');
            expect(ax.get).toHaveBeenCalledWith('/calm/namespaces/com.example/my-arch');
        });

        it('propagates errors from axios', async () => {
            const err = Object.assign(new Error('Not Found'), { response: { status: 404 } });
            ax.get.mockRejectedValue(err);
            await expect(service.getCalmHubResourceLatestVersion('com.example', 'my-arch')).rejects.toThrow('Not Found');
        });
    });

    describe('getCalmHubResourceSpecificVersion', () => {
        it('calls GET on the specific version URL', async () => {
            ax.get.mockResolvedValue({ data: { $id: 'my-arch' } });
            await service.getCalmHubResourceSpecificVersion('com.example', 'my-arch', '1.2.3');
            expect(ax.get).toHaveBeenCalledWith('/calm/namespaces/com.example/my-arch/versions/1.2.3');
        });
    });

    describe('createNewCalmResource', () => {
        it('calls POST with a FrontControllerCreateRequest body', async () => {
            ax.post.mockResolvedValue({ status: 201 });
            const data = { $id: 'my-arch', version: '1.0.0' };

            await service.createNewCalmResource('com.example', 'my-arch', 'architecture', data);

            expect(ax.post).toHaveBeenCalledWith(
                '/calm/namespaces/com.example/my-arch',
                expect.objectContaining({
                    type: 'ARCHITECTURE',
                    name: 'my-arch',
                    json: JSON.stringify(data),
                })
            );
        });

        it('includes a generated description when none is provided', async () => {
            ax.post.mockResolvedValue({ status: 201 });
            await service.createNewCalmResource('com.example', 'my-arch', 'architecture', {});
            const body = ax.post.mock.calls[0][1];
            expect(typeof body.description).toBe('string');
            expect(body.description.length).toBeGreaterThan(0);
        });

        it('uses a custom description when provided', async () => {
            ax.post.mockResolvedValue({ status: 201 });
            await service.createNewCalmResource('com.example', 'my-arch', 'architecture', {}, 'My custom desc');
            const body = ax.post.mock.calls[0][1];
            expect(body.description).toBe('My custom desc');
        });
    });

    describe('updateCalmResource', () => {
        it('calls POST with a FrontControllerUpdateRequest body and returns the new version', async () => {
            ax.post.mockResolvedValue({
                headers: { location: '/calm/namespaces/com.example/my-arch/versions/1.1.0' }
            });
            const data = { $id: 'my-arch', version: '2.0.0' };

            const version = await service.updateCalmResource('com.example', 'my-arch', data);

            expect(ax.post).toHaveBeenCalledWith(
                '/calm/namespaces/com.example/my-arch',
                expect.objectContaining({
                    json: JSON.stringify(data),
                    changeType: 'MINOR',
                })
            );
            expect(version).toBe('1.1.0');
        });

        it('handles a capitalised Location header', async () => {
            ax.post.mockResolvedValue({
                headers: { Location: '/calm/namespaces/com.example/my-arch/versions/2.3.4' }
            });
            const version = await service.updateCalmResource('com.example', 'my-arch', {});
            expect(version).toBe('2.3.4');
        });

        it('throws when no Location header is returned', async () => {
            ax.post.mockResolvedValue({ headers: {} });
            await expect(service.updateCalmResource('com.example', 'my-arch', {}))
                .rejects.toThrow('No Location header');
        });
    });
});
