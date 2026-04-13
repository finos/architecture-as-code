import { CalmNodeSchema } from '@finos/calm-models/types';
import { ZoomIn } from 'lucide-react';
import { extractNodeType } from '../reactflow/utils/calmHelpers.js';
import { getNodeTypeColor } from '../../../theme/helpers.js';
import type { ControlItem } from '../../contracts/contracts.js';
import {
    Badge, RiskLevelBadge,
    PropertiesSection, ControlsSection, RisksSection, MitigationsSection, InterfacesSection,
    getNodeIcon, extractAigf, getExtraProperties,
} from './detail-components.js';

const KNOWN_FIELDS = new Set([
    'unique-id', 'name', 'node-type', 'description', 'details',
    'interfaces', 'controls', 'metadata',
]);

export function NodeDetails({ data }: { data: CalmNodeSchema }) {
    const nodeType = extractNodeType(data) || 'Unknown';
    const Icon = getNodeIcon(nodeType);

    const aigf = extractAigf(data.metadata);
    const riskLevel = aigf?.['risk-level'];
    const risks = aigf?.risks || [];
    const mitigations = aigf?.mitigations || [];

    const controls: Record<string, ControlItem> = data.controls || {};
    const interfaces = (data.interfaces || []) as Record<string, unknown>[];
    const detailedArch = data.details?.['detailed-architecture'];
    const extraProps = getExtraProperties(data as unknown as Record<string, unknown>, KNOWN_FIELDS);

    return (
        <div className="flex flex-col gap-3 p-4 overflow-auto">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <Badge icon={Icon} label={nodeType} color={getNodeTypeColor(nodeType)} />
                    {riskLevel && <RiskLevelBadge level={riskLevel} />}
                </div>
                <h3 className="text-lg font-bold text-base-content mt-2">{data.name}</h3>
                <p className="text-xs text-base-content/40 font-mono">{data['unique-id']}</p>
            </div>

            {data.description && (
                <p className="text-sm text-base-content/70 leading-relaxed">{data.description}</p>
            )}

            {detailedArch && (
                <div className="flex items-center gap-2 text-xs text-accent font-medium bg-accent/10 rounded-lg px-3 py-2">
                    <ZoomIn className="w-3.5 h-3.5" />
                    Has detailed architecture
                </div>
            )}

            <PropertiesSection properties={extraProps} />
            <InterfacesSection interfaces={interfaces} />
            <ControlsSection controls={controls} />
            <RisksSection risks={risks} riskLevel={riskLevel} />
            <MitigationsSection mitigations={mitigations} />
        </div>
    );
}
