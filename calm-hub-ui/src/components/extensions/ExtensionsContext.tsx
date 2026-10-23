import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { ExtensionSummary } from '../../model/extensions.js';
import { ExtensionService } from '../../service/extension-service.js';

export const ExtensionsContext = createContext<ExtensionSummary[]>([]);

/** On failure the list stays empty, so the menu shows no extensions. */
export function ExtensionsProvider({ children, service }: { children: ReactNode; service?: ExtensionService }) {
    const [extensions, setExtensions] = useState<ExtensionSummary[]>([]);
    const svc = useMemo(() => service ?? new ExtensionService(), [service]);

    useEffect(() => {
        svc.fetchExtensions()
            .then(setExtensions)
            .catch(() => setExtensions([]));
    }, [svc]);

    return <ExtensionsContext.Provider value={extensions}>{children}</ExtensionsContext.Provider>;
}

export function useExtensions(): ExtensionSummary[] {
    return useContext(ExtensionsContext);
}
