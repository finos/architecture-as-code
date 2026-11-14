import { useEffect, useMemo, useState } from 'react';
import { ConfigService } from '../../../service/config-service.js';
import { ConfigSummary, NamespaceDefaultConfig } from '../../../model/config.js';

export interface NamespaceConfigGroup {
    configType: string;
    configs: ConfigSummary[];
    /** The default that applies to the namespace, which can be inherited from an ancestor. */
    defaultConfig?: NamespaceDefaultConfig;
}

/**
 * Loads, for each config type, the configs of the namespace and the default that applies to it.
 * A type with no configs and no default is left out. A failed type is left out, so one bad
 * request does not hide the others.
 */
export function useNamespaceConfigs(namespace: string, service?: ConfigService): NamespaceConfigGroup[] {
    const configService = useMemo(() => service ?? new ConfigService(), [service]);
    const [loaded, setLoaded] = useState<{ namespace: string; groups: NamespaceConfigGroup[] } | null>(null);

    useEffect(() => {
        let cancelled = false;
        configService
            .fetchConfigTypes()
            .then((types) =>
                Promise.all(
                    types.map(({ type }) =>
                        Promise.all([
                            configService.fetchConfigs(namespace, type),
                            configService.fetchNamespaceDefault(namespace, type),
                        ])
                            .then(([configs, defaultConfig]): NamespaceConfigGroup => ({ configType: type, configs, defaultConfig }))
                            .catch(() => undefined)
                    )
                )
            )
            .then((groups) => groups.filter((g): g is NamespaceConfigGroup => !!g && (g.configs.length > 0 || !!g.defaultConfig)))
            .catch((): NamespaceConfigGroup[] => [])
            .then((groups) => {
                if (!cancelled) setLoaded({ namespace, groups });
            });
        return () => {
            cancelled = true;
        };
    }, [namespace, configService]);

    return loaded?.namespace === namespace ? loaded.groups : [];
}
