import { CalmRelationshipCanonicalModel, toKindView, CalmRelationshipTypeKindView } from '@finos/calm-models/canonical';
import { VMEdge } from '../../types';
import { VMEdgeFactory, EdgeConfig } from './vm-factory-interfaces';
import { labelFor, ifaceId, pickIface } from '../utils';

/**
 * Standard implementation of VMEdgeFactory for creating edges from relationships
 */
export class StandardVMEdgeFactory implements VMEdgeFactory {
    createEdge(relationship: CalmRelationshipCanonicalModel, config: EdgeConfig): VMEdge[] {
        const kind = toKindView(relationship['relationship-type']);
        const edges: VMEdge[] = [];

        if (kind.kind === 'connects') {
            const edge = this.createConnectsEdge(relationship, kind, config);
            if (edge) edges.push(edge);
        }

        if (kind.kind === 'interacts') {
            const interactEdges = this.createInteractsEdges(relationship, kind, config);
            edges.push(...interactEdges);
        }

        return edges;
    }

    private createConnectsEdge(
        rel: CalmRelationshipCanonicalModel,
        kind: Extract<CalmRelationshipTypeKindView, { kind: 'connects' }>,
        config: EdgeConfig
    ): VMEdge | null {
        const srcNode = kind.source.node;
        const dstNode = kind.destination.node;
        const srcIface = pickIface(kind.source);
        const dstIface = pickIface(kind.destination);

        const source = config.renderInterfaces && srcIface ? ifaceId(srcNode, srcIface) : srcNode;
        const target = config.renderInterfaces && dstIface ? ifaceId(dstNode, dstIface) : dstNode;

        let label: string | undefined;
        if (config.edgeLabelMode === 'description') {
            label = this.generateEdgeLabel(rel, srcNode, dstNode, srcIface, dstIface, config);
        }

        return { id: rel['unique-id'], source, target, label };
    }

    private createInteractsEdges(
        rel: CalmRelationshipCanonicalModel,
        kind: Extract<CalmRelationshipTypeKindView, { kind: 'interacts' }>,
        config: EdgeConfig
    ): VMEdge[] {
        const edges: VMEdge[] = [];
        for (const n of kind.nodes || []) {
            let label: string | undefined;
            if (config.edgeLabelMode === 'description') {
                label = rel.description || 'interacts';
            }
            edges.push({
                id: `${rel['unique-id']}::${n}`,
                source: kind.actor,
                target: n,
                label
            });
        }
        return edges;
    }

    private generateEdgeLabel(
        rel: CalmRelationshipCanonicalModel,
        srcNode: string,
        dstNode: string,
        srcIface: string | undefined,
        dstIface: string | undefined,
        config: EdgeConfig
    ): string | undefined {
        // Prefer description; if absent, fall back to combined interface names
        if (rel.description) return rel.description;

        const srcIfaceName = srcIface ? config.ifaceNames.get(srcNode)?.get(srcIface) : undefined;
        const dstIfaceName = dstIface ? config.ifaceNames.get(dstNode)?.get(dstIface) : undefined;

        if (srcIfaceName || dstIfaceName) {
            const srcLabel = srcIfaceName ?? labelFor(config.nodesById.get(srcNode), srcNode);
            const dstLabel = dstIfaceName ?? labelFor(config.nodesById.get(dstNode), dstNode);
            return `${srcLabel} → ${dstLabel}`;
        }

        return undefined;
    }
}
