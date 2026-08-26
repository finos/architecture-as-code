import { Node, Edge } from 'reactflow';
import {
    getLayoutedElements,
    createTopLevelLayout,
    calculateChildBounds,
    sortContainersDeepestFirst,
    sortNodesParentsBeforeChildren,
} from './layoutUtils';
import { createEdge } from './edgeFactory';
import { GRAPH_LAYOUT } from './constants';
import { THEME } from '../theme';
import { getPatternArray, resolveOperativeChoiceBlock } from '@finos/calm-models/pattern';

/**
 * Result of parsing pattern data into ReactFlow elements
 */
export interface ParsedPatternData {
    nodes: Node[];
    edges: Edge[];
}

/** A loosely-typed JSON Schema object for pattern traversal */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SchemaObject = Record<string, any>;

// ---- Schema traversal helpers ----

/**
 * Gets the prefixItems for a given top-level key (e.g. 'nodes' or 'relationships')
 * from a pattern, handling allOf structures. Absent prefixItems yields an empty
 * array so callers can iterate unconditionally.
 */
function getPrefixItems(pattern: SchemaObject, key: 'nodes' | 'relationships'): SchemaObject[] {
    return getPatternArray(pattern, key).prefixItems as SchemaObject[];
}

/**
 * Gets the `items` catalog schema (the `items.oneOf`/`items.anyOf` open-catalog
 * declaration) for a given top-level key (e.g. 'nodes' or 'relationships')
 * from a pattern, handling allOf structures.
 */
function getItems(pattern: SchemaObject, key: 'nodes' | 'relationships'): SchemaObject | undefined {
    return getPatternArray(pattern, key).catalog as SchemaObject | undefined;
}

/**
 * Reads a value from a schema property, handling `const` wrappers.
 */
function readSchemaValue(obj: SchemaObject | undefined, key: string): string | undefined {
    const prop = obj?.['properties']?.[key];
    if (!prop) return undefined;
    if (prop['const'] !== undefined) return String(prop['const']);
    return undefined;
}

/**
 * Extracts interfaces from a pattern node's schema item.
 * Reads prefixItems and extracts unique-id and $ref type for each interface.
 */
function extractInterfaces(item: SchemaObject): SchemaObject[] | undefined {
    const interfacesProp = item['properties']?.['interfaces'];
    if (!interfacesProp) return undefined;

    const prefixItems: SchemaObject[] = interfacesProp['prefixItems'] || [];
    if (prefixItems.length === 0) return undefined;

    return prefixItems.map((iface: SchemaObject) => {
        const uniqueId = iface['properties']?.['unique-id']?.['const'];
        const ref = iface['$ref'] as string | undefined;
        // Extract the interface type from the $ref (e.g., "url-interface" from ".../defs/url-interface")
        const interfaceType = ref?.split('/').pop();
        return {
            'unique-id': uniqueId || '',
            ...(interfaceType && { type: interfaceType }),
        };
    });
}

/**
 * Extracts controls from a pattern item's JSON Schema by walking the schema
 * and pulling `const` values to produce architecture-like instance data.
 *
 * Pattern controls schema:
 *   { "$ref": "...", "properties": { "security": { "properties": { "description": { "const": "..." }, "requirements": { "prefixItems": [...] } } } } }
 *
 * Extracted result (matches CalmControlsSchema):
 *   { "security": { "description": "...", "requirements": [{ "requirement-url": "...", "config-url": "..." }] } }
 */
function extractPatternControls(item: SchemaObject): SchemaObject | undefined {
    const controlsSchema = item['properties']?.['controls'];
    if (!controlsSchema) return undefined;

    const controlProperties: SchemaObject | undefined = controlsSchema['properties'];
    if (!controlProperties) return undefined;

    const result: SchemaObject = {};

    for (const [controlId, controlSchema] of Object.entries(controlProperties)) {
        if (controlId.startsWith('$')) continue; // skip $ref etc.
        const props = (controlSchema as SchemaObject)?.['properties'];
        if (!props) continue;

        const description = props['description']?.['const'] as string | undefined;
        const requirementsSchema = props['requirements'];
        const prefixItems: SchemaObject[] = requirementsSchema?.['prefixItems'] || [];

        const requirements = prefixItems.map((reqItem: SchemaObject) => {
            const reqProps = reqItem['properties'] || {};
            const req: SchemaObject = {};
            for (const [key, val] of Object.entries(reqProps)) {
                if ((val as SchemaObject)?.['const'] !== undefined) {
                    req[key] = (val as SchemaObject)['const'];
                }
            }
            return req;
        }).filter((req: SchemaObject) => Object.keys(req).length > 0);

        if (description || requirements.length > 0) {
            result[controlId] = {
                ...(description && { description }),
                requirements,
            };
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

// ---- Node extraction ----

function extractPatternDetails(item: SchemaObject): { 'detailed-architecture': string } | undefined {
    const detailsSchema = item['properties']?.['details'];
    if (!detailsSchema) return undefined;
    const detailedArch = detailsSchema['properties']?.['detailed-architecture']?.['const'];
    if (!detailedArch) return undefined;
    return { 'detailed-architecture': String(detailedArch) };
}

interface ExtractedNode {
    uniqueId: string;
    name: string;
    nodeType: string;
    description: string;
    interfaces?: SchemaObject[];
    controls?: SchemaObject;
    details?: { 'detailed-architecture': string };
    decisionGroupId?: string;
}

function extractNodeFromSchemaItem(item: SchemaObject): ExtractedNode | null {
    const uniqueId = readSchemaValue(item, 'unique-id');
    if (!uniqueId) return null;
    return {
        uniqueId,
        name: readSchemaValue(item, 'name') || uniqueId,
        nodeType: readSchemaValue(item, 'node-type') || 'service',
        description: readSchemaValue(item, 'description') || '',
        interfaces: extractInterfaces(item),
        controls: extractPatternControls(item),
        details: extractPatternDetails(item),
    };
}

interface DecisionGroup {
    groupId: string;
    groupType: 'oneOf' | 'anyOf';
    nodeIds: string[];
}

/**
 * Extracts a set of oneOf/anyOf node alternatives into ExtractedNodes, stamping
 * them all with the same decisionGroupId and recording a DecisionGroup for them.
 */
function extractNodeDecisionGroup(
    alternatives: SchemaObject[],
    groupId: string,
    groupType: 'oneOf' | 'anyOf',
    nodes: ExtractedNode[],
    decisionGroups: DecisionGroup[],
): void {
    const groupNodeIds: string[] = [];

    alternatives.forEach((alt: SchemaObject) => {
        const node = extractNodeFromSchemaItem(alt);
        if (node) {
            node.decisionGroupId = groupId;
            nodes.push(node);
            groupNodeIds.push(node.uniqueId);
        }
    });

    if (groupNodeIds.length > 0) {
        decisionGroups.push({ groupId, groupType, nodeIds: groupNodeIds });
    }
}

function extractNodesFromPattern(pattern: SchemaObject): { nodes: ExtractedNode[]; decisionGroups: DecisionGroup[] } {
    const prefixItems = getPrefixItems(pattern, 'nodes');
    const items = getItems(pattern, 'nodes');
    const nodes: ExtractedNode[] = [];
    const decisionGroups: DecisionGroup[] = [];

    prefixItems.forEach((item: SchemaObject, index: number) => {
        const block = resolveOperativeChoiceBlock(item);
        if (block) {
            extractNodeDecisionGroup(block.alternatives as SchemaObject[], `node-decision-${index}`, block.groupType, nodes, decisionGroups);
        } else {
            const node = extractNodeFromSchemaItem(item);
            if (node) {
                nodes.push(node);
            }
        }
    });

    // Open catalog: `items.oneOf`/`items.anyOf` declares zero-or-more candidates
    // that aren't tied to a specific positional slot. Treat the whole catalog as
    // a single decision-group slot.
    if (items) {
        const catalog = resolveOperativeChoiceBlock(items);
        if (catalog) {
            extractNodeDecisionGroup(catalog.alternatives as SchemaObject[], 'node-decision-items', catalog.groupType, nodes, decisionGroups);
        }
    }

    return { nodes, decisionGroups };
}

// ---- Relationship extraction ----

interface ExtractedRelationship {
    uniqueId: string;
    description: string;
    protocol?: string;
    type: 'connects' | 'interacts' | 'deployed-in' | 'composed-of';
    relationshipTypeConst?: SchemaObject;
    sourceNode?: string;
    destinationNode?: string;
    actor?: string;
    targetNodes?: string[];
    container?: string;
    containedNodes?: string[];
    controls?: SchemaObject;
    decisionGroupId?: string;
}

interface OptionsMetadata {
    prompt: string;
    optionType: 'oneOf' | 'anyOf';
    choices: { description: string; nodes: string[]; relationships: string[] }[];
    relationshipId: string;
}

function extractRelTypeFromConst(relTypeConst: SchemaObject): Omit<ExtractedRelationship, 'uniqueId' | 'description' | 'protocol' | 'decisionGroupId'> | null {
    if (relTypeConst['connects']) {
        return {
            type: 'connects',
            sourceNode: relTypeConst['connects']['source']?.['node'],
            destinationNode: relTypeConst['connects']['destination']?.['node'],
        };
    }
    if (relTypeConst['interacts']) {
        return {
            type: 'interacts',
            actor: relTypeConst['interacts']['actor'],
            targetNodes: relTypeConst['interacts']['nodes'],
        };
    }
    if (relTypeConst['deployed-in']) {
        return {
            type: 'deployed-in',
            container: relTypeConst['deployed-in']['container'],
            containedNodes: relTypeConst['deployed-in']['nodes'],
        };
    }
    if (relTypeConst['composed-of']) {
        return {
            type: 'composed-of',
            container: relTypeConst['composed-of']['container'],
            containedNodes: relTypeConst['composed-of']['nodes'],
        };
    }
    return null;
}

function isOptionsRelationship(item: SchemaObject): boolean {
    return item['properties']?.['relationship-type']?.['properties']?.['options'] !== undefined;
}

function extractSingleRelationship(item: SchemaObject): ExtractedRelationship | null {
    const uniqueId = readSchemaValue(item, 'unique-id');
    if (!uniqueId) return null;

    const description = readSchemaValue(item, 'description') || '';
    const protocol = readSchemaValue(item, 'protocol');
    const controls = extractPatternControls(item);

    // relationship-type can be in a const or in properties
    const relTypeConst = item['properties']?.['relationship-type']?.['const'];
    if (relTypeConst) {
        const relInfo = extractRelTypeFromConst(relTypeConst);
        if (relInfo) {
            return { uniqueId, description, protocol, controls, relationshipTypeConst: relTypeConst, ...relInfo };
        }
    }

    return null;
}

function extractOptionsMetadata(item: SchemaObject): OptionsMetadata | null {
    const prompt = readSchemaValue(item, 'description') || 'Decision';
    const relationshipId = readSchemaValue(item, 'unique-id') || '';

    const optionsPrefixItems: SchemaObject[] =
        item['properties']?.['relationship-type']?.['properties']?.['options']?.['prefixItems'] || [];

    for (const prefixItem of optionsPrefixItems) {
        const block = resolveOperativeChoiceBlock(prefixItem);

        if (block) {
            const optionType = block.groupType;
            const alternatives = block.alternatives as SchemaObject[];

            const choices = alternatives
                .map((alt: SchemaObject) => {
                    const desc = readSchemaValue(alt, 'description') || '';
                    const nodesProp = alt['properties']?.['nodes']?.['const'];
                    const relsProp = alt['properties']?.['relationships']?.['const'];
                    return {
                        description: desc,
                        nodes: Array.isArray(nodesProp) ? nodesProp : [],
                        relationships: Array.isArray(relsProp) ? relsProp : [],
                    };
                })
                .filter((c) => c.description);

            if (choices.length > 0) {
                return { prompt, optionType, choices, relationshipId };
            }
        }
    }
    return null;
}

/**
 * Extracts a set of oneOf/anyOf relationship alternatives, stamping them all
 * with the same decisionGroupId (relationship-side grouping only affects edge
 * color/dash — there is no relationship decision-group box).
 */
function extractRelationshipDecisionGroup(
    alternatives: SchemaObject[],
    groupId: string,
    relationships: ExtractedRelationship[],
): void {
    alternatives.forEach((alt: SchemaObject) => {
        const rel = extractSingleRelationship(alt);
        if (rel) {
            rel.decisionGroupId = groupId;
            relationships.push(rel);
        }
    });
}

function extractRelationshipsFromPattern(pattern: SchemaObject): {
    relationships: ExtractedRelationship[];
    optionsMetadata: OptionsMetadata[];
} {
    const prefixItems = getPrefixItems(pattern, 'relationships');
    const items = getItems(pattern, 'relationships');
    const relationships: ExtractedRelationship[] = [];
    const optionsMetadata: OptionsMetadata[] = [];

    prefixItems.forEach((item: SchemaObject, index: number) => {
        // Check for options relationship first
        if (isOptionsRelationship(item)) {
            const meta = extractOptionsMetadata(item);
            if (meta) {
                optionsMetadata.push(meta);
            }
            return;
        }

        // Check for oneOf/anyOf wrapped relationships
        const block = resolveOperativeChoiceBlock(item);
        if (block) {
            extractRelationshipDecisionGroup(block.alternatives as SchemaObject[], `rel-decision-${index}`, relationships);
            return;
        }

        // Regular relationship
        const rel = extractSingleRelationship(item);
        if (rel) {
            relationships.push(rel);
        }
    });

    // Open catalog: `items.oneOf`/`items.anyOf` declares zero-or-more relationship
    // candidates not tied to a specific positional slot.
    if (items) {
        const catalog = resolveOperativeChoiceBlock(items);
        if (catalog) {
            extractRelationshipDecisionGroup(catalog.alternatives as SchemaObject[], 'rel-decision-items', relationships);
        }
    }

    return { relationships, optionsMetadata };
}

// ---- ReactFlow conversion ----

interface ContainerInfo {
    containerNodeIds: Set<string>;
    parentMap: Map<string, string>;
}

function buildContainerInfo(relationships: ExtractedRelationship[]): ContainerInfo {
    const containerNodeIds = new Set<string>();
    const parentMap = new Map<string, string>();

    relationships.forEach((rel) => {
        if ((rel.type === 'deployed-in' || rel.type === 'composed-of') && rel.container && rel.containedNodes) {
            containerNodeIds.add(rel.container);
            rel.containedNodes.forEach((childId) => {
                parentMap.set(childId, rel.container!);
            });
        }
    });

    return { containerNodeIds, parentMap };
}

function createReactFlowNodes(
    extractedNodes: ExtractedNode[],
    decisionGroups: DecisionGroup[],
    containerInfo: ContainerInfo,
    groupOptionsMap?: Map<string, OptionsMetadata>,
): { regularNodes: Node[]; groupNodes: Node[] } {
    const regularNodes: Node[] = [];
    const groupNodes: Node[] = [];
    const { containerNodeIds, parentMap } = containerInfo;

    // Determine each non-container node's parent. A container (deployed-in /
    // composed-of) takes precedence over a decision group: a node that is both an
    // optional decision candidate AND a container child renders inside its
    // container, not in the choice box. Track which decision groups actually keep
    // at least one child after that precedence is applied.
    const effectiveParent = new Map<string, string>();
    const usedDecisionGroupIds = new Set<string>();
    extractedNodes.forEach((node) => {
        if (containerNodeIds.has(node.uniqueId)) {
            // A container candidate is not drawn inside the box, but the decision is
            // still real, so the box must survive to carry its prompt. Nesting the
            // container inside the box is #2933.
            if (node.decisionGroupId) usedDecisionGroupIds.add(node.decisionGroupId);
            return;
        }
        const parentId = parentMap.get(node.uniqueId) || node.decisionGroupId;
        if (!parentId) return;
        effectiveParent.set(node.uniqueId, parentId);
        if (parentId === node.decisionGroupId) {
            usedDecisionGroupIds.add(node.decisionGroupId);
        }
    });

    // Create decision group parent nodes — but only for groups that still have at
    // least one child after container precedence is applied, so a group whose every
    // member was pulled into a container does not render as an empty box.
    decisionGroups.forEach((group) => {
        if (!usedDecisionGroupIds.has(group.groupId)) return;
        const optionsMeta = groupOptionsMap?.get(group.groupId);
        groupNodes.push({
            id: group.groupId,
            type: 'decisionGroup',
            position: { x: 0, y: 0 },
            style: { zIndex: -1 },
            data: {
                label: group.groupType,
                decisionType: group.groupType,
                ...(optionsMeta && {
                    prompt: optionsMeta.prompt,
                    choices: optionsMeta.choices,
                }),
            },
        });
    });

    // Build CALM-style node data for the graph and sidebar
    function buildNodeData(node: ExtractedNode): Record<string, unknown> {
        const data: Record<string, unknown> = {
            // label is read by CustomNode for display
            label: node.name,
            // CALM schema fields
            'unique-id': node.uniqueId,
            'node-type': node.nodeType,
            name: node.name,
            description: node.description,
        };
        if (node.interfaces) data['interfaces'] = node.interfaces;
        if (node.controls) data['controls'] = node.controls;
        if (node.details) data['details'] = node.details;
        return data;
    }

    // Create system/container group nodes
    extractedNodes.forEach((node) => {
        if (containerNodeIds.has(node.uniqueId)) {
            const existingParentId = parentMap.get(node.uniqueId);
            groupNodes.push({
                id: node.uniqueId,
                type: 'group',
                position: { x: 0, y: 0 },
                style: { zIndex: -1 },
                data: buildNodeData(node),
                ...(existingParentId && { parentId: existingParentId }),
            });
        }
    });

    // Create regular nodes
    extractedNodes.forEach((node) => {
        if (containerNodeIds.has(node.uniqueId)) return; // already a group node

        const parentId = effectiveParent.get(node.uniqueId);

        regularNodes.push({
            id: node.uniqueId,
            type: 'custom',
            position: { x: 0, y: 0 },
            data: buildNodeData(node),
            ...(parentId && { parentId }),
        });
    });

    return { regularNodes, groupNodes };
}

function createReactFlowEdges(
    relationships: ExtractedRelationship[],
    allNodeIds: Set<string>,
): Edge[] {
    const edges: Edge[] = [];
    let edgeIndex = 0;

    relationships.forEach((rel) => {
        if (rel.type === 'deployed-in' || rel.type === 'composed-of') return;

        if (rel.type === 'connects' && rel.sourceNode && rel.destinationNode) {
            if (!allNodeIds.has(rel.sourceNode) || !allNodeIds.has(rel.destinationNode)) return;

            const color = rel.decisionGroupId ? THEME.colors.decision.oneOf : THEME.colors.accent;
            const edgeData: Record<string, unknown> = {
                'unique-id': rel.uniqueId,
                description: rel.description,
                'relationship-type': rel.relationshipTypeConst,
            };
            if (rel.protocol) edgeData['protocol'] = rel.protocol;
            if (rel.controls) edgeData['controls'] = rel.controls;
            edges.push(
                createEdge({
                    id: `pattern-edge-${edgeIndex++}`,
                    source: rel.sourceNode,
                    target: rel.destinationNode,
                    label: rel.description || rel.protocol || '',
                    color,
                    dashed: !!rel.decisionGroupId,
                    data: edgeData,
                })
            );
        }

        if (rel.type === 'interacts' && rel.actor && rel.targetNodes) {
            rel.targetNodes.forEach((targetId, targetIndex) => {
                if (!allNodeIds.has(rel.actor!) || !allNodeIds.has(targetId)) return;

                const edgeData: Record<string, unknown> = {
                    'unique-id': rel.uniqueId,
                    description: rel.description,
                    'relationship-type': rel.relationshipTypeConst,
                };
                if (rel.controls) edgeData['controls'] = rel.controls;
                edges.push(
                    createEdge({
                        id: `pattern-edge-${edgeIndex++}-${targetIndex}`,
                        source: rel.actor!,
                        target: targetId,
                        label: rel.description || 'interacts',
                        color: THEME.colors.edge.interacts,
                        animated: false,
                        dashed: true,
                        data: edgeData,
                    })
                );
            });
        }
    });

    return edges;
}


// ---- Layout ----

function applyPatternLayout(regularNodes: Node[], groupNodes: Node[], edges: Edge[]): ParsedPatternData {
    const nodesWithParents: Node[] = [];
    const nodesWithoutParents: Node[] = [];
    const topLevelGroupNodes: Node[] = [];

    regularNodes.forEach((node) => {
        if (node.parentId) {
            nodesWithParents.push(node);
        } else {
            nodesWithoutParents.push(node);
        }
    });

    groupNodes.forEach((node) => {
        if (node.parentId) {
            nodesWithParents.push(node);
        } else {
            nodesWithoutParents.push(node);
            topLevelGroupNodes.push(node);
        }
    });

    // Layout children within each group node, deepest-nested containers first
    // so that an outer container is sized once its inner container children
    // already know their own dimensions.
    sortContainersDeepestFirst(groupNodes).forEach((groupNode) => {
        const childNodes = nodesWithParents.filter((n) => n.parentId === groupNode.id);
        if (childNodes.length > 0) {
            const groupEdges = edges.filter(
                (e) => childNodes.some((n) => n.id === e.source) && childNodes.some((n) => n.id === e.target)
            );
            const { nodes: layoutedChildren } = getLayoutedElements(childNodes, groupEdges);
            const bounds = calculateChildBounds(layoutedChildren);
            const padding = GRAPH_LAYOUT.SYSTEM_NODE_PADDING;
            const width = bounds.maxX - bounds.minX + padding * 2;
            const height = bounds.maxY - bounds.minY + padding * 2;

            groupNode.width = width;
            groupNode.height = height;
            groupNode.style = { ...groupNode.style, width, height };

            layoutedChildren.forEach((child) => {
                const original = nodesWithParents.find((n) => n.id === child.id);
                if (original) {
                    original.position = {
                        x: child.position.x - bounds.minX + padding,
                        y: child.position.y - bounds.minY + padding,
                    };
                }
            });
        } else {
            const width = GRAPH_LAYOUT.SYSTEM_NODE_DEFAULT_WIDTH;
            const height = GRAPH_LAYOUT.SYSTEM_NODE_DEFAULT_HEIGHT;
            groupNode.width = width;
            groupNode.height = height;
            groupNode.style = { ...groupNode.style, width, height };
        }
    });

    // Layout top-level nodes
    const groupNodesForLayout = topLevelGroupNodes.map((s) => ({ ...s }));
    const topLevelEdges = edges.filter((e) => {
        const sourceInGroup = nodesWithParents.some((n) => n.id === e.source);
        const targetInGroup = nodesWithParents.some((n) => n.id === e.target);
        return !sourceInGroup || !targetInGroup;
    });
    const topLevelNodes = [...nodesWithoutParents, ...groupNodesForLayout];
    const positions = createTopLevelLayout(topLevelNodes, topLevelEdges);

    nodesWithoutParents.forEach((node) => {
        const pos = positions.get(node.id);
        if (pos) node.position = pos;
    });
    topLevelGroupNodes.forEach((node) => {
        const pos = positions.get(node.id);
        if (pos) node.position = pos;
    });

    const allNodes = sortNodesParentsBeforeChildren([
        ...topLevelGroupNodes,
        ...nodesWithoutParents.filter((n) => !groupNodes.includes(n)),
        ...nodesWithParents,
    ]);

    return { nodes: allNodes, edges };
}

// ---- Decision group / options-metadata folding ----

/**
 * Folds each options-relationship decision's referenced node ids into a single
 * decision group, mutating `decisionGroups`/`extractedNodes` in place:
 *
 * - Every decision gets its own new group (id derived from the options
 *   relationship's own unique-id). Each referenced id is moved into that new
 *   group, out of whatever group it previously belonged to (built during node
 *   extraction, e.g. a prefixItems oneOf slot or the items catalog, or an
 *   earlier decision processed in this same pass).
 * - A candidate can be drawn in one box only: once an id has been claimed by a
 *   decision, a later decision naming the same id does not draw it again, so
 *   that later decision's group contains only the ids that are still free.
 * - Ids that don't resolve to a real extracted node (dangling/typo'd
 *   references) are dropped; if a decision ends up with no valid ids at all,
 *   it is skipped entirely so no empty box is rendered.
 *
 * Returns the map from decision-group id to the OptionsMetadata that targets it.
 */
function foldOptionsMetadataIntoDecisionGroups(
    extractedNodes: ExtractedNode[],
    decisionGroups: DecisionGroup[],
    optionsMetadata: OptionsMetadata[],
): Map<string, OptionsMetadata> {
    const nodeToGroupMap = new Map<string, string>();
    decisionGroups.forEach((g) => g.nodeIds.forEach((nid) => nodeToGroupMap.set(nid, g.groupId)));

    const extractedNodeIds = new Set(extractedNodes.map((n) => n.uniqueId));
    const nodesById = new Map(extractedNodes.map((n) => [n.uniqueId, n]));
    const groupsById = new Map(decisionGroups.map((g) => [g.groupId, g]));

    const groupOptionsMap = new Map<string, OptionsMetadata>();

    // A candidate can be drawn in one box only, so the first decision to name it keeps it.
    const claimedByDecision = new Set<string>();

    optionsMetadata.forEach((meta) => {
        const referencedIds = Array.from(new Set(meta.choices.flatMap((c) => c.nodes))).filter(
            (id) => extractedNodeIds.has(id) && !claimedByDecision.has(id)
        );

        // Nothing left to draw: either the ids are dangling, or an earlier decision has
        // them all. Boxing one node twice needs the nesting rework (#2933).
        if (referencedIds.length === 0) return;

        const targetGroup: DecisionGroup = {
            groupId: `node-decision-${meta.relationshipId || referencedIds.join('-')}`,
            groupType: meta.optionType,
            nodeIds: [],
        };
        decisionGroups.push(targetGroup);
        groupsById.set(targetGroup.groupId, targetGroup);

        referencedIds.forEach((id) => {
            const currentGroupId = nodeToGroupMap.get(id);
            if (currentGroupId) {
                const oldGroup = groupsById.get(currentGroupId);
                if (oldGroup) {
                    oldGroup.nodeIds = oldGroup.nodeIds.filter((nid) => nid !== id);
                }
            }

            targetGroup.nodeIds.push(id);
            nodeToGroupMap.set(id, targetGroup.groupId);
            claimedByDecision.add(id);

            const node = nodesById.get(id);
            if (node) node.decisionGroupId = targetGroup.groupId;
        });

        groupOptionsMap.set(targetGroup.groupId, meta);
    });

    // Drop any groups emptied out by the folding above so no empty box renders.
    const emptiedGroupIds = new Set(
        decisionGroups.filter((g) => g.nodeIds.length === 0).map((g) => g.groupId)
    );
    if (emptiedGroupIds.size > 0) {
        for (let i = decisionGroups.length - 1; i >= 0; i--) {
            if (emptiedGroupIds.has(decisionGroups[i].groupId)) {
                decisionGroups.splice(i, 1);
            }
        }
    }

    return groupOptionsMap;
}

// ---- Public API ----

/**
 * Parses a CALM pattern JSON Schema into ReactFlow nodes and edges.
 */
export function parsePatternData(pattern: SchemaObject): ParsedPatternData {
    if (!pattern) return { nodes: [], edges: [] };

    try {
        const { nodes: extractedNodes, decisionGroups } = extractNodesFromPattern(pattern);
        const { relationships, optionsMetadata } = extractRelationshipsFromPattern(pattern);

        // Fold each decision's referenced node ids into a single decision group
        // (creating one if none of its ids already belong to one) and build the
        // map from decision-group id to the OptionsMetadata that targets it.
        const groupOptionsMap = foldOptionsMetadataIntoDecisionGroups(extractedNodes, decisionGroups, optionsMetadata);

        const containerInfo = buildContainerInfo(relationships);
        const { regularNodes, groupNodes } = createReactFlowNodes(
            extractedNodes, decisionGroups, containerInfo, groupOptionsMap,
        );

        // Collect all node IDs for edge validation (include decision group IDs)
        const allNodeIds = new Set<string>();
        extractedNodes.forEach((n) => allNodeIds.add(n.uniqueId));
        decisionGroups.forEach((g) => allNodeIds.add(g.groupId));

        const edges = createReactFlowEdges(relationships, allNodeIds);

        return applyPatternLayout(regularNodes, groupNodes, edges);
    } catch (error) {
        console.error('Error parsing pattern data:', error);
        return { nodes: [], edges: [] };
    }
}
