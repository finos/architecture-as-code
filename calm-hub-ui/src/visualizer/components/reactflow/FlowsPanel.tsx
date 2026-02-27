import { THEME } from './theme.js';
import { FlowsPanelHeader, FlowCard } from './flows-panel/index.js';
import type { FlowsPanelProps } from '../../contracts/contracts.js';

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
