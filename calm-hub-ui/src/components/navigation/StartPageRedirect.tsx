import { ReactNode, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useExtensions, useExtensionsStatus } from '../../extensions/ExtensionsContext.js';
import { useUiConfigStatus } from '../ui-config/ui-config-status.js';
import { useNavigationSettings } from './navigation-settings.js';
import { startPageTarget } from './start-page.js';

/** How long Hub waits to know the start page before it shows the overview. */
export const START_PAGE_WAIT_MS = 3_000;

interface StartPageRedirectProps {
    children: ReactNode;
    /** True when the registry names a chat provider. Without one, a `/chat` start page falls back to the overview. */
    chatAvailable?: boolean;
}

/**
 * Opens the start page when Hub opens on `/`: the first entry of the session, which has react-router's `default` key.
 * It wraps the routes, so that it decides once for the life of the app. A later visit to `/`, such as the Home link or
 * Back to the first entry, shows the overview. Until it decides, the first entry renders nothing, so the overview does
 * not flash first. A deep link renders at once.
 */
export function StartPageRedirect({ children, chatAvailable = false }: StartPageRedirectProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const { startPage } = useNavigationSettings();
    const target = startPageTarget(startPage, {
        configStatus: useUiConfigStatus(),
        extensions: useExtensions(),
        extensionsStatus: useExtensionsStatus(),
        chatAvailable,
    });
    // Decided once, so a config or registry that loads after a fallback does not move the user away from the overview.
    const opening = location.pathname === '/' && location.key === 'default';
    const [decided, setDecided] = useState(!opening);
    if (!decided && (!opening || target === undefined)) setDecided(true);
    const redirect = !decided && target !== 'pending' && target !== undefined ? target : undefined;

    // A config or registry request that does not settle must not keep the page empty.
    useEffect(() => {
        if (decided) return;
        const timeout = setTimeout(() => setDecided(true), START_PAGE_WAIT_MS);
        return () => clearTimeout(timeout);
    }, [decided]);

    // The new location is not the opening entry, so the next render decides.
    useEffect(() => {
        if (redirect) navigate(redirect, { replace: true });
    }, [redirect, navigate]);

    return decided ? <>{children}</> : null;
}
