import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authStore } from '../service/utils/auth-store.js';
import { IMAGE_ASSET_MAX_BYTES, ImageAssetLoader } from './image-asset-loader.js';

vi.mock('../authService.js', () => ({ getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer user-token' }) }));

const URL = '/api/calm/extensions/ext/logo/light';
const bytesOf = (dataUrl: string) => Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));

let mock: AxiosMockAdapter;
let loader: ImageAssetLoader;

beforeEach(() => {
    const ax = axios.create();
    mock = new AxiosMockAdapter(ax as never);
    loader = new ImageAssetLoader(ax);
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('ImageAssetLoader', () => {
    it('gives the bytes as a data URL of the reply type, without its parameters, and sends the user credentials to Hub', async () => {
        mock.onGet(URL).reply(200, new TextEncoder().encode('<svg/>').buffer, { 'content-type': 'Image/SVG+xml; charset=UTF-8' });

        expect(await loader.load(URL)).toBe(`data:image/svg+xml;base64,${btoa('<svg/>')}`);
        expect(mock.history.get[0].headers?.Authorization).toBe('Bearer user-token');
        expect(mock.history.get[0].responseType).toBe('arraybuffer');
    });

    it('keeps every byte of an image at the size limit', async () => {
        const bytes = Uint8Array.from({ length: IMAGE_ASSET_MAX_BYTES }, (_, i) => (i * 7 + (i >> 13)) % 256);
        mock.onGet(URL).reply(200, bytes.buffer, { 'content-type': 'image/png' });

        const src = await loader.load(URL);

        expect(src.startsWith('data:image/png;base64,')).toBe(true);
        expect(bytesOf(src)).toEqual(bytes);
    });

    it('refuses an image over the size limit and an empty one', async () => {
        mock.onGet(URL).replyOnce(200, new Uint8Array(IMAGE_ASSET_MAX_BYTES + 1).buffer, { 'content-type': 'image/png' });
        mock.onGet(URL).replyOnce(200, new ArrayBuffer(0), { 'content-type': 'image/png' });

        await expect(loader.load(URL)).rejects.toThrow('Error loading image asset');
        await expect(loader.load(URL)).rejects.toThrow('Error loading image asset');
    });

    it.each(['text/html', 'application/json', 'image/gif', 'image/svg', ''])('refuses a reply of type "%s"', async (type) => {
        mock.onGet(URL).reply(200, new TextEncoder().encode('<svg/>').buffer, type ? { 'content-type': type } : {});

        await expect(loader.load(URL)).rejects.toThrow('Error loading image asset');
    });

    it.each(['https://images.example.com/logo.png', '//images.example.com/api/calm/logo.png', '/calm/logo.png', 'api/calm/x', '/api/calm/'])(
        'never sends a request, with credentials, to %s',
        async (url) => {
            mock.onAny().reply(200, new ArrayBuffer(1), { 'content-type': 'image/png' });

            await expect(loader.load(url)).rejects.toThrow('Error loading image asset');
            expect(mock.history.get).toHaveLength(0);
        }
    );

    it('reads each asset once and keeps it for a remount', async () => {
        mock.onGet(URL).reply(200, new TextEncoder().encode('<svg/>').buffer, { 'content-type': 'image/svg+xml' });

        expect(loader.cached(URL)).toBeUndefined();
        const [first, second] = await Promise.all([loader.load(URL), loader.load(URL)]);

        expect(second).toBe(first);
        expect(await loader.load(URL)).toBe(first);
        expect(loader.cached(URL)).toBe(first);
        expect(mock.history.get).toHaveLength(1);
    });

    it('reads a failed asset again for the next caller', async () => {
        mock.onGet(URL).replyOnce(503).onGet(URL).replyOnce(200, new TextEncoder().encode('<svg/>').buffer, { 'content-type': 'image/svg+xml' });

        await expect(loader.load(URL)).rejects.toThrow();
        expect(loader.cached(URL)).toBeUndefined();
        expect(await loader.load(URL)).toMatch(/^data:image\/svg\+xml;base64,/);
        expect(mock.history.get).toHaveLength(2);
    });

    it('does not open the sign-in prompt when an image gets 401', async () => {
        const setAuthError = vi.spyOn(authStore, 'setAuthError');
        mock.onGet(URL).reply(401);

        await expect(loader.load(URL)).rejects.toThrow();
        expect(setAuthError).not.toHaveBeenCalled();
    });
});
