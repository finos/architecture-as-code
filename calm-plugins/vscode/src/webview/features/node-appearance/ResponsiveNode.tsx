import React from 'react';
import { useStore, type NodeProps } from 'reactflow';
import { getDetailNodeResizeBounds, getDetailNodeVisual } from '../../canvas/nodes/nodeVisuals';
import { SharedCardNode } from '../../canvas/nodes/SharedCardNode';
import { getApplicationId } from './application-id';

export function ResponsiveNode(props: NodeProps) {
    const width = useStore((state) => state.nodeInternals.get(props.id)?.width);
    const height = useStore((state) => state.nodeInternals.get(props.id)?.height);
    const data = props.data as Record<string, unknown>;
    const nodeType = data.calmType as string | undefined;
    const visual = getDetailNodeVisual(nodeType);
    const resizeBounds = getDetailNodeResizeBounds(nodeType);

    return (
        <SharedCardNode
            {...props}
            width={width}
            height={height}
            defaultBackground={visual.defaultBackground}
            defaultBorder={visual.defaultBorder}
            defaultIconColor={visual.defaultIconColor}
            iconSize={visual.iconSize}
            minWidth={resizeBounds.minWidth}
            minHeight={resizeBounds.minHeight}
            applicationId={getApplicationId(data)}
        />
    );
}