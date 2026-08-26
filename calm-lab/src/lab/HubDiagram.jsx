/**
 * The lab's Diagram tab: the CALM Hub visualizer pipeline (ported under
 * ./hubRenderer) feeding a ReactFlow canvas. Call sequence follows the Hub's
 * ArchitectureGraph: parseCALMData (transform + dagre layout) → nodes/edges
 * state → fitView. Only rendered while the Diagram tab is active, so the
 * canvas always mounts at a measurable size and fits itself on open.
 */

import React, {useEffect, useMemo, useRef} from 'react';
import ReactFlow, {Background, Controls, useNodesState, useEdgesState} from 'reactflow';
import 'reactflow/dist/style.css';
import clsx from 'clsx';
import styles from './lab.module.css';
import {parseCALMData} from './hubRenderer/calmTransformer';
import HubCustomNode from './HubCustomNode';
import HubGroupNode from './HubGroupNode';
import HubFloatingEdge from './HubFloatingEdge';

const nodeTypes = {custom: HubCustomNode, group: HubGroupNode};
const edgeTypes = {custom: HubFloatingEdge};

// Mirrors the Hub ArchitectureGraph's fit options, with its pane-level floor
// (0.1) as the fit floor too: the lab pane is smaller than the Hub canvas, so
// a dense graph (TraderX) must be allowed to fit fully zoomed-out.
const FIT_VIEW_OPTIONS = {padding: 0.2, minZoom: 0.1, maxZoom: 1.2};

export default function HubDiagram({jsonText}) {
    const doc = useMemo(() => {
        try {
            return JSON.parse(jsonText);
        } catch {
            return null;
        }
    }, [jsonText]);

    const parsed = useMemo(() => parseCALMData(doc || undefined), [doc]);

    const [nodes, setNodes, onNodesChange] = useNodesState(parsed.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(parsed.edges);
    const flowRef = useRef(null);

    useEffect(() => {
        setNodes(parsed.nodes);
        setEdges(parsed.edges);
        // Re-fit once the new elements have been measured. Node dimensions are
        // only known after ReactFlow's ResizeObserver pass, which lands a frame
        // or two after mount — a small timeout is the reliable point to fit.
        const timer = setTimeout(() => flowRef.current?.fitView(FIT_VIEW_OPTIONS), 80);
        return () => clearTimeout(timer);
    }, [parsed, setNodes, setEdges]);

    let emptyMessage = null;
    if (!doc) {
        emptyMessage = 'fix the JSON to see the diagram';
    } else if (parsed.nodes.length === 0) {
        emptyMessage = 'add a node to see the diagram';
    }

    return (
        <div className={styles.paneFill}>
            <div className={styles.flowCanvas}>
                {emptyMessage ? (
                    <div className={styles.diagramEmpty}>{emptyMessage}</div>
                ) : (
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onInit={(instance) => {
                            flowRef.current = instance;
                        }}
                        fitView
                        fitViewOptions={FIT_VIEW_OPTIONS}
                        minZoom={0.1}
                        attributionPosition="bottom-right"
                        aria-label="Live diagram of the nodes and relationships in your CALM architecture"
                        style={{background: '#0b1030'}}>
                        {/* Literal hex is fine here (unlike the Hub's CSS-variable
                            tokens): the prop lands in an SVG fill attribute. */}
                        <Background gap={16} color="#1b2350" />
                        <Controls
                            className={clsx(styles.flowControls)}
                            showInteractive={false}
                            fitViewOptions={FIT_VIEW_OPTIONS}
                        />
                    </ReactFlow>
                )}
            </div>
            <div className={styles.diagramCaption}>
                live preview — rendered with the CALM Hub visualizer pipeline
            </div>
        </div>
    );
}
