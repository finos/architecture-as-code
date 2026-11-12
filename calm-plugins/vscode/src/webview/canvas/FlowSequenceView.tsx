import React from 'react';
import type { CalmFlow } from '../../core/types';
import type { CalmArchitecture } from '../transforms/calm-editor-transformer';
import { FlowSequenceDiagram } from './FlowSequenceDiagram';

interface FlowSequenceViewProps {
    flows: CalmFlow[];
    architecture: CalmArchitecture;
    activeFlowId: string | null;
    onFlowSelect: (id: string) => void;
    currentStep?: number;
}

interface FlowStyle {
    background?: string;
    text?: string;
}

function getFlowColor(flow: CalmFlow): string | undefined {
    const meta = flow.metadata as Record<string, unknown> | undefined;
    if (!meta) return undefined;
    const style = meta['flow-style'] as FlowStyle | undefined;
    return style?.background;
}

export function FlowSequenceView({ flows, architecture, activeFlowId, onFlowSelect, currentStep = 0 }: FlowSequenceViewProps) {
    if (flows.length === 0) {
        return (
            <div style={emptyStyle}>
                <span style={{ fontSize: '13px', color: 'var(--calm-fg-muted)' }}>
                    No flows defined. Create one in the Solution panel.
                </span>
            </div>
        );
    }

    if (activeFlowId === '__all__') {
        const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
        const allTransitions: CalmFlow['transitions'] = [];
        const colorByRelId = new Map<string, string>();
        for (let i = 0; i < flows.length; i++) {
            const f = flows[i];
            const color = getFlowColor(f) ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
            for (const t of f.transitions ?? []) {
                allTransitions.push(t);
                if (!colorByRelId.has(t['relationship-unique-id'])) {
                    colorByRelId.set(t['relationship-unique-id'], color);
                }
            }
        }
        const combinedFlow: CalmFlow = {
            'unique-id': '__all__',
            name: 'All Flows',
            description: '',
            transitions: allTransitions.length > 0 ? allTransitions : [{ 'relationship-unique-id': '', 'sequence-number': 1, description: '' }],
        };
        return (
            <FlowSequenceDiagram
                flow={combinedFlow}
                architecture={architecture}
                currentStep={0}
                transitionColors={colorByRelId}
            />
        );
    }

    const selectedFlow = flows.find((f) => f['unique-id'] === activeFlowId) ?? null;

    if (!selectedFlow) {
        const allTransitions: CalmFlow['transitions'] = [];
        let seq = 1;
        for (const rel of architecture.relationships ?? []) {
            const relId = rel['unique-id'] as string;
            if (!relId) continue;
            const rt = rel['relationship-type'] as Record<string, unknown> | undefined;
            if (!rt) continue;
            if (rt['deployed-in'] || rt['composed-of']) continue;
            const desc = (rel as Record<string, unknown>).description as string ?? '';
            allTransitions.push({ 'relationship-unique-id': relId, 'sequence-number': seq, description: desc });
            seq++;
        }
        if (allTransitions.length === 0) {
            return (
                <div style={emptyStyle}>
                    <span style={{ fontSize: '13px', color: 'var(--calm-fg-muted)' }}>No relationships to display.</span>
                </div>
            );
        }
        const combinedFlow: CalmFlow = {
            'unique-id': '__all__',
            name: 'All Relationships',
            description: '',
            transitions: allTransitions,
        };
        return (
            <FlowSequenceDiagram
                flow={combinedFlow}
                architecture={architecture}
                currentStep={0}
            />
        );
    }

    return (
        <FlowSequenceDiagram
            flow={selectedFlow}
            architecture={architecture}
            flowColor={getFlowColor(selectedFlow)}
            currentStep={currentStep}
        />
    );
}

const emptyStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    background: 'var(--calm-bg)',
};
