import { useMemo } from 'react';
import { Background, Controls, ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { C4Model, C4View } from '@finos/calm-models/c4';
import { useIsMobile } from '../../../../hooks/useMediaQuery.js';
import { C4BoundaryNode } from './C4BoundaryNode.js';
import { C4ElementNode } from './C4ElementNode.js';
import { C4RelationshipEdge } from './C4RelationshipEdge.js';
import { layoutC4View } from './c4Layout.js';

const nodeTypes = { c4element: C4ElementNode, c4boundary: C4BoundaryNode };
const edgeTypes = { c4relationship: C4RelationshipEdge };

interface C4DiagramProps {
    view: C4View;
    model: C4Model;
    /** Whether a click on the element opens the next level with it in scope. */
    canOpen: (id: string) => boolean;
    onOpen: (id: string) => void;
}

export function C4Diagram({ view, model, canOpen, onOpen }: C4DiagramProps) {
    const isMobile = useIsMobile();
    const { nodes, edges } = useMemo(() => layoutC4View(view, model, canOpen, isMobile ? 'TB' : 'LR'), [view, model, canOpen, isMobile]);
    return (
        <ReactFlow
            key={`${view.level}:${view.scope?.id ?? ''}:${nodes.length}`}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={(_, node) => {
                if (canOpen(node.id)) onOpen(node.id);
            }}
            fitView
            fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
            nodesConnectable={false}
            nodesDraggable={false}
            proOptions={{ hideAttribution: true }}
            minZoom={0.2}
        >
            <Background gap={24} />
            {!isMobile && <Controls showInteractive={false} />}
        </ReactFlow>
    );
}
