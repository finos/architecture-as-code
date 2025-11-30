import { THEME } from './theme';
import { FlowsPanelHeader, FlowCard } from './flows-panel';

// Types for CALM flow data
export interface FlowTransition {
    'sequence-number': number;
    'relationship-unique-id': string;
    description?: string;
    direction?: string;
}

export interface AIGFGovernance {
    'mitigations-applied'?: string[];
    'risks-addressed'?: string[];
    'trust-boundaries-crossed'?: string[];
}

export interface Flow {
    'unique-id': string;
    name: string;
    description?: string;
    transitions?: FlowTransition[];
    'aigf-governance'?: AIGFGovernance;
}

interface FlowsPanelProps {
    flows: Flow[];
    onTransitionClick?: (relationshipId: string) => void;
}

export function FlowsPanel({ flows, onTransitionClick }: FlowsPanelProps) {
    if (!flows || flows.length === 0) return null;

    return (
        <div
            style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                border: `1px solid ${THEME.colors.border}`,
                borderRadius: '8px',
                background: THEME.colors.card,
                overflow: 'hidden',
            }}
        >
            <FlowsPanelHeader flowCount={flows.length} />

            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {flows.map((flow) => (
                        <FlowCard
                            key={flow['unique-id']}
                            flow={flow}
                            onTransitionClick={onTransitionClick}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
