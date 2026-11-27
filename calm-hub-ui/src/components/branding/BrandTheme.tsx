import { useEffect, useMemo } from 'react';
import { useUiConfig } from '../ui-config/UiConfigContext.js';
import { brandStyleSheet, brandTheme } from './brand-colours.js';
import { documentTitle } from './brand-names.js';

/** Applies the organisation colours and name to the whole page. Renders nothing without them. */
export function BrandTheme() {
    const { branding } = useUiConfig();
    const css = useMemo(() => {
        const theme = brandTheme(branding);
        return theme ? brandStyleSheet(theme) : undefined;
    }, [branding]);
    const title = documentTitle(branding);

    useEffect(() => {
        if (!title) return;
        const previous = document.title;
        document.title = title;
        return () => {
            document.title = previous;
        };
    }, [title]);

    return css ? <style data-testid="brand-theme">{css}</style> : null;
}
