import { describe, it, expect, afterEach } from 'vitest';
import AxiosMockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import { LayoutService } from './layout-service.js';
import { CalmLayout } from '../model/layout.js';

const ax = axios.create();
const mock = new AxiosMockAdapter(ax as never);

const namespace = 'finos';
const architectureId = 5;

const layout: CalmLayout = {
    for: `/api/calm/namespaces/${namespace}/architectures/${architectureId}`,
    name: 'Default',
    pins: [{ 'unique-id': 'node-a', position: { x: 0, y: 0 } }],
};

describe('LayoutService', () => {
    const layoutService = new LayoutService(ax);

    afterEach(() => {
        mock.reset();
    });

    describe('getDefaultLayout', () => {
        it('returns the parsed layout on 200', async () => {
            mock.onGet(`/api/calm/namespaces/${namespace}/architectures/${architectureId}/layout`).reply(200, layout);

            const result = await layoutService.getDefaultLayout(namespace, architectureId, 'architectures');
            expect(result).toEqual(layout);
        });

        it('returns null on 404, not a rejection', async () => {
            mock.onGet(`/api/calm/namespaces/${namespace}/architectures/${architectureId}/layout`).reply(404, 'not found');

            await expect(layoutService.getDefaultLayout(namespace, architectureId, 'architectures')).resolves.toBeNull();
        });

        it('rejects on a 500', async () => {
            mock.onGet(`/api/calm/namespaces/${namespace}/architectures/${architectureId}/layout`).reply(500, 'boom');

            await expect(layoutService.getDefaultLayout(namespace, architectureId, 'architectures')).rejects.toThrowError(
                "Couldn't load the default layout — the server returned 500."
            );
        });

        it('rejects with a load-specific message on 403, not the save-side "write access" wording', async () => {
            // save and load share status handling, but 403 on a read is not a write-access
            // failure and 413 does not apply to a GET at all — this pins the load-side wording.
            mock.onGet(`/api/calm/namespaces/${namespace}/architectures/${architectureId}/layout`).reply(403);

            await expect(layoutService.getDefaultLayout(namespace, architectureId, 'architectures')).rejects.toThrowError(
                "Couldn't load the default layout — you don't have access to this namespace."
            );
        });

        it('GETs the /patterns/ URL and uses pattern wording on 404 when urlType is patterns', async () => {
            const patternId = 7;
            mock.onGet(`/api/calm/namespaces/${namespace}/patterns/${patternId}/layout`).reply(404);

            // Asserts the literal URL string, not just that *a* request succeeded — a stale
            // hardcoded '/architectures/' segment here would silently 404 every pattern load.
            await expect(layoutService.getDefaultLayout(namespace, patternId, 'patterns')).resolves.toBeNull();
        });
    });

    describe('saveDefaultLayout', () => {
        it('PUTs to the correct URL with the layout as the body', async () => {
            mock.onPut(`/api/calm/namespaces/${namespace}/architectures/${architectureId}/layout`).reply((config) => {
                expect(JSON.parse(config.data)).toEqual(layout);
                return [204];
            });

            await expect(layoutService.saveDefaultLayout(namespace, architectureId, layout, 'architectures')).resolves.toBeUndefined();
        });

        it('rejects with a generic message when the save fails without a recognised status', async () => {
            mock.onPut(`/api/calm/namespaces/${namespace}/architectures/${architectureId}/layout`).reply(400, 'bad request');

            await expect(layoutService.saveDefaultLayout(namespace, architectureId, layout, 'architectures')).rejects.toThrowError(
                "Couldn't save the default layout — the server returned 400."
            );
        });

        it('rejects with a specific message on 403 (no write access)', async () => {
            mock.onPut(`/api/calm/namespaces/${namespace}/architectures/${architectureId}/layout`).reply(403);

            await expect(layoutService.saveDefaultLayout(namespace, architectureId, layout, 'architectures')).rejects.toThrowError(
                "Couldn't save the default layout — you don't have write access to this namespace."
            );
        });

        it('rejects with a specific message on 413 (too large)', async () => {
            mock.onPut(`/api/calm/namespaces/${namespace}/architectures/${architectureId}/layout`).reply(413);

            await expect(layoutService.saveDefaultLayout(namespace, architectureId, layout, 'architectures')).rejects.toThrowError(
                "Couldn't save the default layout — it's too large to store."
            );
        });

        it('rejects with a specific message on 404 (architecture no longer exists)', async () => {
            mock.onPut(`/api/calm/namespaces/${namespace}/architectures/${architectureId}/layout`).reply(404);

            await expect(layoutService.saveDefaultLayout(namespace, architectureId, layout, 'architectures')).rejects.toThrowError(
                "Couldn't save the default layout — this architecture no longer exists."
            );
        });

        it('rejects with a network-failure message when the server cannot be reached', async () => {
            mock.onPut(`/api/calm/namespaces/${namespace}/architectures/${architectureId}/layout`).networkError();

            await expect(layoutService.saveDefaultLayout(namespace, architectureId, layout, 'architectures')).rejects.toThrowError(
                "Couldn't save the default layout — the server couldn't be reached."
            );
        });

        it('PUTs the /patterns/ URL when urlType is patterns', async () => {
            const patternId = 7;
            const patternLayout: CalmLayout = {
                for: `/api/calm/namespaces/${namespace}/patterns/${patternId}`,
                pins: [],
            };
            mock.onPut(`/api/calm/namespaces/${namespace}/patterns/${patternId}/layout`).reply((config) => {
                expect(JSON.parse(config.data)).toEqual(patternLayout);
                return [204];
            });

            await expect(
                layoutService.saveDefaultLayout(namespace, patternId, patternLayout, 'patterns')
            ).resolves.toBeUndefined();
        });

        it('rejects with pattern-specific wording on 404 when urlType is patterns', async () => {
            const patternId = 7;
            mock.onPut(`/api/calm/namespaces/${namespace}/patterns/${patternId}/layout`).reply(404);

            await expect(
                layoutService.saveDefaultLayout(namespace, patternId, layout, 'patterns')
            ).rejects.toThrowError("Couldn't save the default layout — this pattern no longer exists.");
        });
    });
});
