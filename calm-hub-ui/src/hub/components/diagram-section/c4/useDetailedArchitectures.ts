import { useEffect, useMemo, useState } from 'react';
import { withDetailedArchitectures, type C4ArchitectureInput } from '@finos/calm-models/c4';
import { isSlug } from '../../../../model/calm.js';
import { CalmService } from '../../../../service/calm-service.js';
import { parseCALMHubPath, resolveDetailedArchitecture } from '../../../../visualizer/components/reactflow/utils/calmHelpers.js';

interface Loaded {
    for: C4ArchitectureInput;
    details: Record<string, C4ArchitectureInput>;
}

/**
 * Rule 5 of the C4 standard: adds the nodes of each CALM Hub `detailed-architecture` one level down. A link that
 * does not load is left out, so the node shows without its detail.
 */
export function useDetailedArchitectures(
    architecture: C4ArchitectureInput | undefined,
    service?: CalmService,
): C4ArchitectureInput | undefined {
    const calmService = useMemo(() => service ?? new CalmService(), [service]);
    const [loaded, setLoaded] = useState<Loaded>();

    useEffect(() => {
        const links = (architecture?.nodes ?? []).flatMap((node) => {
            const resolution = resolveDetailedArchitecture(node.details?.['detailed-architecture']);
            const path = resolution.type === 'internal' ? parseCALMHubPath(resolution.path) : null;
            return path?.type === 'architectures' ? [{ id: node['unique-id'], path }] : [];
        });
        if (!architecture || links.length === 0) return;
        let cancelled = false;
        Promise.all(
            links.map(({ id, path }) =>
                (isSlug(path.id)
                    ? calmService.fetchResourceByCustomId(path.namespace, path.id, path.version, 'Architectures')
                    : calmService.fetchArchitecture(path.namespace, path.id, path.version))
                    .then((result) => [id, result.data] as const)
                    .catch(() => [id, undefined] as const),
            ),
        ).then((results) => {
            if (cancelled) return;
            const details = Object.fromEntries(results.filter((entry): entry is readonly [string, C4ArchitectureInput] => !!entry[1]));
            setLoaded({ for: architecture, details });
        });
        return () => {
            cancelled = true;
        };
    }, [architecture, calmService]);

    return useMemo(() => {
        if (!architecture) return undefined;
        return loaded?.for === architecture ? withDetailedArchitectures(architecture, loaded.details) : architecture;
    }, [architecture, loaded]);
}
