import { memo, useEffect, useMemo, useState } from 'react';
import ReactFlow, { Handle, Position, type Edge, type Node, type NodeProps } from 'reactflow';
import 'reactflow/dist/style.css';
import { CalmService } from '../../../service/calm-service.js';
import { pickLatestVersion } from '../../../model/version.js';
import { parseCALMData } from '../../../visualizer/components/reactflow/utils/calmTransformer.js';
import { getNodeTypeColor } from '../../../visualizer/components/reactflow/theme.js';

/**
 * A small, non-interactive rendering of an architecture, used as the card header
 * on the namespace browse page. It reuses the same transformer and layout as the
 * full diagram, so the thumbnail cannot drift from the real topology; only the
 * node chrome is stripped (coloured blocks instead of labelled nodes).
 */

// Fixed dimensions: a React Flow node wrapper has no intrinsic size, so a
// child sized with `100%` collapses to zero and renders nothing.
const THUMB_NODE_WIDTH = 160;
const THUMB_NODE_HEIGHT = 44;

const ThumbNode = memo(({ data }: NodeProps) => {
    const nodeType = (data as Record<string, unknown>)['node-type'] as string | undefined;
    return (
        <div
            style={{
                width: THUMB_NODE_WIDTH,
                height: THUMB_NODE_HEIGHT,
                borderRadius: 4,
                background: getNodeTypeColor(nodeType ?? 'system'),
                opacity: 0.9,
            }}
        >
            <Handle type="source" position={Position.Right} id="source" style={{ opacity: 0 }} />
            <Handle type="target" position={Position.Left} id="target" style={{ opacity: 0 }} />
        </div>
    );
});

const ThumbGroup = memo(() => (
    <div
        style={{
            width: '100%',
            height: '100%',
            border: '1px dashed rgba(120,140,200,0.55)',
            borderRadius: 8,
            background: 'rgba(120,140,200,0.08)',
        }}
    >
        <Handle type="source" position={Position.Right} id="source" style={{ opacity: 0 }} />
        <Handle type="target" position={Position.Left} id="target" style={{ opacity: 0 }} />
    </div>
));

const thumbNodeTypes = { custom: ThumbNode, group: ThumbGroup };

interface ArchitectureThumbnailProps {
    namespace: string;
    /** The architecture's slug (customId). */
    customId: string;
}

export function ArchitectureThumbnail({ namespace, customId }: ArchitectureThumbnailProps) {
    const calmService = useMemo(() => new CalmService(), []);
    const [doc, setDoc] = useState<Record<string, unknown> | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const versions = await calmService.fetchVersionsByCustomId(
                    namespace,
                    customId,
                    'Architectures'
                );
                const latest = pickLatestVersion(versions);
                if (!latest) return;
                const res = await calmService.fetchResourceByCustomId(
                    namespace,
                    customId,
                    latest,
                    'Architectures'
                );
                if (!cancelled) setDoc((res?.data as Record<string, unknown>) ?? null);
            } catch {
                // A thumbnail is decoration: a fetch failure leaves the header blank,
                // the card body still names and links the architecture.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [namespace, customId, calmService]);

    const { nodes, edges } = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
        if (!doc) return { nodes: [], edges: [] };
        const parsed = parseCALMData(doc as never);
        // The full graph uses a custom floating edge; the thumbnail uses the
        // default edge, which needs no extra component.
        return { nodes: parsed.nodes, edges: parsed.edges.map((e) => ({ ...e, type: 'default' })) };
    }, [doc]);

    if (nodes.length === 0) return <div style={{ height: '100%' }} />;

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={thumbNodeTypes}
            fitView
            fitViewOptions={{ padding: 0.12 }}
            minZoom={0.05}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            preventScrolling={false}
            proOptions={{ hideAttribution: true }}
            style={{ width: '100%', height: '100%', background: 'transparent' }}
        />
    );
}
