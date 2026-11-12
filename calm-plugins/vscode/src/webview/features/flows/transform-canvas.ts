import { getFlowEdgeDirections, getFlowPlaybackState } from '../../canvas/flow-playback';
import { useCanvasStore } from '../../stores/canvas-store';
import type { CanvasFeatureCanvasView } from '../types';
import { useFlowPlaybackStore } from './flow-state';

const DEFAULT_FLOW_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// Apply flow-only visuals to the view model; the base CALM nodes and edges remain untouched.
export function transformFlowCanvas(view: CanvasFeatureCanvasView): CanvasFeatureCanvasView {
    const store = useCanvasStore.getState();
    const { step } = useFlowPlaybackStore.getState();
    const activeFlow = store.flows.find((flow) => flow['unique-id'] === store.activeFlowId) ?? null;
    const { activeSequence, visitedSequences } = getFlowPlaybackState(activeFlow?.transitions ?? [], step);
    const isAllFlows = store.activeFlowId === '__all__';
    const highlight = store.flowHighlightEnabled || (activeFlow !== null && step > 0);
    const badgesByRelationship = new Map<string, Array<{ flowId: string; name: string; color: string }>>();

    store.flows.forEach((flow, index) => {
        const metadata = (flow.metadata as Record<string, unknown>) ?? {};
        const style = (metadata['flow-style'] as { background?: string }) ?? {};
        const color = style.background ?? DEFAULT_FLOW_COLORS[index % DEFAULT_FLOW_COLORS.length];
        for (const transition of flow.transitions ?? []) {
            const relationshipId = transition['relationship-unique-id'];
            if (!relationshipId) continue;
            const badges = badgesByRelationship.get(relationshipId) ?? [];
            if (!badges.some((badge) => badge.flowId === flow['unique-id'])) {
                badges.push({ flowId: flow['unique-id'], name: flow.name || flow['unique-id'], color });
                badgesByRelationship.set(relationshipId, badges);
            }
        }
    });

    const edges = view.edges.map((edge) => {
        const data: Record<string, unknown> = {
            ...edge.data,
            _flowColor: null,
            _flowColors: [],
            _flowDimmed: false,
            _flowActive: false,
            _flowVisited: false,
            _flowDirections: [],
        };
        const relationshipId = (data.calmRelId as string) ?? edge.id;
        const reverseRelationshipId = data.calmReverseRelId as string | undefined;
        const badges = badgesByRelationship.get(relationshipId)
            ?? (reverseRelationshipId ? badgesByRelationship.get(reverseRelationshipId) : undefined)
            ?? [];

        if (!highlight) return { ...edge, data: { ...data, _flowBadges: badges } };
        if (isAllFlows) {
            const colors = badges.map((badge) => badge.color);
            return {
                ...edge,
                data: {
                    ...data,
                    _flowColor: colors[0] ?? null,
                    _flowColors: colors,
                    _flowDimmed: badges.length === 0,
                    _flowBadges: badges,
                },
            };
        }
        if (!activeFlow) return { ...edge, data: { ...data, _flowBadges: badges } };

        const metadata = (activeFlow.metadata as Record<string, unknown>) ?? {};
        const style = (metadata['flow-style'] as { background?: string }) ?? {};
        const color = style.background ?? '#60a5fa';
        const flowRelationshipIds = new Set((activeFlow.transitions ?? []).map((transition) => transition['relationship-unique-id']));
        const inFlow = flowRelationshipIds.has(relationshipId)
            || (reverseRelationshipId ? flowRelationshipIds.has(reverseRelationshipId) : false);
        if (!inFlow) return { ...edge, data: { ...data, _flowDimmed: true, _flowBadges: badges } };

        const sequenceNumbersForEdge = (activeFlow.transitions ?? [])
            .filter((transition) => transition['relationship-unique-id'] === relationshipId
                || (reverseRelationshipId && transition['relationship-unique-id'] === reverseRelationshipId))
            .map((transition) => transition['sequence-number']);
        if (step === 0) return { ...edge, data: { ...data, _flowColor: color, _flowBadges: badges } };

        const isActive = sequenceNumbersForEdge.some((sequence) => sequence === activeSequence);
        const isVisited = sequenceNumbersForEdge.some((sequence) => visitedSequences.has(sequence));
        if (isActive) {
            return {
                ...edge,
                data: {
                    ...data,
                    _flowColor: color,
                    _flowActive: true,
                    _flowBadges: badges,
                    _flowDirections: getFlowEdgeDirections(activeFlow.transitions, activeSequence, relationshipId, reverseRelationshipId),
                },
            };
        }
        if (isVisited) return { ...edge, data: { ...data, _flowColor: color, _flowVisited: true, _flowBadges: badges } };
        return { ...edge, data: { ...data, _flowDimmed: true, _flowBadges: badges } };
    });

    const edgeByRelationship = new Map<string, Array<{ source: string; target: string }>>();
    for (const edge of view.edges) {
        const data = (edge.data ?? {}) as Record<string, unknown>;
        const relationshipId = (data.calmRelId as string | undefined) ?? edge.id;
        const reverseRelationshipId = data.calmReverseRelId as string | undefined;
        edgeByRelationship.set(relationshipId, [...(edgeByRelationship.get(relationshipId) ?? []), { source: edge.source, target: edge.target }]);
        if (reverseRelationshipId) {
            edgeByRelationship.set(reverseRelationshipId, [...(edgeByRelationship.get(reverseRelationshipId) ?? []), { source: edge.target, target: edge.source }]);
        }
    }

    if (!highlight) return { nodes: view.nodes, edges };
    if (isAllFlows) {
        const relatedNodeIds = new Set<string>();
        for (const flow of store.flows) {
            for (const transition of flow.transitions ?? []) {
                for (const edge of edgeByRelationship.get(transition['relationship-unique-id']) ?? []) {
                    relatedNodeIds.add(edge.source);
                    relatedNodeIds.add(edge.target);
                }
            }
        }
        return {
            nodes: view.nodes.map((node) => ({
                ...node,
                style: { ...node.style, opacity: relatedNodeIds.has(node.id) ? 1 : 0.25, transition: 'opacity 0.3s' },
            })),
            edges,
        };
    }
    if (!activeFlow) return { nodes: view.nodes, edges };

    const flowNodeIds = new Set<string>();
    const activeNodeIds = new Set<string>();
    const visitedNodeIds = new Set<string>();
    for (const transition of activeFlow.transitions ?? []) {
        for (const edge of edgeByRelationship.get(transition['relationship-unique-id']) ?? []) {
            flowNodeIds.add(edge.source);
            flowNodeIds.add(edge.target);
            if (transition['sequence-number'] === activeSequence) {
                activeNodeIds.add(edge.source);
                activeNodeIds.add(edge.target);
            }
            if (visitedSequences.has(transition['sequence-number'])) {
                visitedNodeIds.add(edge.source);
                visitedNodeIds.add(edge.target);
            }
        }
    }

    const nodes = view.nodes.map((node) => {
        const inFlow = flowNodeIds.has(node.id);
        let opacity = inFlow ? 1 : 0.25;
        if (step > 0) {
            opacity = activeNodeIds.has(node.id) ? 1
                : visitedNodeIds.has(node.id) ? 0.6
                    : inFlow ? 0.3 : 0.12;
        }
        return { ...node, style: { ...node.style, opacity, transition: 'opacity 0.3s' } };
    });
    return { nodes, edges };
}