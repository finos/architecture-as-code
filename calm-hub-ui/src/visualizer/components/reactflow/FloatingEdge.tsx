import { memo, useState, useCallback } from 'react';
import { EdgeProps, getBezierPath, getSmoothStepPath, getStraightPath, EdgeLabelRenderer, useStore, type Node } from 'reactflow';
import { getEdgeParams, sameNodeGeometry } from './utils/floatingEdges.js';
import { THEME } from './theme.js';
import { EdgeBadge, EdgeTooltip, getBadgeStyle } from './edge-components/index.js';
import type { EdgeData } from '../../contracts/contracts.js';
import { usePresentationMode, type PresentationModeStore } from '../../../theme/usePresentationMode.js';
import { coveredNodeTop } from './utils/labelPlacement.js';

interface FloatingEdgeProps extends EdgeProps<EdgeData> {
    /** Injected for tests; defaults to the app-wide store. */
    presentationStore?: PresentationModeStore;
}

function FloatingEdgeComponent({
    id,
    source,
    target,
    style = {},
    markerEnd,
    markerStart,
    data,
    presentationStore,
}: FloatingEdgeProps) {
    const [isHovered, setIsHovered] = useState(false);
    const direction = data?.direction;

    // reactflow gives every node a new object on each node change, for example the z-index change on a hover. Only
    // the geometry is compared, so such a change does not render every edge again.
    const sourceNode = useStore(useCallback((store) => store.nodeInternals.get(source), [source]), sameNodeGeometry);
    const targetNode = useStore(useCallback((store) => store.nodeInternals.get(target), [target]), sameNodeGeometry);
    const { presenting } = usePresentationMode(presentationStore);
    const path = sourceNode && targetNode
        ? getFloatingEdgePath(sourceNode, targetNode, direction, data?.metadata?.routing)
        : undefined;

    // The larger presentation label would hide a node it falls on, for example when the edge goes behind that node,
    // so the label moves to just above that node. The hit test is in the selector: it gives a number, which a hover
    // does not change.
    const hitX = presenting ? path?.labelX : undefined;
    const hitY = presenting ? path?.labelY : undefined;
    const coveredTop = useStore(useCallback(
        (store) => (hitX === undefined || hitY === undefined
            ? undefined
            : coveredNodeTop(store.nodeInternals.values(), hitX, hitY, [source, target])),
        [hitX, hitY, source, target],
    ));

    if (!path) {
        return null;
    }

    const { edgePath, labelX, labelY } = path;
    const labelTransform = coveredTop === undefined
        ? `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`
        : `translate(-50%, -100%) translate(${labelX}px,${coveredTop - 8}px)`;

    // Extract edge data
    const description = data?.description || '';
    const protocol = data?.protocol || '';
    const flowTransitions = data?.flowTransitions || [];
    const edgeControls = data?.controls || {};

    // Extract AIGF data
    const aigf = data?.metadata?.aigf;
    const controlsApplied = aigf?.['controls-applied'] || [];
    const mitigations = aigf?.mitigations || [];
    const risks = aigf?.risks || [];

    const edgeLabel = description || protocol || '';
    const isFlowActive = !!data?.flowActive;
    const flowOpacity = style.opacity ?? 1;

    // An edge can carry flow/AIGF metadata with no description or protocol text at all -
    // the badge is the only signal that metadata exists, independent of edgeLabel.
    const hasFlowInfo = flowTransitions.length > 0;
    const hasAIGF = controlsApplied.length > 0 || mitigations.length > 0 || risks.length > 0;
    const badgeStyle = getBadgeStyle(hasFlowInfo);
    const hasIndicator = Boolean(edgeLabel) || hasFlowInfo || hasAIGF;

    return (
        <>
            <path
                id={id}
                style={style}
                className="react-flow__edge-path"
                d={edgePath}
                markerEnd={markerEnd}
                markerStart={markerStart}
            />
            {isFlowActive && (
                <path
                    d={edgePath}
                    className="flow-dash-overlay"
                    markerEnd={markerEnd}
                />
            )}
            {hasIndicator && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: labelTransform,
                            pointerEvents: 'all',
                            zIndex: 1000,
                            opacity: flowOpacity,
                            transition: 'opacity 0.4s ease',
                            display: 'flex',
                            // Presentation mode stacks the badge and the label: together they are too wide for one line.
                            flexDirection: presenting ? 'column' : undefined,
                            alignItems: 'center',
                            gap: '4px',
                        }}
                        className="nodrag nopan"
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                    >
                        {(hasFlowInfo || hasAIGF) && (
                            <EdgeBadge
                                hasFlowInfo={hasFlowInfo}
                                badgeStyle={badgeStyle}
                            />
                        )}
                        {edgeLabel && (
                            <span
                                style={{
                                    fontSize: presenting ? '16px' : '10px',
                                    lineHeight: 1.25,
                                    padding: presenting ? '3px 8px' : '2px 4px',
                                    borderRadius: '4px',
                                    background: THEME.colors.card,
                                    border: `1px solid ${THEME.colors.border}`,
                                    color: THEME.colors.muted,
                                    maxWidth: presenting ? '220px' : '160px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    ...(presenting
                                        ? { whiteSpace: 'normal', textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }
                                        : { whiteSpace: 'nowrap', display: 'inline-block' }),
                                }}
                            >
                                {edgeLabel}
                            </span>
                        )}
                    </div>

                    {isHovered && (
                        <EdgeTooltip
                            description={description}
                            protocol={protocol}
                            direction={direction}
                            flowTransitions={flowTransitions}
                            edgeControls={edgeControls}
                            controlsApplied={controlsApplied}
                            mitigations={mitigations}
                            risks={risks}
                            labelX={labelX}
                            labelY={labelY}
                        />
                    )}
                </EdgeLabelRenderer>
            )}
        </>
    );
}

export const FloatingEdge = memo(FloatingEdgeComponent);

function getFloatingEdgePath(
    sourceNode: Node,
    targetNode: Node,
    direction: EdgeData['direction'],
    routing: NonNullable<EdgeData['metadata']>['routing'],
) {
    // Every routing attaches at the node border nearest the other node. A native handle
    // position is fixed per handle, so it cannot do that.
    const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(sourceNode, targetNode);

    // Calculate perpendicular offset for bidirectional edges
    const offset = direction ? 20 : 0;

    const { adjustedSourceX, adjustedSourceY, adjustedTargetX, adjustedTargetY } = calculateOffsetPositions(
        sx, sy, tx, ty, offset, direction
    );

    const pathParams = {
        sourceX: adjustedSourceX,
        sourceY: adjustedSourceY,
        sourcePosition: sourcePos,
        targetX: adjustedTargetX,
        targetY: adjustedTargetY,
        targetPosition: targetPos,
    };

    const [edgePath, labelX, labelY] =
        routing === 'straight' ? getStraightPath(pathParams) :
        routing === 'smoothstep' ? getSmoothStepPath(pathParams) :
        getBezierPath(pathParams);

    return { edgePath, labelX, labelY };
}

/**
 * Calculate offset positions for bidirectional edges
 */
function calculateOffsetPositions(
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    offset: number,
    direction?: 'forward' | 'backward'
) {
    if (offset === 0) {
        return {
            adjustedSourceX: sx,
            adjustedSourceY: sy,
            adjustedTargetX: tx,
            adjustedTargetY: ty,
        };
    }

    const dx = tx - sx;
    const dy = ty - sy;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) {
        return {
            adjustedSourceX: sx,
            adjustedSourceY: sy,
            adjustedTargetX: tx,
            adjustedTargetY: ty,
        };
    }

    // Perpendicular vector (rotate 90 degrees)
    const perpX = -dy / length;
    const perpY = dx / length;

    // Apply offset (backward edges go opposite direction)
    const offsetMultiplier = direction === 'backward' ? -1 : 1;

    return {
        adjustedSourceX: sx + perpX * offset * offsetMultiplier,
        adjustedSourceY: sy + perpY * offset * offsetMultiplier,
        adjustedTargetX: tx + perpX * offset * offsetMultiplier,
        adjustedTargetY: ty + perpY * offset * offsetMultiplier,
    };
}
