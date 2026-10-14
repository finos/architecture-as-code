import React, { useState, useRef, useCallback } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, type EdgeProps } from 'reactflow';
import { theme } from '../theme-colors';
import { ArrowMarker, arrowMarkerId } from './ArrowMarker';

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

/** The colour of the edge line and its arrowheads. */
export function edgeStroke(hovered: boolean, style?: React.CSSProperties): string {
    return hovered ? theme.link : (style?.stroke ?? theme.fgMuted);
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
    const edgeStyle = style as React.CSSProperties | undefined;
    const stroke = edgeStroke(hovered, edgeStyle);
    const endMarkerId = markerEnd ? arrowMarkerId(id, 'end') : undefined;
    const startMarkerId = markerStart ? arrowMarkerId(id, 'start') : undefined;
    const endMarkerUrl = endMarkerId && `url(#${endMarkerId})`;
    const startMarkerUrl = startMarkerId && `url(#${startMarkerId})`;
    const pathStyle: React.CSSProperties = {
        ...edgeStyle,
        stroke,
        ...(dashArray ? { strokeDasharray: dashArray } : {}),
        ...(hovered ? { strokeWidth: 2.5 } : {}),
    };

    return (
        <>
            <defs>
                {endMarkerId && <ArrowMarker id={endMarkerId} color={stroke} />}
                {startMarkerId && <ArrowMarker id={startMarkerId} color={stroke} />}
            </defs>
            <BaseEdge
                id={id}
                path={edgePath}
                markerEnd={endMarkerUrl}
                markerStart={startMarkerUrl}
                style={pathStyle}
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
                {/* SVG paints edges in DOM order, so other edges can cover the hovered one where
                    they meet. The label layer is above all edges, so draw the hovered edge again here. */}
                {hovered && (
                    <svg style={hoverLayerStyle}>
                        <path
                            d={edgePath}
                            fill="none"
                            markerEnd={endMarkerUrl}
                            markerStart={startMarkerUrl}
                            style={pathStyle}
                        />
                    </svg>
                )}

                {/* Always-visible label (protocol) */}
                {label && (
                    <div
                        style={{
                            position: 'absolute',
                            zIndex: 1,
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            pointerEvents: 'none',
                            fontSize: '9px',
                            fontWeight: 500,
                            color: theme.fgMuted,
                            background: theme.bgWidget,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            border: `1px solid ${theme.border}`,
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
                                    <span style={{ ...tooltipValue, color: theme.link }}>{protocol}</span>
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

const hoverLayerStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 1,
    height: 1,
    overflow: 'visible',
    pointerEvents: 'none',
};

const tooltipStyle: React.CSSProperties = {
    background: 'var(--calm-bg)',
    border: '1px solid var(--calm-border-input)',
    borderRadius: '6px',
    padding: '8px 10px',
    boxShadow: `0 4px 12px ${theme.shadow}`,
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
