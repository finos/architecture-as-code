import React from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from 'reactflow';
import { isStandardNode, getNodeStyleOverride } from '../../utils/standard-node-style';
import { theme, blockBorder } from '../theme-colors';
import { ValidationBadge } from './ValidationBadge';
import { NodeTooltip } from './NodeTooltip';
import { CanvasNodeIcon } from './CanvasNodeIcon';

interface SharedCardNodeProps extends NodeProps {
    width?: number;
    height?: number;
    defaultBackground: string;
    defaultBorder: string;
    defaultIconColor?: string;
    iconSize?: number;
    minWidth?: number;
    minHeight?: number;
    applicationId?: string;
    fallback?: React.ReactNode;
}

export function SharedCardNode({
    id,
    data,
    selected,
    width,
    height,
    defaultBackground,
    defaultBorder,
    defaultIconColor,
    iconSize = 32,
    minWidth = 40,
    minHeight = 40,
    applicationId,
    fallback,
}: SharedCardNodeProps) {
    const isBlock = isStandardNode(data as Record<string, unknown>);
    const override = getNodeStyleOverride(data as Record<string, unknown>);
    const errorCount = (data as any).validationErrors ?? 0;
    const warnCount = (data as any).validationWarnings ?? 0;
    const iconColor = override.text ?? (isBlock ? theme.badgeFg : (selected ? theme.focus : (defaultIconColor ?? defaultBorder)));
    const availableWidth = typeof width === 'number' ? width : minWidth;
    const availableHeight = typeof height === 'number' ? height : minHeight;
    const compact = availableHeight <= 90 || availableWidth <= 200;
    const veryCompact = availableHeight <= 48 || availableWidth <= 48;
    const effectiveIconSize = Math.min(iconSize, veryCompact ? 22 : compact ? 28 : iconSize);
    const iconFrameSize = Math.max(effectiveIconSize + (veryCompact ? 4 : 6), veryCompact ? 26 : 34);
    const showAppId = Boolean(applicationId) && availableHeight >= 64 && availableWidth >= 100;
    const showDescription = Boolean((data as any).description) && availableHeight >= 104 && availableWidth >= 220;
    const cardStyle = compact ? compactBaseStyle(veryCompact, minWidth, minHeight) : regularBaseStyle(minWidth, minHeight);

    return (
        <>
            <Handle type="target" position={Position.Top} style={handleStyle} />
            <Handle type="source" position={Position.Bottom} style={handleStyle} />
            <Handle type="target" position={Position.Left} id="left-target" style={handleStyle} />
            <Handle type="source" position={Position.Right} id="right-source" style={handleStyle} />

            <NodeTooltip description={(data as any).description} nodeType={(data as any).calmType} controls={(data as any).controls}>
                <div style={{
                    ...cardStyle,
                    background: defaultBackground,
                    borderColor: defaultBorder,
                    ...(isBlock ? buildingBlockStyle : {}),
                    ...(selected ? selectedStyle : {}),
                    ...(override.background ? { background: override.background } : {}),
                }}>
                        <NodeResizer isVisible={selected} minWidth={minWidth} minHeight={minHeight} lineStyle={{ borderColor: '#6366f1' }} handleStyle={{ width: '6px', height: '6px', background: '#6366f1', borderRadius: '2px' }} />
                    <ValidationBadge errorCount={errorCount} warnCount={warnCount} nodeId={(data as any).calmId ?? id} />
                    {(data as any).controls && Object.keys((data as any).controls).length > 0 && (
                        <span style={{ ...controlsBadge(compact), ...(override.text ? { color: override.text, background: 'rgba(255,255,255,0.2)' } : {}) }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            {Object.keys((data as any).controls).length}
                        </span>
                    )}
                    <div style={iconStyle(iconFrameSize)}>
                        <CanvasNodeIcon
                            calmType={(data as any).calmType}
                            color={iconColor}
                            size={effectiveIconSize}
                            fallback={fallback}
                        />
                    </div>
                    {!veryCompact && <div style={contentStyle(compact)}>
                        <span style={{ ...labelStyle(compact, veryCompact), ...(isBlock ? labelBlockStyle : {}), ...(override.text ? { color: override.text } : {}) }}>
                            {(data as any).label ?? (data as any).calmId}
                        </span>
                        {showAppId && (
                            <div style={{ ...appIdStyle, ...(override.text ? { color: override.text, opacity: 0.8 } : {}) }}>
                                {applicationId}
                            </div>
                        )}
                        {showDescription && (
                            <div style={{ ...descStyle, ...(isBlock ? { color: 'rgba(255,255,255,0.6)' } : {}), ...(override.text ? { color: override.text, opacity: 0.6 } : {}) }}>
                                {(data as any).description.length > 40 ? (data as any).description.slice(0, 40) + '...' : (data as any).description}
                            </div>
                        )}
                    </div>}
                </div>
            </NodeTooltip>
        </>
    );
}

const cardBaseStyle: React.CSSProperties = {
    position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px',
    width: '100%', height: '100%', boxSizing: 'border-box',
    border: '1.5px solid', borderRadius: '14px',
    cursor: 'default', userSelect: 'none',
};
const regularBaseStyle = (minWidth: number, minHeight: number): React.CSSProperties => ({
    ...cardBaseStyle,
    minWidth: `${minWidth}px`,
    minHeight: `${minHeight}px`,
    padding: '14px 16px',
    gap: '10px',
});
const compactBaseStyle = (veryCompact: boolean, minWidth: number, minHeight: number): React.CSSProperties => ({
    ...cardBaseStyle,
    minWidth: `${minWidth}px`,
    minHeight: `${minHeight}px`,
    padding: veryCompact ? '2px 4px' : '4px 8px',
    gap: veryCompact ? '2px' : '4px',
    borderRadius: veryCompact ? '12px' : '14px',
});
const buildingBlockStyle: React.CSSProperties = {
    background: theme.badgeBg, borderColor: blockBorder, borderWidth: '2px', borderRadius: '6px',
};
const selectedStyle: React.CSSProperties = {
    borderColor: '#6366f1', boxShadow: '0 0 0 1.5px #6366f1',
};
const iconStyle = (iconFrameSize: number): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: `${iconFrameSize}px`,
    minWidth: `${iconFrameSize}px`,
    height: `${iconFrameSize}px`,
    flexShrink: 0,
    lineHeight: 0,
});
const contentStyle = (compact: boolean): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minWidth: 0,
    textAlign: 'center',
    gap: compact ? '1px' : '2px',
});
const labelStyle = (compact: boolean, veryCompact: boolean): React.CSSProperties => ({
    fontSize: veryCompact ? '11px' : compact ? '11.5px' : '12px',
    fontWeight: 700,
    color: '#1e293b',
    wordBreak: 'break-word',
    lineHeight: veryCompact ? 1.15 : 1.25,
    overflow: 'hidden',
    maxWidth: '100%',
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: veryCompact ? 2 : 2,
});
const labelBlockStyle: React.CSSProperties = { color: '#ffffff' };
const appIdStyle: React.CSSProperties = { fontSize: '9px', fontWeight: 700, color: '#f59e0b', fontFamily: 'monospace', marginTop: '2px' };
const descStyle: React.CSSProperties = { fontSize: '9px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', whiteSpace: 'nowrap', marginTop: '2px' };
const controlsBadge = (compact: boolean): React.CSSProperties => ({ position: 'absolute', top: compact ? '6px' : '8px', right: compact ? '6px' : '8px', display: 'inline-flex', alignItems: 'center', gap: compact ? '1px' : '2px', fontSize: compact ? '8px' : '9px', fontWeight: 600, color: '#60a5fa', flexShrink: 0, padding: compact ? '1px 3px' : '1px 4px', background: 'rgba(96,165,250,0.1)', borderRadius: '4px' });
const handleStyle: React.CSSProperties = { width: '8px', height: '8px', background: '#94a3b8', border: '1px solid #64748b' };