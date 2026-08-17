import { useState, useCallback } from 'react';
import { EdgeProps, getBezierPath, getSmoothStepPath, getStraightPath, EdgeLabelRenderer, useStore } from 'reactflow';
import { getEdgeParams } from './utils/floatingEdges.js';
import { EdgeBadge, EdgeTooltip, getBadgeStyle } from './edge-components/index.js';
import type { EdgeData } from '../../contracts/contracts.js';

export function FloatingEdge({
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    markerStart,
    data,
}: EdgeProps<EdgeData>) {
    const [isHovered, setIsHovered] = useState(false);
    const routing = data?.metadata?.routing as string | undefined;

    const sourceNode = useStore(useCallback((store) => store.nodeInternals.get(source), [source]));
    const targetNode = useStore(useCallback((store) => store.nodeInternals.get(target), [target]));

    if (!sourceNode || !targetNode) {
        return null;
    }

    // For smoothstep/straight: use ReactFlow's native handle-based positions (precise attachment)
    // For bezier (default): use floating edge calculation (curves naturally into nodes)
    const useNativePositions = routing === 'smoothstep' || routing === 'straight';
    const { sx, sy, tx, ty, sourcePos, targetPos } = useNativePositions
        ? { sx: sourceX, sy: sourceY, tx: targetX, ty: targetY, sourcePos: sourcePosition, targetPos: targetPosition }
        : getEdgeParams(sourceNode, targetNode);

    // Calculate perpendicular offset for bidirectional edges
    const direction = data?.direction;
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

    const hasFlowInfo = flowTransitions.length > 0;
    const hasAIGF = controlsApplied.length > 0 || mitigations.length > 0 || risks.length > 0;
    const badgeStyle = getBadgeStyle(hasFlowInfo, hasAIGF);

    const edgeLabel = description || protocol || '';

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
            {edgeLabel && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            pointerEvents: 'all',
                            zIndex: 1000,
                        }}
                        className="nodrag nopan"
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                    >
                        <span className="text-[0.625rem] leading-tight px-1 py-0.5 rounded bg-base-100/90 border border-base-300 text-base-content/60 max-w-[10rem] truncate inline-block">
                            {edgeLabel}
                        </span>
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
};

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
