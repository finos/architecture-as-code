import {
    CalmCoreCanonicalModel,
    CalmRelationshipCanonicalModel,
    CalmRelationshipTypeCanonicalModel,
    CalmRelationshipTypeKindView,
    toKindView,
    visitRelationship,
} from '@finos/calm-models/canonical';
import { CalmWidget } from '../../types';

type RelatedNodesViewModel = {
    id?: string;
    nodeId?: string;
    relationshipId?: string;
    relatedRelationships: CalmRelationshipTypeKindView[];
};

interface RelatedNodesOptions {
    ['node-id']?: string;
    ['relationship-id']?: string;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v);

const isCalmCoreCanonicalModel = (v: unknown): v is CalmCoreCanonicalModel =>
    isObj(v) &&
    Array.isArray((v as { nodes?: unknown[] }).nodes) &&
    Array.isArray((v as { relationships?: unknown[] }).relationships);

const findById = (
    rels: CalmRelationshipCanonicalModel[],
    id: string
): CalmRelationshipCanonicalModel | undefined =>
    rels.find(r => r['unique-id'] === id);

const filterContainerRelationshipForNode = (
    rt: CalmRelationshipTypeCanonicalModel,
    targetNode: string
): CalmRelationshipTypeCanonicalModel => {
    return visitRelationship<CalmRelationshipTypeCanonicalModel>(rt, {
        deployedIn: r => {
            if (r['deployed-in'].container === targetNode) {
                return rt;
            }
            return {
                'deployed-in': {
                    container: r['deployed-in'].container,
                    nodes: r['deployed-in'].nodes?.includes(targetNode) ? [targetNode] : []
                }
            };
        },
        composedOf: r => {
            if (r['composed-of'].container === targetNode) {
                return rt;
            }
            return {
                'composed-of': {
                    container: r['composed-of'].container,
                    nodes: r['composed-of'].nodes?.includes(targetNode) ? [targetNode] : []
                }
            };
        },
        interacts: r => r.interacts.actor === targetNode
            ? rt
            : {
                interacts: {
                    actor: r.interacts.actor,
                    nodes: r.interacts.nodes?.filter(n => n === targetNode) || []
                }
            },
        default: () => rt,
    });
};

const getRelatedRelationships = (
    relationships: CalmRelationshipCanonicalModel[],
    targetNode: string
): CalmRelationshipCanonicalModel[] => {
    return relationships
        .map(rel => ({
            ...rel,
            'relationship-type': filterContainerRelationshipForNode(rel['relationship-type'], targetNode)
        }))
        .filter(rel => {
            const rt = rel['relationship-type'];
            return visitRelationship<boolean>(rt, {
                interacts:   r => r.interacts.actor === targetNode || (r.interacts.nodes ?? []).includes(targetNode),
                connects:    r => r.connects.source?.node === targetNode || r.connects.destination?.node === targetNode,
                deployedIn:  r => r['deployed-in'].container === targetNode || (r['deployed-in'].nodes ?? []).includes(targetNode),
                composedOf:  r => r['composed-of'].container === targetNode || (r['composed-of'].nodes ?? []).includes(targetNode),
                default:     () => false,
            });
        });
};

export const RelatedNodesWidget: CalmWidget<CalmCoreCanonicalModel, RelatedNodesOptions, RelatedNodesViewModel> = {
    id: 'related-nodes',
    templatePartial: 'related-nodes-template.hbs',
    partials: [
        'interacts-relationship.hbs',
        'connects-relationship.hbs',
        'composed-of-relationship.hbs',
        'deployed-in-relationship.hbs'
    ],

    transformToViewModel: (context, options) => {
        if (!isCalmCoreCanonicalModel(context)) return { relatedRelationships: [] };

        const nodeId = options?.['node-id'];
        const relId = options?.['relationship-id'];

        const relationships = context.relationships;

        if (relId) {
            const found = findById(relationships, relId);
            return found
                ? { relationshipId: relId, relatedRelationships: [toKindView(found['relationship-type'])] }
                : { relationshipId: relId, relatedRelationships: [] };
        }

        if (nodeId) {
            const filteredRels = getRelatedRelationships(relationships, nodeId);
            return {
                id: nodeId,
                nodeId,
                relatedRelationships: filteredRels.map(r => toKindView(r['relationship-type']))
            };
        }

        return { relatedRelationships: [] };
    },

    validateContext: isCalmCoreCanonicalModel,
};
