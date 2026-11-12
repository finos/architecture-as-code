import React from 'react';

interface FlowBadge {
    flowId: string;
    name: string;
    color: string;
}

interface FlowContextMenuProps {
    x: number;
    y: number;
    relationshipId: string;
    reverseRelationshipId?: string;
    memberFlows: FlowBadge[];
    availableFlows: FlowBadge[];
    onAddToFlow: (flowId: string, relId: string) => void;
    onRemoveFromFlow: (flowId: string, relId: string, reverseRelId?: string) => void;
    onClose: () => void;
}

export function FlowContextMenu({
    x, y,
    relationshipId,
    reverseRelationshipId,
    memberFlows,
    availableFlows,
    onAddToFlow,
    onRemoveFromFlow,
    onClose,
}: FlowContextMenuProps) {
    return (
        <div style={{ ...backdropStyle }} onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
            <div style={{ ...menuStyle, left: x, top: y }} onClick={(e) => e.stopPropagation()}>
                {memberFlows.length > 0 && (
                    <>
                        <div style={headerStyle}>Remove from Flow</div>
                        {memberFlows.map((f) => (
                            <button
                                key={f.flowId}
                                type="button"
                                style={itemStyle}
                                onClick={() => { onRemoveFromFlow(f.flowId, relationshipId, reverseRelationshipId); onClose(); }}
                            >
                                <span style={{ ...dotStyle, background: f.color }} />
                                {f.name}
                            </button>
                        ))}
                    </>
                )}
                {availableFlows.length > 0 && (
                    <>
                        {memberFlows.length > 0 && <div style={dividerStyle} />}
                        <div style={headerStyle}>Add to Flow</div>
                        {availableFlows.map((f) => (
                            <button
                                key={f.flowId}
                                type="button"
                                style={itemStyle}
                                onClick={() => { onAddToFlow(f.flowId, relationshipId); onClose(); }}
                            >
                                <span style={{ ...dotStyle, background: f.color }} />
                                {f.name}
                            </button>
                        ))}
                    </>
                )}
                {memberFlows.length === 0 && availableFlows.length === 0 && (
                    <div style={{ ...headerStyle, fontStyle: 'italic' }}>No flows defined</div>
                )}
            </div>
        </div>
    );
}

const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
};
const menuStyle: React.CSSProperties = {
    position: 'fixed',
    background: 'var(--calm-bg)',
    border: '1px solid var(--calm-border-input)',
    borderRadius: '6px',
    padding: '4px 0',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    minWidth: '180px',
    zIndex: 2001,
};
const headerStyle: React.CSSProperties = {
    fontSize: '9px',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--calm-fg-muted)',
    padding: '4px 12px 2px',
    letterSpacing: '0.3px',
};
const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '6px 12px',
    fontSize: '12px',
    color: 'var(--calm-fg)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
};
const dotStyle: React.CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
    border: '1px solid rgba(255,255,255,0.2)',
};
const dividerStyle: React.CSSProperties = {
    height: '1px',
    background: 'var(--calm-border)',
    margin: '4px 0',
};
