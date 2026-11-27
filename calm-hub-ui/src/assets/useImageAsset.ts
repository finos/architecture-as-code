import { createContext, useContext, useEffect, useState } from 'react';
import { ImageAssetLoader } from './image-asset-loader.js';

/** One loader for the app, so that each asset is read once. Tests provide their own. */
export const ImageAssetContext = createContext(new ImageAssetLoader());

export interface ImageAssetState {
    /** A `data:` URL for an `img`. Unset while the asset loads, after a failure, and without a URL. */
    src?: string;
    failed: boolean;
}

/** Loads a Hub image asset. A failure never throws: the caller shows its fallback. */
export function useImageAsset(url?: string): ImageAssetState {
    const loader = useContext(ImageAssetContext);
    const [state, setState] = useState<ImageAssetState & { url?: string }>({ failed: false });
    const cached = url ? loader.cached(url) : undefined;
    useEffect(() => {
        if (!url || cached) return;
        let current = true;
        loader.load(url).then(
            (src) => current && setState({ url, src, failed: false }),
            () => current && setState({ url, failed: true })
        );
        return () => {
            current = false;
        };
    }, [loader, url, cached]);
    if (cached) return { src: cached, failed: false };
    // A state for another URL is out of date.
    return url && state.url === url ? { src: state.src, failed: state.failed } : { failed: false };
}
