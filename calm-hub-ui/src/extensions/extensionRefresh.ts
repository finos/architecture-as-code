import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';

/**
 * A revision number for each extension. A confirmed write raises the revision of its extension, and each block slot
 * and table of that extension then loads again, in place: the earlier reply and the filters stay on screen.
 */
export class ExtensionRefresh {
    private readonly revisions = new Map<string, number>();
    private readonly listeners = new Set<() => void>();

    revision(extensionId: string): number {
        return this.revisions.get(extensionId) ?? 0;
    }

    /** Call only after a confirmed success (2xx). A failure or an unknown outcome changed nothing that Hub can show. */
    refresh(extensionId: string): void {
        this.revisions.set(extensionId, this.revision(extensionId) + 1);
        this.listeners.forEach((listener) => listener());
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
}

export const ExtensionRefreshContext = createContext<ExtensionRefresh | null>(null);

/** The provider's store. Outside a provider, such as in a test, each component gets its own. */
export function useExtensionRefresh(): ExtensionRefresh {
    const shared = useContext(ExtensionRefreshContext);
    return useMemo(() => shared ?? new ExtensionRefresh(), [shared]);
}

export function useExtensionRevision(extensionId: string): number {
    const store = useExtensionRefresh();
    return useSyncExternalStore(
        (listener) => store.subscribe(listener),
        () => store.revision(extensionId)
    );
}
