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



});
