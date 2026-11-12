import React, { useState } from 'react';
import type { CalmFlow } from '../../core/types';
import { FlowEditor } from './FlowEditor';

interface FlowListProps {
    flows: CalmFlow[];
    activeFlowId: string | null;
    flowHighlightEnabled: boolean;
    onFlowAdd: (flow: CalmFlow) => void;
    onFlowUpdate: (flowId: string, updates: Partial<CalmFlow>) => void;
    onFlowDelete: (flowId: string) => void;
    onSetActiveFlow: (id: string | null) => void;
    onToggleHighlight: (enabled: boolean) => void;
    onCreateFlowFromAll: () => void;
    readonly?: boolean;
}

export function FlowList({
    flows,
    activeFlowId,
    flowHighlightEnabled,
    onFlowAdd,
    onFlowUpdate,
    onFlowDelete,
    onSetActiveFlow,
    onToggleHighlight,
    onCreateFlowFromAll,
    readonly = false,
}: FlowListProps) {
    const [sectionExpanded, setSectionExpanded] = useState(false);

    const handleAddEmpty = () => {
        // Schema requires minItems:1 on transitions — seed with a placeholder
        onFlowAdd({
            'unique-id': `flow-${Date.now()}`,
            name: 'New Flow',
            description: '',
            transitions: [{ 'relationship-unique-id': '', 'sequence-number': 1, description: '' }],
        });
    };

    return (
        <div style={sectionStyle}>
            <button type="button" style={headerStyle} onClick={() => setSectionExpanded(!sectionExpanded)}>
                <span style={{ fontSize: '8px', display: 'inline-block', transform: sectionExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>&#9654;</span>
                <span style={labelStyle}>
                    Flows <span style={badgeStyle}>{flows.length}</span>
                </span>
            </button>

            {sectionExpanded && (
                <div style={bodyStyle}>
                    {flows.length > 0 && (
                        <label style={toggleRowStyle}>
                            <input
                                type="checkbox"
                                checked={flowHighlightEnabled}
                                onChange={(e) => onToggleHighlight(e.target.checked)}
                                style={checkboxStyle}
                            />
                            <span style={toggleLabelStyle}>Highlight active flow on canvas</span>
                        </label>
                    )}

                    {flows.length > 0 ? (
                        <div style={listStyle}>
                            {flows.map((flow) => (
                                <FlowEditor
                                    key={flow['unique-id']}
                                    flow={flow}
                                    onUpdate={onFlowUpdate}
                                    onDelete={onFlowDelete}
                                    readonly={readonly}
                                />
                            ))}
                        </div>
                    ) : (
                        <p style={emptyStyle}>No flows defined</p>
                    )}

                    {!readonly && (
                        <div style={actionsStyle}>
                            <button onClick={handleAddEmpty} style={addBtnStyle}>+ Add Empty Flow</button>
                            <button onClick={onCreateFlowFromAll} style={addBtnStyle}>+ Create from All Relationships</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const sectionStyle: React.CSSProperties = { borderTop: '1px solid var(--calm-border)' };
const headerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', cursor: 'pointer', width: '100%', background: 'none', border: 'none', color: 'inherit', textAlign: 'left' };
const labelStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--calm-fg-muted)' };
const badgeStyle: React.CSSProperties = { padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 700, background: 'var(--calm-badge-bg)', color: 'var(--calm-badge-fg)', marginLeft: '6px' };
const bodyStyle: React.CSSProperties = { padding: '0 14px 10px' };
const toggleRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', cursor: 'pointer' };
const checkboxStyle: React.CSSProperties = { margin: 0, cursor: 'pointer' };
const toggleLabelStyle: React.CSSProperties = { fontSize: '10px', color: 'var(--calm-fg-muted)' };
const listStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '6px' };
const emptyStyle: React.CSSProperties = { fontSize: '11px', color: 'var(--calm-fg-muted)', fontStyle: 'italic', margin: '0 0 6px' };
const actionsStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '2px' };
const addBtnStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 500, color: 'var(--calm-link)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', textAlign: 'left' };
