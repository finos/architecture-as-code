import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ExtensionSummary } from '../model/extensions.js';
import { ExtensionRegistryError, ExtensionService } from '../service/extension-service.js';
import { ActionRuns, ActionRunsContext } from './actionRuns.js';

export type ExtensionsStatus = 'loading' | 'loaded' | 'failed' | 'signed-out';

/** The first retry after a failed registry load. Each next retry waits twice as long, up to the maximum. */
export const REGISTRY_RETRY_MS = 5_000;
export const REGISTRY_RETRY_MAX_MS = 60_000;

export const ExtensionsContext = createContext<ExtensionSummary[]>([]);
// 'loaded' outside a provider: a bare ExtensionsContext value is a settled registry.
export const ExtensionsStatusContext = createContext<ExtensionsStatus>('loaded');
const ExtensionServiceContext = createContext<ExtensionService | null>(null);

interface RegistryState {
    service: ExtensionService;
    extensions: ExtensionSummary[];
    status: ExtensionsStatus;
}

export function ExtensionsProvider({ children, service }: { children: ReactNode; service?: ExtensionService }) {
    // One service for the app, so the registry, the decorator views and the slots share one registry request.
    const svc = useMemo(() => service ?? new ExtensionService(), [service]);
    const [state, setState] = useState<RegistryState>({ service: svc, extensions: [], status: 'loading' });
    const [retryTick, setRetryTick] = useState(0);
    // The failures in a row for one service. A success or a new service starts the backoff again.
    const failures = useRef({ service: svc, count: 0 });
    const [runs] = useState(() => new ActionRuns());
    // A new service has its own registry: show loading, not the list of the old one.
    const current = state.service === svc ? state : { service: svc, extensions: [], status: 'loading' as const };

    useEffect(() => {
        let cancelled = false;
        let retry: ReturnType<typeof setTimeout> | undefined;
        if (failures.current.service !== svc) failures.current = { service: svc, count: 0 };
        svc.fetchExtensions()
            .then((extensions) => {
                if (cancelled) return;
                failures.current.count = 0;
                setState({ service: svc, extensions, status: 'loaded' });
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                const signedOut = error instanceof ExtensionRegistryError && error.signedOut;
                setState({ service: svc, extensions: [], status: signedOut ? 'signed-out' : 'failed' });
                // A sign-in reloads the page. A retry while signed out would only open the prompt again.
                if (!signedOut) {
                    const delay = Math.min(REGISTRY_RETRY_MS * 2 ** failures.current.count, REGISTRY_RETRY_MAX_MS);
                    failures.current.count += 1;
                    retry = setTimeout(() => setRetryTick((n) => n + 1), delay);
                }
            });
        return () => {
            cancelled = true;
            clearTimeout(retry);
        };
    }, [svc, retryTick]);

    return (
        <ExtensionServiceContext.Provider value={svc}>
            <ActionRunsContext.Provider value={runs}>
                <ExtensionsStatusContext.Provider value={current.status}>
                    <ExtensionsContext.Provider value={current.extensions}>{children}</ExtensionsContext.Provider>
                </ExtensionsStatusContext.Provider>
            </ActionRunsContext.Provider>
        </ExtensionServiceContext.Provider>
    );
}

export function useExtensions() {
    return useContext(ExtensionsContext);
}

export function useExtensionsStatus() {
    return useContext(ExtensionsStatusContext);
}

/** The provider's service. Outside a provider, such as in a test, each component gets its own. */
export function useExtensionService(): ExtensionService {
    const shared = useContext(ExtensionServiceContext);
    return useMemo(() => shared ?? new ExtensionService(), [shared]);
}
