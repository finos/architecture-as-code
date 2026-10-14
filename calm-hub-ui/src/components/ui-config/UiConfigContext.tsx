import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { UiConfig } from '../../model/ui-config.js';
import { UiConfigService } from '../../service/ui-config-service.js';

export const UiConfigContext = createContext<UiConfig>({});

/** On failure the config stays empty, so the header shows only its standard content. */
export function UiConfigProvider({ children, service }: { children: ReactNode; service?: UiConfigService }) {
    const [config, setConfig] = useState<UiConfig>({});
    const svc = useMemo(() => service ?? new UiConfigService(), [service]);

    useEffect(() => {
        svc.getUiConfig()
            .then(setConfig)
            .catch(() => setConfig({}));
    }, [svc]);

    return <UiConfigContext.Provider value={config}>{children}</UiConfigContext.Provider>;
}

export function useUiConfig(): UiConfig {
    return useContext(UiConfigContext);
}
