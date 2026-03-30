import { CalmRelationshipSchema } from '@finos/calm-models/types';
import { ArrowRight, GitFork, Container, Layers } from 'lucide-react';
import { extractRelationshipType } from '../reactflow/utils/calmHelpers.js';
import type { ControlItem } from '../../contracts/contracts.js';
import {
    Badge, RiskLevelBadge, Section,
    PropertiesSection, ControlsSection, RisksSection, MitigationsSection,
    ConnectionDiagram, NodeList,
    extractAigf, getExtraProperties,
} from './detail-components.js';

const KNOWN_FIELDS = new Set([
    'unique-id', 'description', 'relationship-type', 'protocol', 'controls', 'metadata',
]);

function getRelTypeInfo(relType: ReturnType<typeof extractRelationshipType>) {
    if (!relType) return { kind: 'unknown', icon: ArrowRight, color: '#94a3b8' };
    if ('connects' in relType) return { kind: 'connects', icon: ArrowRight, color: '#3b82f6' };
    if ('interacts' in relType) return { kind: 'interacts', icon: GitFork, color: '#8b5cf6' };
    if ('deployed-in' in relType) return { kind: 'deployed-in', icon: Container, color: '#f59e0b' };
    if ('composed-of' in relType) return { kind: 'composed-of', icon: Layers, color: '#10b981' };
    if ('options' in relType) return { kind: 'options', icon: GitFork, color: '#6366f1' };
    return { kind: 'unknown', icon: ArrowRight, color: '#94a3b8' };
}

function LabeledValue({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-base-200 rounded-lg px-3 py-2">
            <span className="text-xs text-base-content/50 font-medium">{label}</span>
            <p className="text-xs font-mono font-semibold text-base-content mt-0.5">{value}</p>
        </div>
    );
}

function ContainerWithNodes({ title, containerLabel, container, nodesLabel, nodes }: {
    title: string;
    containerLabel: string;
    container: string;
    nodesLabel: string;
    nodes: string[];
}) {
    return (
        <Section title={title}>
            <div className="flex flex-col gap-2">
                <LabeledValue label={containerLabel} value={container} />
                <NodeList label={nodesLabel} nodes={nodes} />
            </div>
        </Section>
    );
}

function RelationshipTypeSection({ relType }: { relType: NonNullable<ReturnType<typeof extractRelationshipType>> }) {
    if ('connects' in relType && relType.connects) {
        return (
            <Section title="Connection">
                <ConnectionDiagram nodes={[
                    relType.connects.source?.node || '?',
                    relType.connects.destination?.node || '?',
                ]} />
            </Section>
        );
    }
    if ('interacts' in relType && relType.interacts) {
        return (
            <ContainerWithNodes
                title="Interaction"
                containerLabel="Actor"
                container={relType.interacts.actor}
                nodesLabel="Interacts with"
                nodes={relType.interacts.nodes || []}
            />
        );
    }
    if ('deployed-in' in relType && relType['deployed-in']) {
        return (
            <ContainerWithNodes
                title="Deployment"
                containerLabel="Container"
                container={relType['deployed-in'].container}
                nodesLabel="Deployed nodes"
                nodes={relType['deployed-in'].nodes || []}
            />
        );
    }
    if ('composed-of' in relType && relType['composed-of']) {
        return (
            <ContainerWithNodes
                title="Composition"
                containerLabel="Container"
                container={relType['composed-of'].container}
                nodesLabel="Composed of"
                nodes={relType['composed-of'].nodes || []}
            />
        );
    }
    return null;
}

export function RelationshipDetails({ data }: { data: CalmRelationshipSchema }) {
    const relType = extractRelationshipType(data);
    const { kind, icon: RelIcon, color } = getRelTypeInfo(relType);

    const aigf = extractAigf(data.metadata);
    const riskLevel = aigf?.['risk-level'];
    const risks = aigf?.risks || [];
    const mitigations = aigf?.mitigations || [];

    const controls: Record<string, ControlItem> = data.controls || {};
    const extraProps = getExtraProperties(data as unknown as Record<string, unknown>, KNOWN_FIELDS);

    return (
        <div className="flex flex-col gap-3 p-4 overflow-auto">
            <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge icon={RelIcon} label={kind} color={color} />
                    {data.protocol && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-base-300 text-base-content">
                            {data.protocol}
                        </span>
                    )}
                    {riskLevel && <RiskLevelBadge level={riskLevel} />}
                </div>
                {data.description && (
                    <h3 className="text-base font-bold text-base-content mt-2">{data.description}</h3>
                )}
                <p className="text-xs text-base-content/40 font-mono">{data['unique-id']}</p>
            </div>

            {relType && <RelationshipTypeSection relType={relType} />}

            <PropertiesSection properties={extraProps} />
            <ControlsSection controls={controls} />
            <RisksSection risks={risks} riskLevel={riskLevel} />
            <MitigationsSection mitigations={mitigations} />
        </div>
    );
}
