import { useState } from 'react';
import { useImageAsset } from '../../assets/useImageAsset.js';
import { Theme } from '../../theme/useTheme.js';
import { useUiConfig } from '../ui-config/UiConfigContext.js';
import { useUiConfigStatus } from '../ui-config/ui-config-status.js';

/**
 * CALM's lockups. Navy and blue are unreadable on a dark base, so dark gets a white one. The navbar lockups have no
 * tagline and share an aspect ratio, so the logo does not resize when the theme is toggled.
 */
const CALM_LOGO = {
    navbar: {
        light: '/brand/Horizontal/2025_CALM_Horizontal_Navbar_Logo.svg',
        dark: '/brand/Horizontal/2025_CALM_Horizontal_Navbar_Logo_WHT.svg',
    },
    hero: {
        light: '/brand/Horizontal/2025_CALM_Horizontal.svg',
        dark: '/brand/Horizontal/2025_CALM_Horizontal_WHT.svg',
    },
} as const;

const STYLES = {
    navbar: {
        // No `logo` navbar helper class on a branded image: its `height: inherit` would undo the cap.
        calm: 'h-10 logo min-w-0 object-contain',
        calmAlt: 'CALM Logo',
        placeholder: 'block h-10 w-32',
        lockup: 'flex items-center gap-2 min-w-0',
        image: 'h-8 w-auto max-w-32 object-contain shrink-0',
        plate: 'bg-white rounded-md p-1',
        names: 'flex flex-col min-w-0 text-left leading-tight',
        first: 'font-semibold text-[15px] text-primary truncate',
        second: 'text-xs text-base-content/70 truncate',
    },
    hero: {
        // No `logo` class here either: its global `max-width: 100%` loads after Tailwind and would override the cap.
        calm: 'h-auto w-[420px] sm:w-[520px] max-w-full',
        calmAlt: 'CALM',
        placeholder: 'block h-24 w-full max-w-[420px]',
        lockup: 'flex flex-col items-center gap-4 max-w-full text-center',
        image: 'h-16 sm:h-20 w-auto max-w-full object-contain',
        plate: 'bg-white rounded-xl p-2',
        names: 'flex flex-col items-center gap-1 max-w-full',
        first: 'text-3xl sm:text-4xl font-bold text-primary break-words max-w-full',
        second: 'text-lg text-base-content/70 break-words max-w-full',
    },
} as const;

interface BrandLockupProps {
    theme: Theme;
    size: keyof typeof STYLES;
}

/**
 * The organisation's logo and names, or CALM's lockup when the operator configured neither. Until the config, or a
 * logo without names, loads it keeps the space empty, so that a branded Hub does not show CALM's logo first. A logo
 * that does not load leaves the names, or CALM's lockup without names.
 */
export function BrandLockup({ theme, size }: BrandLockupProps) {
    const { branding } = useUiConfig();
    const status = useUiConfigStatus();
    // The light logo may be dark itself, so the dark theme shows it on a light plate.
    const onPlate = theme === 'dark' && !branding?.logo?.dark;
    const url = onPlate ? branding?.logo?.light : branding?.logo?.[theme];
    const logo = useImageAsset(url);
    // The browser can still refuse a loaded image, for example when a Content-Security-Policy blocks `data:` images.
    const [brokenSrc, setBrokenSrc] = useState<string>();
    const styles = STYLES[size];
    const [first, second] = [branding?.organisationName, branding?.applicationName].filter((name): name is string => !!name);
    const logoSrc = logo.failed || logo.src === brokenSrc ? undefined : logo.src;
    const logoLoading = !!url && !logo.src && !logo.failed;

    if (status === 'loading' || (!first && logoLoading)) {
        return <span className={styles.placeholder} aria-hidden="true" data-testid="brand-placeholder" />;
    }
    if (!first && !logoSrc) {
        return <img src={CALM_LOGO[size][theme]} alt={styles.calmAlt} className={styles.calm} />;
    }
    return (
        <span className={styles.lockup} data-testid="brand-lockup">
            {logoSrc && (
                <img
                    src={logoSrc}
                    alt={first ? '' : 'Organisation logo'}
                    className={onPlate ? `${styles.image} ${styles.plate}` : styles.image}
                    onError={() => setBrokenSrc(logoSrc)}
                />
            )}
            {first && (
                <span className={styles.names}>
                    <span className={styles.first} title={first}>
                        {first}
                    </span>
                    {second && (
                        <span className={styles.second} title={second}>
                            {second}
                        </span>
                    )}
                </span>
            )}
        </span>
    );
}
