import { CalmFlow, CalmFlowTransition } from './flow.js';
import { CalmControl } from './control.js';
import { CalmMetadata } from './metadata.js';
import {CalmFlowSchema} from '../types/flow-types.js';

describe('CalmFlow', () => {
    it('should create an instance with given properties', () => {
        const transitions = [
            new CalmFlowTransition('rel-1', 1, 'First transition'),
            new CalmFlowTransition('rel-2', 2, 'Second transition', 'destination-to-source')
        ];

        const controls = [
            new CalmControl('ctrl-1', 'Test Control 1', []),
            new CalmControl('ctrl-2', 'Test Control 2', [])
        ];

        const metadata = new CalmMetadata({ key: 'value' });

        const flow = new CalmFlow('flow-123', 'Test Flow', 'A test description', transitions, 'http://requirement.url', controls, metadata);

        expect(flow.uniqueId).toBe('flow-123');
        expect(flow.name).toBe('Test Flow');
        expect(flow.description).toBe('A test description');
        expect(flow.transitions).toHaveLength(2);
        expect(flow.transitions[0]).toBeInstanceOf(CalmFlowTransition);
        expect(flow.controls).toBeDefined();
        expect(flow.controls).toHaveLength(2);
        expect(flow.metadata).toBeInstanceOf(CalmMetadata);
    });

    it('should create an instance from JSON data', () => {
        const jsonData: CalmFlowSchema = {
            'unique-id': 'flow-456',
            'name': 'JSON Flow',
            'description': 'Flow created from JSON',
            'transitions': [
                {
                    'relationship-unique-id': 'rel-1',
                    'sequence-number': 1,
                    'summary': 'Transition 1'
                },
                {
                    'relationship-unique-id': 'rel-2',
                    'sequence-number': 2,
                    'summary': 'Transition 2',
                    'direction': 'destination-to-source' // Explicitly providing direction
                }
            ],
            'requirement-url': 'http://json.requirement.url',
            'controls': {
                'ctrl-1': { 'description': 'JSON Control 1', 'requirements': [] }
            },
            'metadata': [{ 'key': 'value' }]
        };

        const flow = CalmFlow.fromJson(jsonData);


        expect(flow).toBeInstanceOf(CalmFlow);
        expect(flow.uniqueId).toBe('flow-456');
        expect(flow.name).toBe('JSON Flow');
        expect(flow.description).toBe('Flow created from JSON');
        expect(flow.transitions).toHaveLength(2);
        expect(flow.transitions[0]).toBeInstanceOf(CalmFlowTransition);
        expect(flow.controls).toBeDefined();
        expect(flow.controls[0].controlId).toBe('ctrl-1');
        expect(flow.controls[0].description).toBe('JSON Control 1');
        expect(flow.metadata).toBeDefined();
    });

});
