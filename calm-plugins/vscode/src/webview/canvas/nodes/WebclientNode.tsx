import React from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from 'reactflow';
import { isBuildingBlock, getNodeStyleOverride, CUSTOM_TEXT, CUSTOM_BG, CUSTOM_BORDER } from '../../utils/building-block-style';
import { ValidationBadge } from './ValidationBadge';

export function WebclientNode({ id, data, selected }: NodeProps) {
    const isBlock = isBuildingBlock(data as Record<string, unknown>);
    const override = getNodeStyleOverride(data as Record<string, unknown>);
    const errorCount = (data as any).validationErrors ?? 0;
    const warnCount = (data as any).validationWarnings ?? 0;

    return (
        <>
            <NodeResizer isVisible={selected} minWidth={100} minHeight={40} lineStyle={{ borderColor: '#6366f1' }} handleStyle={{ width: '6px', height: '6px', background: '#6366f1', borderRadius: '2px' }} />
            <Handle type="target" position={Position.Top} style={handleStyle} />
            <Handle type="source" position={Position.Bottom} style={handleStyle} />
            <Handle type="target" position={Position.Left} id="left-target" style={handleStyle} />
            <Handle type="source" position={Position.Right} id="right-source" style={handleStyle} />

            <div style={{
                ...baseStyle,
                ...(isBlock ? buildingBlockStyle : {}),
                ...(selected ? selectedStyle : {}),
                ...(override.background ? { background: override.background } : {}),
            }}>
                <ValidationBadge errorCount={errorCount} warnCount={warnCount} nodeId={(data as any).calmId ?? id} />
                <div style={iconStyle}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={override.text ?? (isBlock ? CUSTOM_TEXT : '#0369a1')} strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                    </svg>
                </div>
                <span style={{ ...labelStyle, ...(isBlock ? labelBlockStyle : {}), ...(override.text ? { color: override.text } : {}) }}>
                    {(data as any).label ?? (data as any).calmId}
                </span>
            </div>
        </>
    );
}

const baseStyle: React.CSSProperties = {
    position: 'relative', display: 'flex', alignItems: 'center', gap: '7px',
    width: '100%', height: '100%', padding: '8px 10px',
    background: '#e0f2fe', border: '1.5px solid #0369a1', borderRadius: '10px',
    cursor: 'default', userSelect: 'none',
};
const buildingBlockStyle: React.CSSProperties = {
    background: CUSTOM_BG, borderColor: CUSTOM_BORDER, borderWidth: '2px', borderRadius: '6px',
};
const selectedStyle: React.CSSProperties = {
    borderColor: '#6366f1', boxShadow: '0 0 0 1.5px #6366f1',
};
const iconStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', flexShrink: 0 };
const labelStyle: React.CSSProperties = {
    fontSize: '10px', fontWeight: 600, color: '#1e293b',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
const labelBlockStyle: React.CSSProperties = { color: '#ffffff' };
const handleStyle: React.CSSProperties = { width: '8px', height: '8px', background: '#94a3b8', border: '1px solid #64748b' };
