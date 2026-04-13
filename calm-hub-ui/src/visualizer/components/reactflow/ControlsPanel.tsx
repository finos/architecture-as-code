import { THEME } from './theme.js';
import { ControlsPanelHeader, ControlCard } from './controls-panel/index.js';
import type { ControlsPanelProps } from '../../contracts/contracts.js';

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
