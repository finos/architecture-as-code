// Ported from calm-hub-ui/src/visualizer/components/reactflow/FloatingEdge.tsx (commit 9696b33b),
// lab-skinned: keeps the floating-edge maths (node-boundary intersection via the
// ported floatingEdges util, bidirectional perpendicular offsets, bezier path);
// replaces the Hub's EdgeBadge/EdgeTooltip with an always-visible compact label
// showing the relationship description plus a mono protocol chip.
// Keep logic in sync until the shared renderer package extraction.

import React, {useCallback} from 'react';
import {getBezierPath, EdgeLabelRenderer, useStore} from 'reactflow';
import clsx from 'clsx';
import styles from './lab.module.css';
import {getEdgeParams} from './hubRenderer/floatingEdges';

export default function HubFloatingEdge({
    id,
    source,
    target,
    style = {},
    markerEnd,
    markerStart,
    data,
}) {
    const sourceNode = useStore(useCallback((store) => store.nodeInternals.get(source), [source]));
    const targetNode = useStore(useCallback((store) => store.nodeInternals.get(target), [target]));

    if (!sourceNode || !targetNode) {
        return null;
    }

    const {sx, sy, tx, ty, sourcePos, targetPos} = getEdgeParams(sourceNode, targetNode);

    // Calculate perpendicular offset for bidirectional edges
    const direction = data?.direction;
    const offset = direction ? 20 : 0;

    const {adjustedSourceX, adjustedSourceY, adjustedTargetX, adjustedTargetY} =
        calculateOffsetPositions(sx, sy, tx, ty, offset, direction);

    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX: adjustedSourceX,
        sourceY: adjustedSourceY,
        sourcePosition: sourcePos,
        targetX: adjustedTargetX,
        targetY: adjustedTargetY,
        targetPosition: targetPos,
    });

    const description = data?.description || '';
    const protocol = data?.protocol || '';

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
            {(description || protocol) && (
                <EdgeLabelRenderer>
                    <div
                        className={clsx('nodrag', 'nopan', styles.flowEdgeLabel)}
                        style={{
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        }}>
                        {description && <span>{description}</span>}
                        {protocol && <span className={styles.flowEdgeProtocol}>{protocol}</span>}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}

/**
 * Calculate offset positions for bidirectional edges
 */
function calculateOffsetPositions(sx, sy, tx, ty, offset, direction) {
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
