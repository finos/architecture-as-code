import { useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    ReactFlowProvider,
    useNodesState,
    useEdgesState,
    useReactFlow,
    useNodesInitialized,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { CalmArchitectureSchema } from '@finos/calm-models/types';
import { FloatingEdge } from '../../visualizer/components/reactflow/FloatingEdge.js';
import { CustomNode } from '../../visualizer/components/reactflow/CustomNode.js';
import { SystemGroupNode } from '../../visualizer/components/reactflow/SystemGroupNode.js';
import { DecisionGroupNode } from '../../visualizer/components/reactflow/DecisionGroupNode.js';
import { THEME } from '../../visualizer/components/reactflow/theme.js';
import { parseCALMDataWithDiff } from './utils/diffTransformer.js';
import { parsePatternDataWithDiff } from './utils/patternDiffTransformer.js';
import type { DiffGraphProps } from '../model/diff-ui-types.js';

const edgeTypes = { custom: FloatingEdge };
// `decisionGroup` is only emitted for patterns; registering it unconditionally is
// harmless for architectures (their parser never produces decision-group nodes).
const nodeTypes = { custom: CustomNode, group: SystemGroupNode, decisionGroup: DecisionGroupNode };

function DiffGraphInner({ source, sourceType, diffResult, isFirst }: DiffGraphProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const { fitView } = useReactFlow();
    const nodesInitialized = useNodesInitialized();
    const containerRef = useRef<HTMLDivElement>(null);
    const fitFrameRef = useRef<number>();

    // Fit on the next animation frame so ReactFlow has picked up the container's
    // final dimensions first — the compare panels reach their final (narrower) width
    // after the diagram first renders, and a synchronous fitView uses the stale size.
    // The frame is tracked so it can be cancelled if the graph unmounts first.
    const scheduleFit = useCallback(() => {
        if (fitFrameRef.current !== undefined) cancelAnimationFrame(fitFrameRef.current);
        fitFrameRef.current = requestAnimationFrame(() => fitView({ padding: 0.2 }));
    }, [fitView]);

    useEffect(() => () => {
        if (fitFrameRef.current !== undefined) cancelAnimationFrame(fitFrameRef.current);
    }, []);

    useEffect(() => {
        const { nodes: parsedNodes, edges: parsedEdges } = sourceType === 'Patterns'
            ? parsePatternDataWithDiff(source as Record<string, unknown>, diffResult, isFirst)
            : parseCALMDataWithDiff(source as CalmArchitectureSchema, diffResult, isFirst);
        setNodes(parsedNodes);
        setEdges(parsedEdges);
    }, [source, sourceType, diffResult, isFirst, setNodes, setEdges]);

    useEffect(() => {
        if (nodesInitialized) {
            scheduleFit();
        }
    }, [nodesInitialized, scheduleFit]);

    // ReactFlow does not refit on container resize on its own; refit when the panel
    // settles to its final size.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const observer = new ResizeObserver(() => scheduleFit());
        observer.observe(el);
        return () => observer.disconnect();
    }, [scheduleFit]);

    return (
        <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            attributionPosition="bottom-left"
            style={{ background: THEME.colors.background }}
        >
            <Background color={THEME.colors.border} gap={16} />
            <Controls
                style={{
                    background: THEME.colors.card,
                    border: `1px solid ${THEME.colors.border}`,
                    borderRadius: '8px',
                }}
            />
            <MiniMap
                style={{
                    background: THEME.colors.backgroundSecondary,
                    border: `1px solid ${THEME.colors.border}`,
                }}
                nodeColor={THEME.colors.accent}
                maskColor={`${THEME.colors.background}cc`}
            />
        </ReactFlow>
        </div>
    );
}

export function DiffGraph(props: DiffGraphProps) {
    return (
        <ReactFlowProvider>
            <DiffGraphInner {...props} />
        </ReactFlowProvider>
    );
}
