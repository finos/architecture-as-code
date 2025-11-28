import { THEME } from './theme';
import { ControlsPanelHeader, ControlCard } from './controls-panel';

// Types for CALM control data
export interface ControlRequirementConfig {
    appliesTo?: {
        nodes?: string[];
        relationships?: string[];
    };
    [key: string]: unknown;
}

export interface ControlRequirement {
    'requirement-url'?: string;
    'config-url'?: string;
    config?: ControlRequirementConfig;
}

export interface Control {
    description?: string;
    requirements?: ControlRequirement[];
    'aigf-mitigations'?: string[];
    'aigf-risks'?: string[];
    // Extended properties added during extraction
    appliesTo?: string;
    nodeName?: string;
    relationshipDescription?: string;
    appliesToType?: 'node' | 'relationship';
}

interface ControlsPanelProps {
    controls: Record<string, Control>;
    onNodeClick?: (nodeId: string) => void;
    onControlClick?: (controlId: string) => void;
}

export function ControlsPanel({ controls, onNodeClick, onControlClick }: ControlsPanelProps) {
    if (!controls || Object.keys(controls).length === 0) return null;

    const controlEntries = Object.entries(controls);

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
            <ControlsPanelHeader controlCount={controlEntries.length} />

            <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {controlEntries.map(([controlId, control]) => (
                        <ControlCard
                            key={controlId}
                            controlId={controlId}
                            control={control}
                            onNodeClick={onNodeClick}
                            onControlClick={onControlClick}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
