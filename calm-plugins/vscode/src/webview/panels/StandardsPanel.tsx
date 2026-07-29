import React from 'react';

interface StandardsPanelProps {
    requirementUrl: string;
    prose: string | null;
    onClose: () => void;
}

export function StandardsPanel({ requirementUrl, prose, onClose }: StandardsPanelProps) {
    return (
        <div style={panelStyle}>
            <div style={headerStyle}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--calm-fg)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{requirementUrl}</span>
                <button onClick={onClose} style={closeBtnStyle}>&times;</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', fontSize: '12px', color: 'var(--calm-fg)', lineHeight: 1.6 }}>
                {prose ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{prose}</div>
                ) : (
                    <div style={{ color: 'var(--calm-fg-muted)', fontStyle: 'italic' }}>Loading requirement prose...</div>
                )}
            </div>
        </div>
    );
}

const panelStyle: React.CSSProperties = {
    position: 'absolute', top: '10%', right: '10%', width: '400px', maxHeight: '60%',
    display: 'flex', flexDirection: 'column',
    background: 'var(--calm-bg)', border: '1px solid var(--calm-border-heavy)', borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 200,
};
const headerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
    borderBottom: '1px solid var(--calm-border)', flexShrink: 0,
};
const closeBtnStyle: React.CSSProperties = { border: 'none', background: 'transparent', color: 'var(--calm-fg)', cursor: 'pointer', fontSize: '16px', padding: '4px' };
