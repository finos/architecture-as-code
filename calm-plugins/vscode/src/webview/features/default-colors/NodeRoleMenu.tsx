import React from 'react';

export interface NodeRole {
    label: string;
    background: string;
    text: string;
    borderColor?: string;
    borderWidth?: number;
    borderStyle?: React.CSSProperties['borderStyle'];
}

const NODE_ROLES: NodeRole[] = [
    { label: 'Solution', background: '#358727', text: '#F9F7F5' },
    { label: 'First Party Application', background: '#05547C', text: '#F9F7F5', borderColor: '#403F3E', borderWidth: 2, borderStyle: 'solid' },
    { label: 'Third Party Application', background: '#DBCA72', text: '#F9F7F5', borderColor: '#FFFFFF', borderWidth: 1, borderStyle: 'solid' },
    { label: 'Generic Application Actor', background: '#403F3E', text: '#F9F7F5', borderColor: '#FFFFFF', borderWidth: 1, borderStyle: 'solid' },
    { label: 'Potential Future Actor', background: '#F9F7F5', text: '#000000', borderColor: '#FFFFFF', borderWidth: 2, borderStyle: 'dashed' },
];

interface NodeRoleMenuProps {
    x: number;
    y: number;
    onSelect: (role: NodeRole) => void;
    onClear: () => void;
    onClose: () => void;
}

export function NodeRoleMenu({ x, y, onSelect, onClear, onClose }: NodeRoleMenuProps) {
    return (
        <div style={backdropStyle} onClick={onClose} onContextMenu={(event) => { event.preventDefault(); onClose(); }}>
            <div style={{ ...menuStyle, left: x, top: y }} onClick={(event) => event.stopPropagation()}>
                <div style={headerStyle}>Set Node Role</div>
                {NODE_ROLES.map((role) => (
                    <button key={role.label} type="button" style={itemStyle} onClick={() => { onSelect(role); onClose(); }}>
                        <span style={{ ...swatchStyle, background: role.background, borderColor: role.borderColor ?? swatchStyle.borderColor, borderWidth: role.borderWidth ?? swatchStyle.borderWidth, borderStyle: role.borderStyle ?? swatchStyle.borderStyle }} />
                        {role.label}
                    </button>
                ))}
                <div style={dividerStyle} />
                <button type="button" style={itemStyle} onClick={() => { onClear(); onClose(); }}>Reset to Default</button>
            </div>
        </div>
    );
}

const backdropStyle: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 2000 };
const menuStyle: React.CSSProperties = { position: 'fixed', background: 'var(--calm-bg)', border: '1px solid var(--calm-border-input)', borderRadius: '6px', padding: '4px 0', boxShadow: '0 4px 16px rgba(0,0,0,0.5)', minWidth: '200px', zIndex: 2001 };
const headerStyle: React.CSSProperties = { fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--calm-fg-muted)', padding: '4px 12px 2px', letterSpacing: '0.3px' };
const itemStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 12px', fontSize: '12px', color: 'var(--calm-fg)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' };
const swatchStyle: React.CSSProperties = { width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0, borderStyle: 'solid', borderWidth: '1px', borderColor: 'rgba(255,255,255,0.2)' };
const dividerStyle: React.CSSProperties = { height: '1px', background: 'var(--calm-border)', margin: '4px 0' };