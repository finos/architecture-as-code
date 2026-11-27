import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { ReactNode } from 'react';
import { ImageAssetLoader } from '../assets/image-asset-loader.js';
import { ImageAssetContext } from '../assets/useImageAsset.js';

export const svgDataUrl = (svg: string) => `data:image/svg+xml;base64,${btoa(svg)}`;

export const logoSvg = (colour: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="${colour}"/></svg>`;

/** A loader whose Hub replies are SVG text, or a status code for a failure. */
export function fakeImageAssets(replies: Record<string, string | number>) {
    const ax = axios.create();
    const mock = new AxiosMockAdapter(ax as never);
    for (const [url, reply] of Object.entries(replies)) {
        if (typeof reply === 'number') mock.onGet(url).reply(reply);
        else mock.onGet(url).reply(200, new TextEncoder().encode(reply).buffer, { 'content-type': 'image/svg+xml' });
    }
    const loader = new ImageAssetLoader(ax);
    const wrap = (children: ReactNode) => <ImageAssetContext.Provider value={loader}>{children}</ImageAssetContext.Provider>;
    return { loader, mock, wrap };
}
