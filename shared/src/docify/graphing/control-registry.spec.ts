import { ControlRegistry } from './control-registry';
import { CalmCore, Architecture, CalmNode, CalmRelationship, CalmFlow, CalmControls } from '@finos/calm-models/model';
import { CalmControlsSchema} from '@finos/calm-models/types';
import { InMemoryResolver } from '../../resolver/calm-reference-resolver';
import {DereferencingVisitor} from '../../model-visitor/dereference-visitor';

describe('ControlRegistry', () => {
    let controlRegistry: ControlRegistry;
    let architecture: Architecture;

    beforeEach(async () => {
        const controlSchema: CalmControlsSchema = {
            'node-control': {
                description: 'Node Control',
                requirements: [
                    {
                        'requirement-url': 'https://example.org/requirement1',
                        config: {
                            'control-id': 'config1',
                            name: 'Config 1',
                            '$schema': 'schema1',
                            description: 'Test config 1'
                        }
                    }
                ]
            },
            'relationship-control': {
                description: 'Relationship Control',
                requirements: [
                    {
                        'requirement-url': 'https://example.org/requirement2',
                        config: {
                            'control-id': 'config2',
                            name: 'Config 2',
                            '$schema': 'schema2',
                            description: 'Test config 2'
                        }
                    }
                ]
            },
            'flow-control': {
                description: 'Flow Control',
                requirements: [
                    {
                        'requirement-url': 'https://example.org/requirement1', // ✅ changed from object to string
                        'config-url': 'https://example.org/config3'            // ✅ changed from Resolvable to string
                    }
                ]
            }
        };

        const derefData = {
            'https://example.org/config3': {
                'control-id': 'config3',
                name: 'Config 3',
                '$schema': 'schema3',
                description: 'Test config 3'
            },
            'https://example.org/requirement1': {
                'requirement': 'OAuth2'
            },
            'https://example.org/requirement2': {
                'requirement': 'JWT'
            }
        };

        const resolver = new InMemoryResolver(derefData);
        const derefVisitor = new DereferencingVisitor(resolver);
        const controls = CalmControls.fromSchema(controlSchema);

        const nodes = [
            CalmNode.fromSchema({
                'unique-id': 'node1',
                'node-type': 'service',
                name: 'Node 1',
                description: 'Test node 1',
                controls: controls.toSchema(),
                metadata: { created: 'now' },
                interfaces: [],
                additionalProperties: {}
            })
        ];

        const relationships = [
            CalmRelationship.fromSchema({
                'unique-id': 'rel1',
                'relationship-type': {
                    connects: {
                        source: { 'node': 'node1', interfaces: [] },
                        destination: { 'node': 'node2', interfaces: [] }
                    }
                },
                metadata: { created: 'now' },
                controls: controls.toSchema(),
                description: 'Test relationship',
                additionalProperties: {}
            })
        ];

        const flows = [
            CalmFlow.fromSchema({
                'unique-id': 'flow1',
                name: 'Flow 1',
                description: 'Test flow',
                transitions: [
                    {
                        'relationship-unique-id': 'rel1',
                        'sequence-number': 1,
                        description: 'Test transition',
                        direction: 'source-to-destination'
                    }
                ],
                controls: controls.toSchema(),
                metadata: { created: 'now' }
            })
        ];

        architecture = CalmCore.fromSchema({
            nodes: nodes.map(n => n.toSchema()),
            relationships: relationships.map(r => r.toSchema()),
            flows: flows.map(f => f.toSchema()),
            metadata: { created: 'now' }
        });

        await derefVisitor.visit(architecture);
        controlRegistry = new ControlRegistry(architecture);
        controlRegistry.processControls();
    });


    describe('getControls', () => {
        it('should return flattened list of control configurations', () => {
            const controls = controlRegistry.getControls();
            expect(controls).toHaveLength(9);

            const config1 = controls.find(c => c.requirementUrl === 'https://example.org/requirement1' && c.scope === 'Node' && c.domain === 'node-control');
            expect(config1).toBeDefined();
            expect(config1?.appliedTo).toBe('node1');

            const config2 = controls.find(c => c.requirementUrl === 'https://example.org/requirement2' && c.scope === 'Node' && c.domain === 'relationship-control');
            expect(config2).toBeDefined();
            expect(config2?.appliedTo).toBe('node1');

            const config3 = controls.find(c => c.requirementUrl === 'https://example.org/requirement1' && c.scope === 'Flow' && c.domain === 'flow-control');
            expect(config3).toBeDefined();
            expect(config3?.appliedTo).toBe('flow1');
        });
    });

    describe('getControlRequirements', () => {
        it('should return flattened list of control requirements', () => {
            const requirements = controlRegistry.getControlRequirements();
            expect(requirements).toHaveLength(9);

            const req1 = requirements.find(r => r.id === 'requirement1');
            expect(req1).toBeDefined();

            const req2 = requirements.find(r => r.id === 'requirement2');
            expect(req2).toBeDefined();
        });
    });

    describe('getGroupedByDomainRequirements', () => {
        it('should return requirements grouped by domain', () => {
            const grouped = controlRegistry.getGroupedByDomainRequirements();
            expect(Object.keys(grouped)).toEqual(
                expect.arrayContaining(['node-control', 'relationship-control', 'flow-control'])
            );
        });
    });

    describe('getGroupedByDomainConfigurations', () => {
        it('groups configurations by their domain key', () => {
            const grouped = controlRegistry.getGroupedByDomainConfigurations();
            expect(Object.keys(grouped)).toEqual(
                expect.arrayContaining(['node-control', 'relationship-control', 'flow-control'])
            );
        });
    });

    describe('getControlConfigurations', () => {
        it('returns the raw per-domain configuration map', () => {
            const raw = controlRegistry.getControlConfigurations();
            expect(raw['node-control']).toBeDefined();
            expect(raw['relationship-control']).toBeDefined();
            expect(raw['flow-control']).toBeDefined();
        });
    });

    describe('processControls edge cases', () => {
        it('skips nodes, relationships and flows that have no controls', async () => {
            const emptyNode = CalmNode.fromSchema({
                'unique-id': 'plain-node',
                'node-type': 'service',
                name: 'Plain Node',
                description: 'no controls',
                metadata: { created: 'now' },
                interfaces: [],
                additionalProperties: {},
            });
            const emptyRel = CalmRelationship.fromSchema({
                'unique-id': 'plain-rel',
                description: '',
                'relationship-type': {
                    connects: {
                        source: { node: 'plain-node', interfaces: [] },
                        destination: { node: 'plain-node', interfaces: [] },
                    },
                },
                metadata: [{}],
            });
            const emptyFlow = CalmFlow.fromSchema({
                'unique-id': 'plain-flow',
                name: 'plain',
                description: '',
                transitions: [],
                'requirement-url': '',
            });
            const bareArch = CalmCore.fromSchema({
                nodes: [emptyNode.toSchema()],
                relationships: [emptyRel.toSchema()],
                flows: [emptyFlow.toSchema()],
                metadata: { created: 'now' },
            });

            const bareRegistry = new ControlRegistry(bareArch);
            expect(() => bareRegistry.processControls()).not.toThrow();
            expect(bareRegistry.getControls()).toEqual([]);
            expect(bareRegistry.getControlRequirements()).toEqual([]);
            expect(bareRegistry.getGroupedByDomainRequirements()).toEqual({});
            expect(bareRegistry.getGroupedByDomainConfigurations()).toEqual({});
        });

        it('tolerates architectures without a flows section at all', () => {
            const noFlowsArch = CalmCore.fromSchema({
                nodes: [],
                relationships: [],
                metadata: { created: 'now' },
            });

            const noFlowsRegistry = new ControlRegistry(noFlowsArch);
            expect(() => noFlowsRegistry.processControls()).not.toThrow();
            expect(noFlowsRegistry.getControls()).toEqual([]);
        });

        it('deduplicates a control that appears in two nodes pointing at the same applied-to scope', async () => {
            // Reuse the test setup's controlled arch but invoke processControls twice
            // on the same instance — second pass exercises the isDuplicate / alreadyPresent branches.
            controlRegistry.processControls();
            controlRegistry.processControls();
            // 9 was the canonical count from the existing suite; duplicates should not have piled up.
            expect(controlRegistry.getControls()).toHaveLength(9);
            expect(controlRegistry.getControlRequirements()).toHaveLength(9);
        });
    });
});
