import { ControlRegistry } from './control-registry';
import { Architecture, CalmCore } from '../../model/core';
import { CalmControl } from '../../model/control';
import { CalmMetadata } from '../../model/metadata';
import { CalmNode } from '../../model/node';
import { CalmRelationship, CalmConnectsType } from '../../model/relationship';
import { CalmNodeInterface } from '../../model/interface';
import { CalmFlow, CalmFlowTransition } from '../../model/flow';
import {CalmControlsSchema} from '../../types/control-types';

describe('ControlRegistry', () => {
    let controlRegistry: ControlRegistry;
    let architecture: Architecture;

    beforeEach(() => {
        const controlSchema: CalmControlsSchema = {
            'node-control': {
                description: 'Node Control',
                requirements: [
                    {
                        'requirement-url': '/controls/requirement1',
                        'config': {
                            'control-id': 'config1',
                            'name': 'Config 1',
                            '$schema': 'schema1',
                            'description': 'Test config 1'
                        }
                    }
                ]
            },
            'relationship-control': {
                description: 'Relationship Control',
                requirements: [
                    {
                        'requirement-url': '/controls/requirement2',
                        'config': {
                            'control-id': 'config2',
                            'name': 'Config 2',
                            '$schema': 'schema2',
                            'description': 'Test config 2'
                        }
                    }
                ]
            },
            'flow-control': {
                description: 'Flow Control',
                requirements: [
                    {
                        'requirement-url': '/controls/requirement1',
                        'config-url': {
                            'control-id': 'config3',
                            'name': 'Config 3',
                            '$schema': 'schema3',
                            'description': 'Test config 3'
                        } as unknown as string  // simulate a dereferenced object, bypass typing
                    }
                ]
            }
        };

        const controls = CalmControl.fromJson(controlSchema);

        const nodeControl = controls.find(c => c.controlId === 'node-control')!;
        const relationshipControl = controls.find(c => c.controlId === 'relationship-control')!;
        const flowControl = controls.find(c => c.controlId === 'flow-control')!;

        const nodes = [
            new CalmNode(
                'node1',
                'service',
                'Node 1',
                'Test node 1',
                undefined,
                undefined,
                [nodeControl],
                new CalmMetadata({})
            )
        ];

        const relationships = [
            new CalmRelationship(
                'rel1',
                new CalmConnectsType(
                    new CalmNodeInterface('node1', []),
                    new CalmNodeInterface('node2', [])
                ),
                new CalmMetadata({}),
                [relationshipControl],
                'Test relationship'
            )
        ];

        const flows = [
            new CalmFlow(
                'flow1',
                'Flow 1',
                'Test flow',
                [
                    new CalmFlowTransition(
                        'rel1',
                        1,
                        'Test transition',
                        'source-to-destination'
                    )
                ],
                '',
                [flowControl],
                new CalmMetadata({})
            )
        ];

        architecture = new CalmCore(nodes, relationships, new CalmMetadata({}), [], flows, []);
        controlRegistry = new ControlRegistry(architecture);
    });


    describe('processControls', () => {
        it('should process controls from nodes, relationships, and flows', () => {
            controlRegistry.processControls();
            const controls = controlRegistry.getControls();
            const controlReqs = controlRegistry.getControlRequirements();
            expect(controls.length).toBe(3); // config1, config2
            expect(controlReqs.length).toBe(3); // requirement1, requirement2
        });
    });

    describe('getControls', () => {
        it('should return flattened list of controls', () => {
            controlRegistry.processControls();
            const controls = controlRegistry.getControls();

            expect(controls.length).toBe(3);

            const config1 = controls.find(control => control.id === 'config1');
            expect(config1).toBeDefined();
            expect(config1?.name).toBe('Config 1');
            expect(config1?.schema).toBe('schema1');
            expect(config1?.description).toBe('Test config 1');

            const config2 = controls.find(control => control.id === 'config2');
            expect(config2).toBeDefined();
            expect(config2?.name).toBe('Config 2');
            expect(config2?.schema).toBe('schema2');
            expect(config2?.description).toBe('Test config 2');
        });
    });

    describe('getControlRequirements', () => {
        it('should return flattened list of control requirements', () => {
            controlRegistry.processControls();

            const controlReqs = controlRegistry.getControlRequirements();

            expect(controlReqs.length).toBe(3);

            const req1 = controlReqs.find(req => req.id === 'requirement1');
            expect(req1).toBeDefined();
            expect(req1?.domain).toBeDefined();

            const req2 = controlReqs.find(req => req.id === 'requirement2');
            expect(req2).toBeDefined();
            expect(req2?.domain).toBeDefined();
        });
    });

    describe('getGroupedByDomainRequirements', () => {
        it('should return control requirements grouped by domain', () => {
            controlRegistry.processControls();

            const groupedReqs = controlRegistry.getGroupedByDomainRequirements();

            expect(Object.keys(groupedReqs).length).toBe(3);
            expect(groupedReqs['node-control']).toBeDefined();
            expect(groupedReqs['relationship-control']).toBeDefined();
            expect(groupedReqs['flow-control']).toBeDefined();
        });
    });

    describe('getGroupedByDomainConfigurations', () => {
        it('should return control configurations grouped by domain', () => {
            controlRegistry.processControls();

            const groupedConfigs = controlRegistry.getGroupedByDomainConfigurations();

            expect(Object.keys(groupedConfigs).length).toBe(3);
            expect(groupedConfigs['node-control']).toBeDefined();
            expect(groupedConfigs['relationship-control']).toBeDefined();
            expect(groupedConfigs['flow-control']).toBeDefined();
        });
    });
});
