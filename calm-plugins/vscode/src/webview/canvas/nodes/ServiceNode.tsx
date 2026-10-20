import React from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from 'reactflow';
import { isBuildingBlock, getNodeStyleOverride } from '../../utils/building-block-style';
import { theme, blockBorder, readableTextOn } from '../theme-colors';
import { SERVICE_FILL } from '../node-colours';
import { ValidationBadge } from './ValidationBadge';

export function ServiceNode({ id, data, selected }: NodeProps) {
    const isBlock = isBuildingBlock(data as Record<string, unknown>);
    const override = getNodeStyleOverride(data as Record<string, unknown>);
    const text = override.text ?? readableTextOn(override.background);
    const errorCount = (data as any).validationErrors ?? 0;
    const warnCount = (data as any).validationWarnings ?? 0;

    return (
        <>
            <Handle type="target" position={Position.Top} />
            <Handle type="source" position={Position.Bottom} />
            <Handle type="target" position={Position.Left} id="left-target" />
            <Handle type="source" position={Position.Right} id="right-source" />

            <NodeResizer isVisible={selected} minWidth={100} minHeight={40} lineStyle={{ borderColor: theme.focus }} />
            <div style={{
                ...baseStyle,
                ...(isBlock ? buildingBlockStyle : {}),
                ...(selected ? selectedStyle : {}),
                ...(override.background ? { background: override.background } : {}),
            }}>
                <ValidationBadge errorCount={errorCount} warnCount={warnCount} nodeId={(data as any).calmId ?? id} />
                <div style={iconStyle}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={text ?? (isBlock ? theme.badgeFg : theme.green)} strokeWidth="1.5">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
                    </svg>
                </div>
                <span style={{ ...labelStyle, ...(isBlock ? labelBlockStyle : {}), ...(text ? { color: text } : {}) }}>
                    {(data as any).label ?? (data as any).calmId}
                </span>
            </div>
        </>
    );
}

const baseStyle: React.CSSProperties = {
    position: 'relative', display: 'flex', alignItems: 'center', gap: '7px',
    width: '100%', height: '100%', padding: '8px 10px', boxSizing: 'border-box',
    background: SERVICE_FILL, border: `1.5px solid ${theme.green}`, borderRadius: '10px',
    cursor: 'default', userSelect: 'none',
};
const buildingBlockStyle: React.CSSProperties = {
    background: theme.badgeBg, borderColor: blockBorder, borderWidth: '2px', borderRadius: '6px',
};
const selectedStyle: React.CSSProperties = {
    borderColor: theme.focus, boxShadow: `0 0 0 1.5px ${theme.focus}`,
};
const iconStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', flexShrink: 0 };
const labelStyle: React.CSSProperties = {
    fontSize: '10px', fontWeight: 600, color: theme.text,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
const labelBlockStyle: React.CSSProperties = { color: theme.badgeFg };
