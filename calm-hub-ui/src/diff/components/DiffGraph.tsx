import { useEffect, useMemo } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { FloatingEdge } from '../../visualizer/components/reactflow/FloatingEdge.js';
import { CustomNode } from '../../visualizer/components/reactflow/CustomNode.js';
import { SystemGroupNode } from '../../visualizer/components/reactflow/SystemGroupNode.js';
import { parseCALMDataWithDiff } from './utils/diffTransformer.js';
import type { DiffGraphProps } from '../../model/diff.js';

const edgeTypes = { custom: FloatingEdge };
const nodeTypes = { custom: CustomNode, group: SystemGroupNode };

export function DiffGraph({ architecture, diffResult, isFirst }: DiffGraphProps) {
    const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
        return parseCALMDataWithDiff(architecture, diffResult, isFirst);
    }, [architecture, diffResult, isFirst]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [initialNodes, initialEdges, setNodes, setEdges]);

    return (
        <div style={{ height: '100%', width: '100%' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                attributionPosition="bottom-left"
            >
                <Background />
                <Controls />
                <MiniMap />
            </ReactFlow>
        </div>
    );
}