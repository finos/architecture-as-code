import React from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { getNodeStyleOverride } from '../../utils/building-block-style';

export function ContainerNode({ id, data, selected }: NodeProps) {
    const role = ((data as any).containerRole as string) || 'default';
    const override = getNodeStyleOverride(data as Record<string, unknown>);

    return (
        <>
            <Handle type="target" position={Position.Top} style={handleStyle} />
            <Handle type="source" position={Position.Bottom} style={handleStyle} />
            <Handle type="target" position={Position.Left} id="left-target" style={handleStyle} />
            <Handle type="source" position={Position.Right} id="right-source" style={handleStyle} />

            <div style={{ ...containerStyle, ...containerRoleStyle(role), ...(selected ? { borderColor: '#6366f1', borderStyle: 'solid' } : {}), ...(override.background ? { background: override.background } : {}) }}>
                <div style={{ ...headerStyle, ...headerRoleStyle(role) }}>
                    <div style={{ ...dotStyle, ...dotRoleStyle(role) }} />
                    <span style={{ ...labelBaseStyle, ...(role === 'solution' ? { color: '#2d6a4f', fontWeight: 700 } : {}), ...(override.text ? { color: override.text } : {}) }}>
                        {(data as any).label ?? (data as any).calmId}
                    </span>
                    {role === 'region-primary' && <span style={{ ...tagStyle, background: 'rgba(26,77,143,0.15)', color: '#1a4d8f' }}>ACTIVE</span>}
                    {role === 'region-secondary' && <span style={{ ...tagStyle, background: 'rgba(26,77,143,0.1)', color: '#1a4d8f' }}>STANDBY</span>}
                    {role === 'az' && <span style={{ ...tagStyle, background: 'rgba(100,116,139,0.12)', color: '#475569' }}>AZ</span>}
                    {role === 'solution' && <span style={{ ...tagStyle, background: 'rgba(45,106,79,0.15)', color: '#2d6a4f' }}>SOLUTION</span>}
                </div>
                <div style={{ flex: 1 }} />
            </div>
        </>
    );
}

const containerStyle: React.CSSProperties = {
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    border: '1.5px dashed #94a3b8', borderRadius: '8px',
    minWidth: '180px', minHeight: '120px', overflow: 'hidden', cursor: 'default', userSelect: 'none',
};

function containerRoleStyle(role: string): React.CSSProperties {
    switch (role) {
        case 'region-primary': return { borderColor: '#1a4d8f', borderStyle: 'solid', borderWidth: '2px', background: 'rgba(26,77,143,0.03)' };
        case 'region-secondary': return { borderColor: '#1a4d8f', borderStyle: 'dashed', borderWidth: '2px', background: 'rgba(26,77,143,0.02)' };
        case 'cluster': return { borderColor: '#1a4d8f', borderStyle: 'dashed', borderWidth: '1.5px', background: 'rgba(26,77,143,0.04)' };
        case 'az': return { borderColor: '#64748b', borderStyle: 'dotted', borderWidth: '1.5px', background: 'rgba(100,116,139,0.04)' };
        case 'solution': return { borderColor: '#2d6a4f', borderStyle: 'solid', borderWidth: '3px', borderRadius: '12px', background: 'rgba(45,106,79,0.06)' };
        default: return {};
    }
}

const headerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px',
    background: '#f1f5f9', borderBottom: '1px solid #e2e8f0',
};

function headerRoleStyle(role: string): React.CSSProperties {
    switch (role) {
        case 'region-primary': return { background: 'rgba(26,77,143,0.08)', borderBottomColor: 'rgba(26,77,143,0.2)' };
        case 'region-secondary': return { background: 'rgba(26,77,143,0.06)', borderBottomColor: 'rgba(26,77,143,0.15)' };
        case 'cluster': return { background: 'rgba(26,77,143,0.08)', borderBottomColor: 'rgba(26,77,143,0.2)' };
        case 'az': return { background: 'rgba(100,116,139,0.06)', borderBottomColor: 'rgba(100,116,139,0.15)' };
        case 'solution': return { background: 'rgba(45,106,79,0.1)', borderBottomColor: 'rgba(45,106,79,0.25)' };
        default: return {};
    }
}

const dotStyle: React.CSSProperties = { width: '6px', height: '6px', borderRadius: '50%', background: '#64748b', opacity: 0.5, flexShrink: 0 };

function dotRoleStyle(role: string): React.CSSProperties {
    switch (role) {
        case 'region-primary': return { background: '#1a4d8f', opacity: 1 };
        case 'region-secondary': return { background: '#1a4d8f', opacity: 0.7 };
        case 'cluster': return { background: '#1a4d8f', opacity: 1 };
        case 'az': return { background: '#64748b', opacity: 0.7 };
        case 'solution': return { background: '#2d6a4f', opacity: 1 };
        default: return {};
    }
}

const labelBaseStyle: React.CSSProperties = {
    fontSize: '10px', fontWeight: 600, color: '#1e293b',
    maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
};

const tagStyle: React.CSSProperties = {
    fontSize: '8px', fontWeight: 700, letterSpacing: '0.5px', padding: '1px 5px', borderRadius: '3px', flexShrink: 0,
};
const handleStyle: React.CSSProperties = { width: '6px', height: '6px', background: '#94a3b8', border: '1px solid #64748b' };
