import React, { useState, useRef, useCallback } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, type EdgeProps } from 'reactflow';

export type EdgeDirection = 'source-to-target' | 'bidirectional' | 'none';
export type EdgeLineStyle = 'solid' | 'dashed' | 'dotted';
export type EdgeRouting = 'bezier' | 'smoothstep' | 'straight';

function strokeDasharray(lineStyle: EdgeLineStyle | undefined): string | undefined {
    switch (lineStyle) {
        case 'dashed': return '8 4';
        case 'dotted': return '2 4';
        default: return undefined;
    }
}

export function TooltipEdge({
    id, sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition, data, markerEnd, markerStart, style, label,
}: EdgeProps) {
    const [hovered, setHovered] = useState(false);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showTooltip = useCallback(() => {
        if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
        setHovered(true);
    }, []);

    const scheduleHide = useCallback(() => {
        hideTimer.current = setTimeout(() => setHovered(false), 200);
    }, []);

    const edgeData = (data ?? {}) as Record<string, unknown>;
    const routing = (edgeData.routing as EdgeRouting) ?? 'bezier';

    const pathParams = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition };
    const [edgePath, labelX, labelY] = routing === 'smoothstep'
        ? getSmoothStepPath(pathParams)
        : routing === 'straight'
            ? getStraightPath(pathParams)
            : getBezierPath(pathParams);

    const description = edgeData.description as string | undefined;
    const protocol = edgeData.protocol as string | undefined;
    const variant = edgeData.calmVariant as string | undefined;
    const lineStyle = edgeData.lineStyle as EdgeLineStyle | undefined;

    const hasTooltipContent = !!(description || protocol);
    const dashArray = strokeDasharray(lineStyle);

    return (
        <>
            <BaseEdge
                id={id}
                path={edgePath}
                markerEnd={markerEnd}
                markerStart={markerStart}
                style={{
                    ...(style as React.CSSProperties),
                    ...(dashArray ? { strokeDasharray: dashArray } : {}),
                    ...(hovered ? { stroke: '#60a5fa', strokeWidth: 2.5 } : {}),
                }}
            />

            {/* Transparent overlay for hover detection */}
            <path
                d={edgePath}
                fill="none"
                strokeWidth={20}
                stroke="transparent"
                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                onMouseEnter={showTooltip}
                onMouseLeave={scheduleHide}
            />

            <EdgeLabelRenderer>
                {/* Always-visible label (protocol) */}
                {label && (
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            pointerEvents: 'none',
                            fontSize: '9px',
                            fontWeight: 500,
                            color: '#64748b',
                            background: 'rgba(248,250,252,0.9)',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            border: '1px solid rgba(148,163,184,0.3)',
                        }}
                    >
                        {label}
                    </div>
                )}

                {/* Tooltip on hover */}
                {hovered && hasTooltipContent && (
                    <div
                        onMouseEnter={showTooltip}
                        onMouseLeave={scheduleHide}
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, calc(-100% - 12px)) translate(${labelX}px,${labelY}px)`,
                            pointerEvents: 'all',
                            zIndex: 1000,
                        }}
                    >
                        <div style={tooltipStyle}>
                            {variant && (
                                <div style={tooltipRow}>
                                    <span style={tooltipLabel}>Type</span>
                                    <span style={tooltipValue}>{variant}</span>
                                </div>
                            )}
                            {protocol && (
                                <div style={tooltipRow}>
                                    <span style={tooltipLabel}>Protocol</span>
                                    <span style={{ ...tooltipValue, color: '#60a5fa' }}>{protocol}</span>
                                </div>
                            )}
                            {description && (
                                <div style={tooltipRow}>
                                    <span style={tooltipLabel}>Description</span>
                                    <span style={tooltipValue}>{description}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </EdgeLabelRenderer>
        </>
    );
}

const tooltipStyle: React.CSSProperties = {
    background: 'var(--calm-bg)',
    border: '1px solid var(--calm-border-input)',
    borderRadius: '6px',
    padding: '8px 10px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
    minWidth: '150px',
    maxWidth: '300px',
};

const tooltipRow: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    alignItems: 'baseline',
    marginBottom: '3px',
};

const tooltipLabel: React.CSSProperties = {
    fontSize: '9px',
    fontWeight: 700,
    color: 'var(--calm-fg-muted)',
    textTransform: 'uppercase',
    flexShrink: 0,
    minWidth: '60px',
};

const tooltipValue: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--calm-fg)',
    lineHeight: 1.3,
    wordBreak: 'break-word',
};
