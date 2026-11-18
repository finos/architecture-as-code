import { useState } from 'react';
import { useImageAsset } from '../assets/useImageAsset.js';
import type { ExtensionSummary } from '../model/extensions.js';
import { useResolvedTheme } from '../theme/useTheme.js';
import { ExtensionMarker } from './ExtensionMarker.js';

/** A logo made for a light background keeps it in the dark theme, so the plate stays light in both themes. */
const LIGHT_PLATE = '#ffffff';

const extensionLogoUrl = (id: string, variant: 'light' | 'dark') =>
    `/api/calm/extensions/${encodeURIComponent(id)}/logo/${variant}`;

interface ExtensionLogoProps {
    extension: Pick<ExtensionSummary, 'id' | 'logo'>;
    /** The width and height of the logo box, in pixels. */
    size?: number;
}

/**
 * The mark of an extension beside its name. Decorative: always show the name as text next to it. Without a logo it is
 * the marker. With a logo, the box shows the marker until the browser loads the image, and when the image fails. The
 * dark theme shows the dark logo, or the light logo on a light plate.
 */
export function ExtensionLogo({ extension, size = 16 }: ExtensionLogoProps) {
    const { id, logo } = extension;
    const theme = useResolvedTheme();
    const dark = theme === 'dark' && !!logo?.dark;
    const plate = theme === 'dark' && !logo?.dark;
    const { src, failed } = useImageAsset(logo ? extensionLogoUrl(id, dark ? 'dark' : 'light') : undefined);
    const [loaded, setLoaded] = useState<string>();
    const [broken, setBroken] = useState<string>();
    const image = src && src !== broken ? src : undefined;
    // The bytes are not enough: until the img loads, the browser draws nothing. A new image waits for its own load.
    if (loaded && loaded !== image) setLoaded(undefined);
    if (!logo) return <ExtensionMarker extensionId={id} />;
    const shown = !!image && image === loaded;
    return (
        <span
            aria-hidden="true"
            data-testid="extension-logo"
            data-state={shown ? 'loaded' : failed || (src && src === broken) ? 'failed' : 'loading'}
            className="inline-flex shrink-0 items-center justify-center overflow-hidden"
            style={{
                width: size,
                height: size,
                ...(shown && plate ? { backgroundColor: LIGHT_PLATE, borderRadius: 4, padding: Math.round(size / 8) } : {}),
            }}
        >
            {image && (
                <img
                    key={image}
                    src={image}
                    alt=""
                    draggable={false}
                    hidden={!shown}
                    className={shown ? 'block w-full h-full object-contain' : undefined}
                    // An image that the page drew before is complete at once; do not show the marker for a frame.
                    ref={(img) => {
                        if (img?.complete && img.naturalWidth > 0) setLoaded(image);
                    }}
                    onLoad={() => setLoaded(image)}
                    onError={() => setBroken(image)}
                />
            )}
            {!shown && <ExtensionMarker extensionId={id} />}
        </span>
    );
}
