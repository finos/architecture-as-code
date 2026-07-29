import React from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { getNodeStyleOverride } from '../../utils/building-block-style';
import { ValidationBadge } from './ValidationBadge';

export function ActorNode({ id, data, selected }: NodeProps) {
    const override = getNodeStyleOverride(data as Record<string, unknown>);
    const fill = override.background ?? '#f5f5f5';
    const errorCount = (data as any).validationErrors ?? 0;
    const warnCount = (data as any).validationWarnings ?? 0;

    return (
        <>
            <Handle type="target" position={Position.Top} style={handleStyle} />
            <Handle type="source" position={Position.Bottom} style={handleStyle} />
            <Handle type="target" position={Position.Left} id="left-target" style={handleStyle} />
            <Handle type="source" position={Position.Right} id="right-source" style={handleStyle} />

            <div style={{ ...nodeStyle, ...(selected ? selectedStyle : {}) }}>
                <ValidationBadge errorCount={errorCount} warnCount={warnCount} nodeId={(data as any).calmId ?? id} />
                <svg width="32" height="40" viewBox="0 0 32 40" fill="none" aria-hidden="true">
                    <circle cx="16" cy="9" r="7" fill={fill} stroke={selected ? '#6366f1' : '#333333'} strokeWidth={selected ? '2' : '1.5'} />
                    <path d="M6 36 Q6 22 16 22 Q26 22 26 36" fill={fill} stroke={selected ? '#6366f1' : '#333333'} strokeWidth={selected ? '2' : '1.5'} />
                </svg>
                <span style={{ ...labelStyle, ...(override.text ? { color: override.text } : {}) }}>{(data as any).label ?? (data as any).calmId}</span>
            </div>
        </>
    );
}

const nodeStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3px',
    padding: '4px 6px',
    cursor: 'default',
    userSelect: 'none',
};

const selectedStyle: React.CSSProperties = {};

const labelStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--calm-fg)',
    textAlign: 'center',
    maxWidth: '80px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
};

const handleStyle: React.CSSProperties = { width: '8px', height: '8px', background: '#94a3b8', border: '1px solid #64748b' };
