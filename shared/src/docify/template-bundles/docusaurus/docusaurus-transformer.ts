/* eslint-disable  @typescript-eslint/no-explicit-any */
import {Architecture,CalmCore} from '../../../model/core';
import {CalmTemplateTransformer} from '../../../template/types';
import {CalmCoreSchema} from '../../../types/core-types';
import {CalmRelationshipGraph} from '../../graphing/relationship-graph';
import {C4Model} from '../../graphing/c4';
import {FlowSequenceHelper} from '../../graphing/flow-sequence-helper';
import {ControlRegistry} from '../../graphing/control-registry';

export default class DocusaurusTransformer implements CalmTemplateTransformer {
    getTransformedModel(calmJson: string) {
        const calmSchema: CalmCoreSchema = JSON.parse(calmJson);
        const architecture: Architecture = CalmCore.fromJson(calmSchema);
        const graph = new CalmRelationshipGraph(architecture.relationships);
        const flowHelper = new FlowSequenceHelper();

        const nodes = architecture.nodes.map(node => ({
            ...node,
            id: node.uniqueId,
            title: node.name,
            description: node.description || 'No description available.',
            nodeType: node.nodeType || 'unknown',
            relatedRelationships: graph.getRelatedRelationships(node.uniqueId),
            relatedNodes: graph.getRelatedNodes(node.uniqueId)
        }));

        const flows = architecture.flows.map(flow => {
            const transformedTransitions = flowHelper.transformFlowTransitions(flow.transitions, architecture);

            return {
                ...flow,
                title: flow.name,
                id: flow.uniqueId,
                transitions: transformedTransitions
            };
        });

        const relationships = architecture.relationships.map(rel => ({
            ...rel,
            id: rel.uniqueId,
            title: rel.uniqueId,
            relationshipType: rel.relationshipType
        }));

        const metadata = architecture.metadata;

        const controlRegistry = new ControlRegistry(architecture);
        controlRegistry.processControls();

        const controls = controlRegistry.getControls();
        const controlReqs = controlRegistry.getControlRequirements();
        const groupedByDomainRequirements = controlRegistry.getGroupedByDomainRequirements();
        const groupedByDomainConfigurations = controlRegistry.getGroupedByDomainConfigurations();
        const controlConfigurations = controlRegistry.getControlConfigurations();

        const C4model = new C4Model(architecture);
        const adrs = architecture.adrs;

        return {
            nodes,
            relationships,
            flows,
            controls,
            controlReqs,
            C4model,
            metadata,
            adrs,
            docs: {
                nodes,
                flows,
                controls,
                relationships,
                controlReqs,
                groupedByDomainRequirements,
                groupedByDomainConfigurations,
                C4model,
                controlConfigurations,
                metadata,
                adrs
            }
        };
    }


    registerTemplateHelpers(): Record<string, (...args: unknown[]) => unknown> {
        return {
            eq: (a, b) => a === b,
            lookup: (obj, key: any) => obj?.[key],
            json: (obj) => JSON.stringify(obj, null, 2),
            instanceOf: (value, className: string) => value?.constructor?.name === className,
            kebabToTitleCase: (str: string) => str
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' '),
            kebabCase: (str: string) => str
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric characters with hyphens
                .replace(/^-+|-+$/g, ''), // Remove leading or trailing hyphens
            isObject: (value: unknown) => typeof value === 'object' && value !== null && !Array.isArray(value),
            isArray: (value: unknown) => Array.isArray(value),
            notEmpty: function (value: unknown) {
                if (Array.isArray(value)) return value.length > 0;
                if (typeof value === 'object' && value !== null)
                    return Object.keys(value).length > 0;
                return true;
            },
            or: (...args: unknown[]) => {
                const actualArgs = args.slice(0, -1);
                return actualArgs.some(Boolean);
            }
        };
    }

}
