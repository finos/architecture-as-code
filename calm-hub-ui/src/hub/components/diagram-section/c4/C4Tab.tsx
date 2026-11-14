import { useCallback, useMemo } from 'react';
import {
    C4_LEVELS,
    c4ChainOf,
    c4Scopes,
    c4View,
    projectC4,
    type C4ArchitectureInput,
} from '@finos/calm-models/c4';
import type { C4MappingService } from '../../../../service/c4-mapping-service.js';
import type { CalmService } from '../../../../service/calm-service.js';
import { C4Diagram } from './C4Diagram.js';
import { C4Notes } from './C4Notes.js';
import { C4Toolbar } from './C4Toolbar.js';
import { C4_LEVEL_PARAM, C4_SCOPE_PARAM } from './c4Display.js';
import { useDetailedArchitectures } from './useDetailedArchitectures.js';
import { useNamespaceC4Mapping } from './useNamespaceC4Mapping.js';

interface C4TabProps {
    architecture: C4ArchitectureInput | undefined;
    namespace: string;
    /** The architecture's name in Hub, for the implicit system when the architecture has no title. */
    architectureName?: string;
    searchParams: URLSearchParams;
    setTabParams: (params: Record<string, string>) => void;
    service?: CalmService;
    mappingService?: C4MappingService;
}

export function C4Tab({ architecture, namespace, architectureName, searchParams, setTabParams, service, mappingService }: C4TabProps) {
    const { mapping, source, error, loading } = useNamespaceC4Mapping(namespace, mappingService);
    const expanded = useDetailedArchitectures(architecture, service);
    const model = useMemo(
        () => expanded && mapping && projectC4(expanded, mapping, { namespace, architectureName }),
        [expanded, mapping, namespace, architectureName],
    );
    const requestedLevel = searchParams.get(C4_LEVEL_PARAM);
    const level = C4_LEVELS.find((l) => l === requestedLevel) ?? 'context';
    const scopes = useMemo(() => (model ? c4Scopes(model, level) : []), [model, level]);
    const scope = scopes.find((s) => s.id === searchParams.get(C4_SCOPE_PARAM)) ?? scopes[0];
    const view = useMemo(() => model && c4View(model, level, scope?.id), [model, level, scope]);

    const openable = useMemo(
        () => new Set(model ? [...c4Scopes(model, 'container'), ...c4Scopes(model, 'component')].map((e) => e.id) : []),
        [model],
    );
    const canOpen = useCallback((id: string) => openable.has(id) && !(id === scope?.id && level !== 'context'), [openable, scope, level]);
    const open = useCallback(
        (id: string) => {
            const kind = model?.elements.get(id)?.kind;
            setTabParams({ [C4_LEVEL_PARAM]: kind === 'container' ? 'component' : 'container', [C4_SCOPE_PARAM]: id });
        },
        [model, setTabParams],
    );

    if (error) {
        return (
            <div role="alert" className="m-6 p-4 rounded-lg border border-error bg-error/10 text-sm space-y-2 break-words">
                <p>{error}</p>
                <p>The C4 tab shows nothing until the C4 mapping of the namespace is valid.</p>
            </div>
        );
    }
    if (!model || !view || !mapping) return <div className="p-6 text-sm">This tab shows architectures only.</div>;
    if (loading) return <div className="p-6 text-sm opacity-70">Loading the C4 mapping…</div>;

    const guessed = [...model.elements.values()].filter((e) => e.source === 'structure').length;
    const breadcrumb = level === 'container' || level === 'component' ? (scope ? c4ChainOf(model, scope.id).map((id) => model.elements.get(id)!) : []) : [];
    const empty = view.deployments ? view.deployments.length === 0 : view.inside.length === 0 && view.outside.length === 0;

    return (
        <div className="h-full flex flex-col" data-testid="c4-tab">
            <C4Toolbar
                level={level}
                scope={scope}
                scopes={scopes}
                breadcrumb={breadcrumb}
                guessed={guessed}
                mappingId={mapping['unique-id']}
                mappingSource={source}
                onLevel={(next) => setTabParams(next === 'context' ? {} : { [C4_LEVEL_PARAM]: next })}
                onScope={(id) => setTabParams({ [C4_LEVEL_PARAM]: level, [C4_SCOPE_PARAM]: id })}
                onOpen={open}
            />
            <div className="flex-1 min-h-0 relative">
                {empty ? (
                    <div className="p-6 text-sm opacity-70">
                        {level === 'deployment'
                            ? 'This architecture has no deployed-in relationships or deployment nodes.'
                            : `No ${level} diagram: nothing in this architecture is at this level.`}
                    </div>
                ) : (
                    <C4Diagram view={view} model={model} canOpen={canOpen} onOpen={open} />
                )}
                <C4Notes model={model} />
            </div>
        </div>
    );
}
