import axios, { AxiosInstance } from 'axios';
import { getAuthHeaders } from '../authService.js';

/** The types and the size limit of calm-hub `org.finos.calm.assets.ImageAsset`. Keep them the same. */
export const IMAGE_ASSET_TYPES: ReadonlySet<string> = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
export const IMAGE_ASSET_MAX_BYTES = 256 * 1024;

// A same-origin Hub path only, so that the user's token never goes to another origin.
const HUB_ASSET_PATH = /^\/api\/calm\/[^/]/;

function base64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
}

/**
 * Reads Hub image assets, such as logos, with the user's credentials, and gives each one as a `data:` URL for an
 * `img`. Not a `blob:` URL: an SVG opened from a `blob:` URL as a document would have Hub's origin, and a `data:` URL
 * has an opaque origin. Each URL is read once; a failure is read again by the next caller.
 */
export class ImageAssetLoader {
    private readonly ax: AxiosInstance;
    private readonly pending = new Map<string, Promise<string>>();
    private readonly loaded = new Map<string, string>();

    constructor(axiosInstance?: AxiosInstance) {
        // Not apiClient: a failed image shows its fallback and must not open the sign-in prompt or the outage page.
        this.ax = axiosInstance ?? axios.create();
    }

    /** The `data:` URL of an asset that has loaded, so that a remount shows it at once. */
    public cached(url: string): string | undefined {
        return this.loaded.get(url);
    }

    public load(url: string): Promise<string> {
        let promise = this.pending.get(url);
        if (!promise) {
            promise = this.read(url).then(
                (src) => {
                    this.loaded.set(url, src);
                    return src;
                },
                (error) => {
                    this.pending.delete(url);
                    const errorMessage = `Error loading image asset ${url}:`;
                    console.error('%s', errorMessage, error);
                    return Promise.reject(new Error(errorMessage));
                }
            );
            this.pending.set(url, promise);
        }
        return promise;
    }

    private async read(url: string): Promise<string> {
        if (!HUB_ASSET_PATH.test(url)) throw new Error('Not a Hub asset path');
        const headers = await getAuthHeaders();
        const res = await this.ax.get<ArrayBuffer>(url, { headers, responseType: 'arraybuffer' });
        const type = String(res.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
        if (!IMAGE_ASSET_TYPES.has(type)) throw new Error(`Unsupported image type: ${type || 'none'}`);
        const bytes = new Uint8Array(res.data);
        if (bytes.length === 0 || bytes.length > IMAGE_ASSET_MAX_BYTES) throw new Error(`Image size out of range: ${bytes.length}`);
        return `data:${type};base64,${base64(bytes)}`;
    }
}
