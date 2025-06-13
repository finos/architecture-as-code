/* eslint-disable  @typescript-eslint/no-explicit-any */
import {Architecture,CalmCore} from '../../../model/core';
import {CalmControl} from '../../../model/control';
import {CalmFlowTransition} from '../../../model/flow';
import {CalmTemplateTransformer} from '../../../template/types';
import {CalmCoreSchema} from '../../../types/core-types';
import {CalmRelationshipGraph} from '../../graphing/relationship-graph';
import {C4Model} from '../../graphing/c4';

export default class DocusaurusTransformer implements CalmTemplateTransformer {
    getTransformedModel(calmJson: string) {
        const calmSchema: CalmCoreSchema = JSON.parse(calmJson);
        const architecture: Architecture = CalmCore.fromJson(calmSchema);
        const graph = new CalmRelationshipGraph(architecture.relationships);

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
            const transformedTransitions = flow.transitions.map((transition: CalmFlowTransition) => ({
                ...transition,
                relationshipId: transition.relationshipUniqueId,
                source: this.getSourceFromRelationship(transition.relationshipUniqueId),
                target: this.getTargetFromRelationship(transition.relationshipUniqueId)
            }));

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
            title: rel.uniqueId
        }));

        const metadata = architecture.metadata;


        const controlRequirements: Record<string, { id:string, content:string, domain:string}[]> = {};

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const addControlRequirementToTable = (controls: CalmControl[], domain: string, appliedTo: string) => {
            controls.forEach(control => {
                control.requirements.forEach( detail => {
                    const requirement =  detail.controlRequirementUrl;
                    const id = requirement['$id'].split('/').filter(Boolean).pop() || '';
                    if (!controlRequirements[id]) {
                        controlRequirements[id] = [];
                        controlRequirements[id].push({
                            id,
                            content: requirement,
                            domain: control.controlId
                        });
                    }

                });
            });
        };

        const controlConfigurations: Record<string, { id:string, name:string, schema:string, description:string, domain: string, scope: string, appliedTo: string, content: string }[]> = {};

        const addControlConfigurationToTable = (controls: CalmControl[], scope: string, appliedTo: string) => {
            controls.forEach(control => {
                control.requirements.forEach( detail => {
                    const configuration = detail.controlConfigUrl;
                    const id = configuration['control-id'];
                    if (id) {
                        if (!controlConfigurations[id]) {
                            controlConfigurations[id] = [];
                        }
                        controlConfigurations[id].push({
                            id,
                            name: configuration['name'],
                            schema: configuration['$schema'],
                            description: configuration['description'],
                            domain: control.controlId,
                            scope,
                            appliedTo,
                            content: configuration
                        });
                    }
                });
            });
        };

        architecture.nodes.forEach(node => {
            addControlConfigurationToTable(node.controls, 'Node', node.uniqueId);
            addControlRequirementToTable(node.controls, 'Node', node.uniqueId);
        });

        architecture.relationships.forEach(relationship => {
            addControlConfigurationToTable(relationship.controls, 'Relationship', relationship.uniqueId);
            addControlRequirementToTable(relationship.controls, 'Relationship', relationship.uniqueId);
        });

        architecture.flows.forEach(flow => {
            addControlConfigurationToTable(flow.controls, 'Flow', flow.uniqueId);
            addControlRequirementToTable(flow.controls, 'Flow', flow.uniqueId);
        });

        const groupedByDomainRequirements: Record<string, { id: string; content: string; domain: string }[]> = {};

        Object.values(controlRequirements).forEach(requirements => {
            requirements.forEach(req => {
                if (!groupedByDomainRequirements[req.domain]) {
                    groupedByDomainRequirements[req.domain] = [];
                }
                groupedByDomainRequirements[req.domain].push(req);
            });
        });

        const groupedByDomainConfigurations: Record<string, { id:string, name:string, schema:string, description:string, domain: string, scope: string, appliedTo: string, content: string }[]> = {};

        Object.values(controlConfigurations).forEach(controlConfigurations => {
            controlConfigurations.forEach(req => {
                if (!groupedByDomainConfigurations[req.domain]) {
                    groupedByDomainConfigurations[req.domain] = [];
                }
                groupedByDomainConfigurations[req.domain].push(req);
            });
        });

        const controls = Object.entries(controlConfigurations).flatMap(([id, configurations]) =>
            configurations.map(config => ({
                id,
                ...config
            }))
        );

        const controlReqs = Object.entries(controlRequirements).flatMap(([id, requirements]) =>
            requirements.map(requirement => ({
                id,
                ...requirement
            }))
        );

        const C4model = new C4Model(architecture);

        return {
            nodes,
            relationships,
            flows,
            controls,
            controlReqs,
            C4model,
            metadata,
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
                metadata
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

    private getSourceFromRelationship(relationshipId: string): string {
        return relationshipId.split('-uses-')[0];
    }

    private getTargetFromRelationship(relationshipId: string): string {
        return relationshipId.split('-uses-').slice(-1)[0];
    }
}
