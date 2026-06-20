import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query and return whether it currently matches.
 *
 * Safe to call in environments without `window.matchMedia` (e.g. older jsdom
 * test setups): it returns `false` and never subscribes, so components fall
 * back to their desktop layout.
 */
export function useMediaQuery(query: string): boolean {
    const getMatches = (): boolean => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return false;
        }
        return window.matchMedia(query).matches;
    };

    const [matches, setMatches] = useState<boolean>(getMatches);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return;
        }
        const mediaQueryList = window.matchMedia(query);
        const handleChange = () => setMatches(mediaQueryList.matches);

        // Sync immediately in case the query changed between render and effect.
        handleChange();
        mediaQueryList.addEventListener('change', handleChange);
        return () => mediaQueryList.removeEventListener('change', handleChange);
    }, [query]);

    return matches;
}

/**
 * Tailwind's `lg` breakpoint is 1024px. Anything narrower (phones and
 * tablet-portrait) is treated as "mobile" and gets the off-canvas layout.
 */
export function useIsMobile(): boolean {
    return useMediaQuery('(max-width: 1023px)');
}
