import { IoCodeOutline, IoEyeOutline, IoGitNetworkOutline, IoPricetagsOutline } from 'react-icons/io5';
import { JsonRenderer } from '../../json-renderer/JsonRenderer.js';
import { DecoratorsPanel } from '../decorators/DecoratorsPanel.js';
import { UsedByPanel } from '../used-by/UsedByPanel.js';
import { USED_BY_TOOLTIP, usedByLabel } from '../used-by/usedBy.js';
import { DEFAULT_DIAGRAM_TAB_ID, type DiagramTab } from './diagramTabRegistry.js';

export const DECORATORS_TAB_ID = 'decorators';

/** The `?tab=decorators` query parameters that filter by decorator type and by `$schema`. */
export const DECORATOR_TYPE_PARAM = 'type';
export const DECORATOR_SCHEMA_PARAM = 'schema';

/** The query that keeps only the given filters. */
export const decoratorFilterParams = (type: string | null | undefined, schema: string | null | undefined): Record<string, string> => ({
    ...(type ? { [DECORATOR_TYPE_PARAM]: type } : {}),
    ...(schema ? { [DECORATOR_SCHEMA_PARAM]: schema } : {}),
});

/** Old `?tab=` values, and the query that replaces each. Deployments became a decorator view. */
export const DIAGRAM_TAB_REDIRECTS: Readonly<Record<string, Record<string, string>>> = {
    deployments: { tab: DECORATORS_TAB_ID, [DECORATOR_TYPE_PARAM]: 'deployment' },
};

/** The tabs of the diagram section, in display order. */
export const DIAGRAM_TABS: readonly DiagramTab[] = [
    {
        id: DEFAULT_DIAGRAM_TAB_ID,
        label: 'Diagram',
        icon: IoEyeOutline,
        render: ({ diagram }) => <div className="w-full h-full">{diagram}</div>,
    },
    {
        id: 'json',
        label: 'JSON',
        icon: IoCodeOutline,
        render: ({ data }) => (
            <div className="h-full bg-base-200 overflow-auto">
                <JsonRenderer json={data} />
            </div>
        ),
    },
    {
        id: DECORATORS_TAB_ID,
        label: 'Decorators',
        icon: IoPricetagsOutline,
        isVisible: ({ isArchitecture }) => isArchitecture,
        searchParams: [DECORATOR_TYPE_PARAM, DECORATOR_SCHEMA_PARAM],
        render: ({ decorators, searchParams, setTabParams, focusPanel, onPanelFocused }) => {
            const typeFilter = searchParams.get(DECORATOR_TYPE_PARAM) || null;
            const schemaFilter = searchParams.get(DECORATOR_SCHEMA_PARAM) || null;
            return (
                <DecoratorsPanel
                    state={decorators}
                    autoFocus={focusPanel}
                    onAutoFocused={onPanelFocused}
                    typeFilter={typeFilter}
                    schemaFilter={schemaFilter}
                    onTypeFilterChange={(type) => setTabParams(decoratorFilterParams(type, schemaFilter))}
                    onSchemaFilterChange={(schema) => setTabParams(decoratorFilterParams(typeFilter, schema))}
                />
            );
        },
    },
    {
        id: 'used-by',
        label: ({ usedBy }) => usedByLabel(usedBy),
        title: USED_BY_TOOLTIP,
        icon: IoGitNetworkOutline,
        isVisible: ({ isArchitecture, patternName }) => !isArchitecture && patternName !== undefined,
        render: ({ usedBy }) => <UsedByPanel state={usedBy} />,
    },
];
