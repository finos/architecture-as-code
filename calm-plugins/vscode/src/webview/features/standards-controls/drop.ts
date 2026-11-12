import { MarkerType, type Node } from 'reactflow';
import { mergeControls } from '@finos/calm-shared/browser';
import { useCanvasStore } from '../../stores/canvas-store';
import { resolveFlowNodeType } from '../../canvas/node-drop';
import type { CanvasFeatureDropContext } from '../types';

export function handleStandardNodeDrop(context: CanvasFeatureDropContext): boolean {
    const standardNodeId = context.dataTransfer.getData('application/standard-node-id');
    // Return false for ordinary palette entries so the core drop handler can create them.
    if (!standardNodeId) return false;

    const behavior = context.dataTransfer.getData('application/standard-node-behaviour');
    const standardNode = (useCanvasStore.getState().standardNodes as any[]).find((node) => node.id === standardNodeId);
    if (!standardNode || !behavior) return true;

    const isHubSourced = !!standardNode.namespace;
    const controlsCopy = JSON.parse(JSON.stringify(standardNode.controls ?? {})) as Record<string, unknown>;
    const position = context.screenToFlowPosition({ x: context.clientX, y: context.clientY });

    if (behavior === 'apply-controls-on-drop') {
        // Applying controls targets an existing canvas node when possible; otherwise the standard is placed normally.
        let targetId: string | null = null;
        for (const element of document.elementsFromPoint(context.clientX, context.clientY)) {
            const nodeElement = element.closest('.react-flow__node');
            if (nodeElement) {
                targetId = nodeElement.getAttribute('data-id');
                break;
            }
        }
        if (!targetId) {
            for (const node of context.nodes) {
                if (node.type === 'container') continue;
                const width = node.width ?? 150;
                const height = node.height ?? 40;
                const x = node.positionAbsolute?.x ?? node.position.x;
                const y = node.positionAbsolute?.y ?? node.position.y;
                if (position.x >= x && position.x <= x + width && position.y >= y && position.y <= y + height) {
                    targetId = node.id;
                    break;
                }
            }
        }

        if (targetId) {
            // Hub assets resolve by definition ID; local assets carry their controls inline.
            const curieType = standardNode.id?.startsWith?.('guidelines:') ? 'guidelines' : 'standards';
            const requirementUrl = isHubSourced && standardNode.sha
                ? `${standardNode.namespace}:${curieType}:${standardNode.id}@${standardNode.sha}`
                : undefined;

            context.setNodes((nodes) => {
                const existingStandardNode = nodes.find(
                    (node) => (node.data as any)?.metadata?.['source-standard-node'] === standardNodeId,
                );
                let updatedNodes = nodes.map((node) => {
                    if (node.id !== targetId) return node;
                    if (!isHubSourced && Object.keys(controlsCopy).length === 0) return node;
                    const data = { ...(node.data as Record<string, unknown>) };
                    if (!isHubSourced) {
                        data.controls = mergeControls((data.controls as Record<string, unknown>) ?? {}, controlsCopy);
                    }
                    return { ...node, data };
                });

                const standardNodeIdForCanvas = existingStandardNode?.id ?? `standard-${Date.now()}`;
                if (!existingStandardNode) {
                    const standardData: Record<string, unknown> = {
                        label: standardNode.name,
                        calmId: standardNodeIdForCanvas,
                        calmType: 'standard',
                        description: standardNode.description ?? '',
                        interfaces: [],
                    };
                    if (requirementUrl) {
                        standardData['definition-id'] = requirementUrl;
                    } else {
                        standardData.controls = {};
                        standardData.metadata = { 'source-standard-node': standardNodeId };
                    }
                    const standardCanvasNode: Node = {
                        id: standardNodeIdForCanvas,
                        type: resolveFlowNodeType('service'),
                        position: { x: position.x + 200, y: position.y - 100 },
                        data: standardData,
                    };
                    updatedNodes = [...updatedNodes, standardCanvasNode];
                }

                context.setEdges((edges) => {
                    const alreadyLinked = edges.some(
                        (edge) => edge.source === targetId && edge.target === standardNodeIdForCanvas
                            && (edge.data as any)?.lineStyle === 'dotted',
                    );
                    if (alreadyLinked) return edges;
                    const relationshipId = `rel-${Date.now()}`;
                    return [...edges, {
                        id: relationshipId,
                        source: targetId!,
                        target: standardNodeIdForCanvas,
                        type: 'tooltip',
                        label: 'adheres to',
                        markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15 },
                        style: { strokeWidth: 1.5 },
                        data: {
                            calmRelId: relationshipId,
                            calmVariant: 'connects',
                            protocol: '',
                            description: 'adheres to',
                            direction: 'source-to-target',
                            lineStyle: 'dotted',
                        },
                    }];
                });
                return updatedNodes;
            });
            setTimeout(() => context.emitChange(true), 0);
            setTimeout(context.enrichAllControls, 0);
            return true;
        }
    }

    const id = `${standardNode.nodeType}-${Date.now()}`;
    const hasCustomId = standardNode.id && /[a-zA-Z]/.test(standardNode.id);
    const newNode: Node = {
        id,
        type: resolveFlowNodeType(standardNode.nodeType),
        position,
        data: isHubSourced
            ? {
                label: standardNode.name,
                calmId: id,
                calmType: standardNode.nodeType,
                description: standardNode.description ?? '',
                interfaces: [],
                controls: controlsCopy,
                ...(hasCustomId && standardNode.sha ? { 'definition-id': `${standardNode.namespace}:standards:${standardNode.id}@${standardNode.sha}` } : {}),
            }
            : {
                label: standardNode.name,
                calmId: id,
                calmType: standardNode.nodeType,
                description: standardNode.description ?? '',
                interfaces: [],
                controls: controlsCopy,
                metadata: { 'source-standard-node': standardNode.id },
            },
    };
    context.setNodes((nodes) => [...nodes, newNode]);
    if (isHubSourced) {
        context.postMessage({ type: 'resolveDefinitionId', nodeId: id, curie: newNode.data['definition-id'] as string });
    }
    setTimeout(() => context.emitChange(true), 0);
    setTimeout(() => context.enrichNodeControls(context.getCurrentNodes()), 0);
    return true;
}