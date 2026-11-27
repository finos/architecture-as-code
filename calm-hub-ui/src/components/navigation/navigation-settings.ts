import { useMemo } from 'react';
import { UiNavigation } from '../../model/ui-config.js';
import { useUiConfig } from '../ui-config/UiConfigContext.js';
import { useIsMobile } from '../../hooks/useMediaQuery.js';

export const DEFAULT_NAVIGATION: UiNavigation = { layout: 'menu', showNamespaces: true, showControlDomains: true };

/** The operator's navigation settings, or the defaults. Hiding a section hides its navigation only: its routes stay. */
export function useNavigationSettings(): UiNavigation {
    const { navigation } = useUiConfig();
    return useMemo(() => ({ ...DEFAULT_NAVIGATION, ...navigation }), [navigation]);
}

/**
 * The heading above the extensions: the operator's, else "Extensions" while a built-in section shows, to tell them
 * apart. With no built-in section, the extension names are enough.
 */
export function extensionsHeading(navigation: UiNavigation): string | undefined {
    if (navigation.extensionsHeading) return navigation.extensionsHeading;
    return navigation.showNamespaces || navigation.showControlDomains ? 'Extensions' : undefined;
}

/** True when the menu shows beside the page instead of in a drawer: the `sidebar` layout on a wide screen. */
export function usePersistentNavigation(): boolean {
    const { layout } = useNavigationSettings();
    const isMobile = useIsMobile();
    return layout === 'sidebar' && !isMobile;
}
