import { useEffect, useMemo, useState } from 'react';
import { ConventionService } from '../../../service/convention-service.js';
import { ConventionSummary, NamespaceDefaultConvention } from '../../../model/convention.js';

export interface NamespaceConventionGroup {
    conventionType: string;
    conventions: ConventionSummary[];
    /** The default that applies to the namespace, which can be inherited from an ancestor. */
    defaultConvention?: NamespaceDefaultConvention;
}

/**
 * Loads, for each convention type, the conventions of the namespace and the default that applies to it.
 * A type with no conventions and no default is left out. A failed type is left out, so one bad
 * request does not hide the others.
 */
export function useNamespaceConventions(namespace: string, service?: ConventionService): NamespaceConventionGroup[] {
    const conventionService = useMemo(() => service ?? new ConventionService(), [service]);
    const [loaded, setLoaded] = useState<{ namespace: string; groups: NamespaceConventionGroup[] } | null>(null);

    useEffect(() => {
        let cancelled = false;
        conventionService
            .fetchConventionTypes()
            .then((types) =>
                Promise.all(
                    types.map(({ type }) =>
                        Promise.all([
                            conventionService.fetchConventions(namespace, type),
                            conventionService.fetchNamespaceDefault(namespace, type),
                        ])
                            .then(([conventions, defaultConvention]): NamespaceConventionGroup => ({ conventionType: type, conventions, defaultConvention }))
                            .catch(() => undefined)
                    )
                )
            )
            .then((groups) => groups.filter((g): g is NamespaceConventionGroup => !!g && (g.conventions.length > 0 || !!g.defaultConvention)))
            .catch((): NamespaceConventionGroup[] => [])
            .then((groups) => {
                if (!cancelled) setLoaded({ namespace, groups });
            });
        return () => {
            cancelled = true;
        };
    }, [namespace, conventionService]);

    return loaded?.namespace === namespace ? loaded.groups : [];
}
