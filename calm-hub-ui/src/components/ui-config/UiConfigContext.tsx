import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { UiConfig } from '../../model/ui-config.js';
import { UiConfigService } from '../../service/ui-config-service.js';
import { UiConfigStatus, UiConfigStatusContext } from './ui-config-status.js';

export const UiConfigContext = createContext<UiConfig>({});

/** How long the page waits for the config before it continues with the defaults. A later reply still applies. */
export const UI_CONFIG_WAIT_MS = 3_000;

/** On failure the config stays empty, so the header shows only its standard content. */
export function UiConfigProvider({ children, service }: { children: ReactNode; service?: UiConfigService }) {
    const [config, setConfig] = useState<UiConfig>({});
    const [status, setStatus] = useState<UiConfigStatus>('loading');
    const svc = useMemo(() => service ?? new UiConfigService(), [service]);

    useEffect(() => {
        const timeout = setTimeout(() => setStatus((current) => (current === 'loading' ? 'failed' : current)), UI_CONFIG_WAIT_MS);
        svc.getUiConfig()
            .then((loaded) => {
                setConfig(loaded);
                setStatus('loaded');
            })
            .catch(() => {
                setConfig({});
                setStatus('failed');
            })
            .finally(() => clearTimeout(timeout));
        return () => clearTimeout(timeout);
    }, [svc]);

    return (
        <UiConfigStatusContext.Provider value={status}>
            <UiConfigContext.Provider value={config}>{children}</UiConfigContext.Provider>
        </UiConfigStatusContext.Provider>
    );
}

export function useUiConfig(): UiConfig {
    return useContext(UiConfigContext);
}
