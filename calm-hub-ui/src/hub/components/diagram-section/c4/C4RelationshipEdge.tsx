import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from '@xyflow/react';
import { colors } from '../../../../theme/colors.js';
import { shortLabel } from './c4Display.js';
import type { C4RelationshipData } from './c4Layout.js';

export function C4RelationshipEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }: EdgeProps<Edge<C4RelationshipData>>) {
    const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
    const relationship = data!.relationship;
    return (
        <>
            <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: colors.edge.default, strokeDasharray: '6 4' }} />
            <EdgeLabelRenderer>
                <div
                    title={relationship.label}
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                        background: colors.background.base,
                        color: colors.text.primary,
                        fontSize: 10,
                        lineHeight: '13px',
                        padding: '2px 5px',
                        borderRadius: 4,
                        maxWidth: 170,
                        textAlign: 'center',
                    }}
                >
                    {shortLabel(relationship.label)}
                    {relationship.count > 1 && ` (${relationship.count} relationships)`}
                    {relationship.technology && <div style={{ color: colors.text.secondary }}>[{relationship.technology}]</div>}
                </div>
            </EdgeLabelRenderer>
        </>
    );
}
