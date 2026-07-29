import React from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { getNodeStyleOverride } from '../../utils/building-block-style';
import { ValidationBadge } from './ValidationBadge';

export function DatabaseNode({ id, data, selected }: NodeProps) {
    const override = getNodeStyleOverride(data as Record<string, unknown>);
    const fill = override.background ?? '#e6f4ea';
    const errorCount = (data as any).validationErrors ?? 0;
    const warnCount = (data as any).validationWarnings ?? 0;

    return (
        <>
            <Handle type="target" position={Position.Top} style={handleStyle} />
            <Handle type="source" position={Position.Bottom} style={handleStyle} />
            <Handle type="target" position={Position.Left} id="left-target" style={handleStyle} />
            <Handle type="source" position={Position.Right} id="right-source" style={handleStyle} />

            <div style={nodeStyle}>
                <ValidationBadge errorCount={errorCount} warnCount={warnCount} nodeId={(data as any).calmId ?? id} />
                <svg width="48" height="44" viewBox="0 0 48 44" fill="none" aria-hidden="true">
                    <ellipse cx="24" cy="8" rx="20" ry="6" fill={fill} stroke={selected ? '#6366f1' : '#1b7340'} strokeWidth="1.5" />
                    <path d="M4 8v28c0 3.3 9 6 20 6s20-2.7 20-6V8" fill={fill} stroke={selected ? '#6366f1' : '#1b7340'} strokeWidth="1.5" />
                    <ellipse cx="24" cy="36" rx="20" ry="6" fill="none" stroke={selected ? '#6366f1' : '#1b7340'} strokeWidth="1.5" />
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
    padding: '2px 4px',
    cursor: 'default',
    userSelect: 'none',
};

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
