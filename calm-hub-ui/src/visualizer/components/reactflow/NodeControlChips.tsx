import { Shield } from 'lucide-react';
import { THEME } from './theme.js';

/**
 * Each of a node's controls by name, for presentation mode: an audience cannot hover the node to see what a count
 * stands for.
 */
export function NodeControlChips({ controlIds }: { controlIds: string[] }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px', marginTop: '8px' }}>
            {controlIds.map((controlId) => (
                <div
                    key={controlId}
                    data-testid="node-control-chip"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        maxWidth: '100%',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '16px',
                        fontWeight: 600,
                        background: `${THEME.colors.accent}20`,
                        color: THEME.colors.accentText,
                        overflowWrap: 'anywhere',
                    }}
                >
                    <Shield aria-hidden="true" style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                    <span>{controlId}</span>
                </div>
            ))}
        </div>
    );
}
