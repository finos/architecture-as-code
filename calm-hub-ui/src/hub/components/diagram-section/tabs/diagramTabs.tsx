import { IoCodeOutline, IoEyeOutline, IoGitNetworkOutline, IoPricetagsOutline, IoRocketOutline } from 'react-icons/io5';
import { DeploymentPanel } from '../../../../visualizer/components/reactflow/DeploymentPanel.js';
import { JsonRenderer } from '../../json-renderer/JsonRenderer.js';
import { DecoratorsPanel } from '../decorators/DecoratorsPanel.js';
import { UsedByPanel } from '../used-by/UsedByPanel.js';
import { USED_BY_TOOLTIP, usedByLabel } from '../used-by/usedBy.js';
import { DEFAULT_DIAGRAM_TAB_ID, type DiagramTab } from './diagramTabRegistry.js';

export const DEPLOYMENTS_TAB_ID = 'deployments';
export const DECORATORS_TAB_ID = 'decorators';

/** The `?tab=decorators` query parameter that filters by decorator type. */
export const DECORATOR_TYPE_PARAM = 'type';

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
        id: DEPLOYMENTS_TAB_ID,
        label: 'Deployments',
        icon: IoRocketOutline,
        isVisible: ({ isArchitecture }) => isArchitecture,
        render: ({ deploymentDecorators }) => (
            <div className="h-full bg-base-200 overflow-auto p-4">
                <DeploymentPanel decorators={deploymentDecorators} />
            </div>
        ),
    },
    {
        id: DECORATORS_TAB_ID,
        label: 'Decorators',
        icon: IoPricetagsOutline,
        isVisible: ({ isArchitecture }) => isArchitecture,
        searchParams: [DECORATOR_TYPE_PARAM],
        render: ({ decorators, searchParams, setTabParams }) => (
            <DecoratorsPanel
                state={decorators}
                typeFilter={searchParams.get(DECORATOR_TYPE_PARAM) || null}
                onTypeFilterChange={(type) => setTabParams(type ? { [DECORATOR_TYPE_PARAM]: type } : {})}
            />
        ),
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
