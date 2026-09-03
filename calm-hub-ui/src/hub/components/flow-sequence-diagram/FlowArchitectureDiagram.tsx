import { useMemo } from 'react';
import { ArchitectureGraph } from '../../../visualizer/components/reactflow/ArchitectureGraph.js';
import { NodeSearchProvider } from '../../../visualizer/components/reactflow/node-search-context.js';
import { FlowCommentary } from './FlowCommentary.js';
import { FlowHeader } from './FlowHeader.js';
import { PlaybackControls } from './PlaybackControls.js';
import { useFlowPlayback } from './useFlowPlayback.js';
import { FlowSequenceHelper } from './flow-sequence-helper.js';
import {
    IDLE_STEP,
    activeSequenceNumber,
    describeStep,
    visitedSequenceNumbers,
} from './flow-step.js';
import { COMMENTARY_PANEL_WIDTH, DIAGRAM_CARD_CLASS } from './flow-layout.js';
import { FORWARD_DIRECTION } from '../../../visualizer/components/reactflow/utils/calmTransformer.js';
import './flow-animation.css';
import type { FlowVizState } from '../../../visualizer/components/reactflow/utils/calmTransformer.js';
import type { Architecture } from '@finos/calm-models/model';
import type { CalmArchitectureSchema, CalmFlowSchema, CalmFlowTransitionSchema } from '@finos/calm-models/types';

interface FlowArchitectureDiagramProps {
    flowJson: Partial<CalmFlowSchema>;
    architectureJson: CalmArchitectureSchema | null;
    architecture: Architecture;
}


// `flow-state` sets the active/visited styling. These values only control the fade
// level. The idle ramp shows in-flow elements clearly but does not mark them active.
const NODE_OPACITY: Record<FlowVizState, number> = { active: 1, visited: 0.85, 'in-flow': 0.3, dimmed: 0.1 };
const EDGE_OPACITY: Record<FlowVizState, number> = { active: 1, visited: 0.7, 'in-flow': 0.2, dimmed: 0.06 };
const NODE_IDLE_OPACITY = { inFlow: 1, other: 0.2 };
const EDGE_IDLE_OPACITY = { inFlow: 0.7, other: 0.12 };

function deriveFlowState(step: number, inFlow: boolean, isActive: boolean, isVisited: boolean): FlowVizState {
    if (step === IDLE_STEP) return inFlow ? 'in-flow' : 'dimmed';
    if (isActive) return 'active';
    if (isVisited) return 'visited';
    if (inFlow) return 'in-flow';
    return 'dimmed';
}

/**
 * Renders the existing ReactFlow ArchitectureGraph with flow-step animation.
 * Nodes/edges not in the flow are dimmed; the active step's path is highlighted.
 * The architecture JSON is augmented with per-node/edge opacity metadata.
 */
export function FlowArchitectureDiagram({ flowJson, architectureJson, architecture }: FlowArchitectureDiagramProps) {
    const transitions: CalmFlowTransitionSchema[] = useMemo(() => flowJson?.transitions || [], [flowJson]);
    const flowHelper = useMemo(() => new FlowSequenceHelper(), []);

    const seqNumbers = useMemo(() =>
        [...new Set(transitions.map(t => t['sequence-number']))].sort((a, b) => a - b),
    [transitions]);

    const maxStep = seqNumbers.length - 1;
    const playback = useFlowPlayback({ maxStep }, flowJson);
    const { step, isCompleted, stopPlaying, setStep } = playback;

    const { flowRelIds, flowNodeIds } = useMemo(() => {
        const relIds = new Set<string>(transitions.map(t => t['relationship-unique-id']));
        const nodeIds = new Set<string>();

        for (const relId of relIds) {
            flowHelper.getNodeIdsFromRelationship(relId, architecture)
                .forEach(id => nodeIds.add(id));
        }

        return { flowRelIds: relIds, flowNodeIds: nodeIds };
    }, [transitions, architecture, flowHelper]);

    const styledArchJson = useMemo(() => {
        if (!architectureJson) return architectureJson;

        const activeSeqNum = activeSequenceNumber(step, seqNumbers);
        const visitedSeqNums = visitedSequenceNumbers(step, seqNumbers);

        const activeRelIds = new Set<string>();
        const activeNodeIds = new Set<string>();
        const visitedRelIds = new Set<string>();
        const visitedNodeIds = new Set<string>();
        const activeDirections = new Map<string, string>();

        transitions.forEach((t) => {
            const seq = t['sequence-number'];
            const relId = t['relationship-unique-id'];
            if (seq === activeSeqNum) {
                activeRelIds.add(relId);
                activeDirections.set(relId, t.direction || FORWARD_DIRECTION);
                flowHelper.getNodeIdsFromRelationship(relId, architecture)
                    .forEach(id => activeNodeIds.add(id));
            }
            if (visitedSeqNums.has(seq)) {
                visitedRelIds.add(relId);
                flowHelper.getNodeIdsFromRelationship(relId, architecture)
                    .forEach(id => visitedNodeIds.add(id));
            }
        });

        const nodes = (architectureJson.nodes || []).map((n) => {
            const id = n['unique-id'];
            const inFlow = flowNodeIds.has(id);
            const flowState = deriveFlowState(step, inFlow, activeNodeIds.has(id), visitedNodeIds.has(id));

            const flowOpacity = step === IDLE_STEP
                ? (inFlow ? NODE_IDLE_OPACITY.inFlow : NODE_IDLE_OPACITY.other)
                : NODE_OPACITY[flowState];

            return { ...n, 'flow-opacity': flowOpacity, 'flow-state': flowState };
        });

        const relationships = (architectureJson.relationships || []).map((r) => {
            const id = r['unique-id'];
            const inFlow = flowRelIds.has(id);
            const isActive = activeRelIds.has(id);
            const flowState = deriveFlowState(step, inFlow, isActive, visitedRelIds.has(id));

            const flowOpacity = step === IDLE_STEP
                ? (inFlow ? EDGE_IDLE_OPACITY.inFlow : EDGE_IDLE_OPACITY.other)
                : EDGE_OPACITY[flowState];

            const activeDirection = activeDirections.get(id);
            return {
                ...r,
                'flow-opacity': flowOpacity,
                'flow-state': flowState,
                ...(isActive && activeDirection ? { 'flow-active-direction': activeDirection } : {}),
            };
        });

        return { ...architectureJson, nodes, relationships };
    }, [architectureJson, step, seqNumbers, transitions, flowRelIds, flowNodeIds, architecture, flowHelper]);

    const statusText = describeStep(activeSequenceNumber(step, seqNumbers), transitions, isCompleted);

    return (
        <div className="w-full h-full flex flex-col bg-base-200">
            <FlowHeader description={flowJson.description} />

            <div className="flex-1 flex min-h-0">
                <div className="flex-1 min-h-0 min-w-0 px-6 pb-2">
                    <div className={DIAGRAM_CARD_CLASS}>
                        <NodeSearchProvider value={null}>
                            {styledArchJson && <ArchitectureGraph jsonData={styledArchJson} fitToPane />}
                        </NodeSearchProvider>
                    </div>
                </div>

                <div className={COMMENTARY_PANEL_WIDTH}>
                    <FlowCommentary
                        transitions={transitions}
                        architecture={architecture}
                        currentStep={step}
                        onStepSelect={i => { stopPlaying(); setStep(i); }}
                    />
                </div>
            </div>

            <PlaybackControls playback={playback} totalSteps={seqNumbers.length} statusText={statusText} />
        </div>
    );
}
