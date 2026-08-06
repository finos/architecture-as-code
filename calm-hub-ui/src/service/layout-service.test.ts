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

            const result = await layoutService.getDefaultLayout(namespace, architectureId);
            expect(result).toEqual(layout);
        });

        it('returns null on 404, not a rejection', async () => {
            mock.onGet(`/api/calm/namespaces/${namespace}/architectures/${architectureId}/layout`).reply(404, 'not found');

            await expect(layoutService.getDefaultLayout(namespace, architectureId)).resolves.toBeNull();
        });

        it('rejects on a 500', async () => {
            mock.onGet(`/api/calm/namespaces/${namespace}/architectures/${architectureId}/layout`).reply(500, 'boom');

            await expect(layoutService.getDefaultLayout(namespace, architectureId)).rejects.toThrowError();
        });
    });

    describe('saveDefaultLayout', () => {
        it('PUTs to the correct URL with the layout as the body', async () => {
            mock.onPut(`/api/calm/namespaces/${namespace}/architectures/${architectureId}/layout`).reply((config) => {
                expect(JSON.parse(config.data)).toEqual(layout);
                return [204];
            });

            await expect(layoutService.saveDefaultLayout(namespace, architectureId, layout)).resolves.toBeUndefined();
        });

        it('rejects when the save fails', async () => {
            mock.onPut(`/api/calm/namespaces/${namespace}/architectures/${architectureId}/layout`).reply(400, 'bad request');

            await expect(layoutService.saveDefaultLayout(namespace, architectureId, layout)).rejects.toThrowError();
        });
    });
});
