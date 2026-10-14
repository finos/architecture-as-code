import React from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from 'reactflow';
import { getNodeStyleOverride } from '../../utils/building-block-style';
import { theme, tint } from '../theme-colors';

export function ContainerNode({ id, data, selected }: NodeProps) {
    const role = ((data as any).containerRole as string) || 'default';
    const override = getNodeStyleOverride(data as Record<string, unknown>);

    return (
        <>
            <NodeResizer
                isVisible={selected}
                minWidth={180}
                minHeight={120}
                lineStyle={{ borderColor: theme.focus }}
            />
            <Handle type="target" position={Position.Top} style={handleStyle} />
            <Handle type="source" position={Position.Bottom} style={handleStyle} />
            <Handle type="target" position={Position.Left} id="left-target" style={handleStyle} />
            <Handle type="source" position={Position.Right} id="right-source" style={handleStyle} />

            <div style={{ ...containerStyle, ...containerRoleStyle(role), ...(selected ? { borderColor: theme.focus, borderStyle: 'solid' } : {}), ...(override.background ? { background: override.background } : {}) }}>
                <div style={{ ...headerStyle, ...headerRoleStyle(role) }}>
                    <div style={{ ...dotStyle, ...dotRoleStyle(role) }} />
                    <span style={{ ...labelBaseStyle, ...(role === 'solution' ? { color: theme.green, fontWeight: 700 } : {}), ...(override.text ? { color: override.text } : {}) }}>
                        {(data as any).label ?? (data as any).calmId}
                    </span>
                    {role === 'region-primary' && <span style={{ ...tagStyle, background: tint(theme.blue, 22), color: theme.blue }}>ACTIVE</span>}
                    {role === 'region-secondary' && <span style={{ ...tagStyle, background: tint(theme.blue, 16), color: theme.blue }}>STANDBY</span>}
                    {role === 'az' && <span style={{ ...tagStyle, background: tint(theme.fgMuted, 18), color: theme.fgMuted }}>AZ</span>}
                    {role === 'solution' && <span style={{ ...tagStyle, background: tint(theme.green, 22), color: theme.green }}>SOLUTION</span>}
                </div>
                <div style={{ flex: 1 }} />
            </div>
        </>
    );
}

const containerStyle: React.CSSProperties = {
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    border: `1.5px dashed ${theme.fgMuted}`, borderRadius: '8px',
    minWidth: '180px', minHeight: '120px', overflow: 'hidden', cursor: 'default', userSelect: 'none',
};

function containerRoleStyle(role: string): React.CSSProperties {
    switch (role) {
        case 'region-primary': return { borderColor: theme.blue, borderStyle: 'solid', borderWidth: '2px', background: tint(theme.blue, 12) };
        case 'region-secondary': return { borderColor: theme.blue, borderStyle: 'dashed', borderWidth: '2px', background: tint(theme.blue, 8) };
        case 'cluster': return { borderColor: theme.blue, borderStyle: 'dashed', borderWidth: '1.5px', background: tint(theme.blue, 12) };
        case 'az': return { borderColor: theme.fgMuted, borderStyle: 'dotted', borderWidth: '1.5px', background: tint(theme.fgMuted, 10) };
        case 'solution': return { borderColor: theme.green, borderStyle: 'solid', borderWidth: '3px', borderRadius: '12px', background: tint(theme.green, 14) };
        default: return {};
    }
}

const headerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px',
    background: theme.bgWidget, borderBottom: `1px solid ${theme.border}`,
};

function headerRoleStyle(role: string): React.CSSProperties {
    switch (role) {
        case 'region-primary': return { background: tint(theme.blue, 18), borderBottomColor: tint(theme.blue, 35) };
        case 'region-secondary': return { background: tint(theme.blue, 14), borderBottomColor: tint(theme.blue, 28) };
        case 'cluster': return { background: tint(theme.blue, 18), borderBottomColor: tint(theme.blue, 35) };
        case 'az': return { background: tint(theme.fgMuted, 14), borderBottomColor: tint(theme.fgMuted, 28) };
        case 'solution': return { background: tint(theme.green, 18), borderBottomColor: tint(theme.green, 35) };
        default: return {};
    }
}

const dotStyle: React.CSSProperties = { width: '6px', height: '6px', borderRadius: '50%', background: theme.fgMuted, opacity: 0.5, flexShrink: 0 };

function dotRoleStyle(role: string): React.CSSProperties {
    switch (role) {
        case 'region-primary': return { background: theme.blue, opacity: 1 };
        case 'region-secondary': return { background: theme.blue, opacity: 0.7 };
        case 'cluster': return { background: theme.blue, opacity: 1 };
        case 'az': return { background: theme.fgMuted, opacity: 0.7 };
        case 'solution': return { background: theme.green, opacity: 1 };
        default: return {};
    }
}

const labelBaseStyle: React.CSSProperties = {
    fontSize: '10px', fontWeight: 600, color: theme.fg,
    maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
};

const tagStyle: React.CSSProperties = {
    fontSize: '8px', fontWeight: 700, letterSpacing: '0.5px', padding: '1px 5px', borderRadius: '3px', flexShrink: 0,
};
const handleStyle: React.CSSProperties = { width: '6px', height: '6px', background: theme.fgMuted, border: `1px solid ${theme.borderWidget}` };
