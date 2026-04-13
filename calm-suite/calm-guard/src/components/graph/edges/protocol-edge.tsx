'use client';

import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

export type ProtocolEdgeData = {
  protocol?: string;
  animated?: boolean;
};

export function ProtocolEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: '#64748b',
          strokeWidth: 1.5,
          opacity: 0.7,
          ...style,
        }}
      />
      {(data as ProtocolEdgeData)?.protocol && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="bg-slate-900/90 backdrop-blur-sm text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded-full border border-slate-700/50 nodrag nopan shadow-sm"
          >
            {(data as ProtocolEdgeData).protocol}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
