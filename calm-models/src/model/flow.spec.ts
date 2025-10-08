import { CalmFlow } from './flow';

describe('CalmFlow', () => {
    const minimalFlowSchema = {
        'unique-id': 'flow-456',
        'name': 'JSON Flow',
        'description': 'Flow created from JSON',
        'transitions': [
            {
                'relationship-unique-id': 'rel-1',
                'sequence-number': 1,
                'description': 'Transition 1'
            },
            {
                'relationship-unique-id': 'rel-2',
                'sequence-number': 2,
                'description': 'Transition 2'
            }
        ]
    };

    const fullFlowSchema = {
        'unique-id': 'flow-456',
        'name': 'JSON Flow',
        'description': 'Flow created from JSON',
        'transitions': [
            {
                'relationship-unique-id': 'rel-1',
                'sequence-number': 1,
                'description': 'Transition 1'
            },
            {
                'relationship-unique-id': 'rel-2',
                'sequence-number': 2,
                'description': 'Transition 2',
                'direction': 'destination-to-source'
            }
        ],
        'requirement-url': 'http://json.requirement.url',
        'controls': {
            'ctrl-1': {
                'description': 'JSON Control 1',
                'requirements': [
                    {
                        'requirement-url': 'https://calm.finos.org/release/1.0-rc2/prototype/authentication-control-requirement.json',
                        'config-url': 'https://calm.finos.org/release/1.0-rc2/prototype/authentication-control-config.json'
                    }
                ]
            }
        },
        'metadata': [{ 'key': 'value' }]
    };

    it('should create CalmFlow from minimal schema and verify toSchema and toCanonicalSchema', () => {
        const flow = CalmFlow.fromSchema(minimalFlowSchema);
        expect(flow.toSchema()).toEqual(minimalFlowSchema);
        const canonical = flow.toCanonicalSchema();
        expect(canonical['unique-id']).toBe('flow-456');
        expect(canonical.name).toBe('JSON Flow');
        expect(canonical.description).toBe('Flow created from JSON');
        expect(Array.isArray(canonical.transitions)).toBe(true);
        expect(canonical.transitions.length).toBe(2);
        expect(canonical.controls).toBeUndefined();
        expect(canonical.metadata).toBeUndefined();
    });

    it('should create CalmFlow from full schema and verify toSchema and toCanonicalSchema', () => {
        const flow = CalmFlow.fromSchema(fullFlowSchema);
        expect(flow.toSchema()).toEqual(fullFlowSchema);
        const canonical = flow.toCanonicalSchema();
        expect(canonical['unique-id']).toBe('flow-456');
        expect(canonical.name).toBe('JSON Flow');
        expect(canonical.description).toBe('Flow created from JSON');
        expect(Array.isArray(canonical.transitions)).toBe(true);
        expect(canonical.transitions.length).toBe(2);
        expect(canonical.controls).toBeDefined();
        expect(canonical.controls['ctrl-1'].description).toBe('JSON Control 1');
        expect(canonical.controls['ctrl-1'].requirements[0]['requirement-url']).toBe('https://calm.finos.org/release/1.0-rc2/prototype/authentication-control-requirement.json');
        expect(canonical.metadata).toBeDefined();
        expect(Array.isArray(canonical.metadata)).toBe(false); // Should be canonicalized
    });

    it('should handle a flow with no transitions', () => {
        const schema = {
            'unique-id': 'flow-empty',
            'name': 'Empty Flow',
            'description': 'No transitions',
            'transitions': []
        };
        const flow = CalmFlow.fromSchema(schema);
        expect(flow.toSchema()).toEqual(schema);
        const canonical = flow.toCanonicalSchema();
        expect(Array.isArray(canonical.transitions)).toBe(true);
        expect(canonical.transitions.length).toBe(0);
    });

    it('should handle a transition with missing direction', () => {
        const schema = {
            'unique-id': 'flow-dir',
            'name': 'Direction Flow',
            'description': 'Test direction default',
            'transitions': [
                {
                    'relationship-unique-id': 'rel-1',
                    'sequence-number': 1,
                    'description': 'Transition 1'
                }
            ]
        };
        const flow = CalmFlow.fromSchema(schema);
        expect(flow.toSchema()).toEqual(schema);
        const canonical = flow.toCanonicalSchema();
        expect(canonical.transitions[0].direction).toBe('source-to-destination');
    });

    it('should preserve originalJson', () => {
        const flow = CalmFlow.fromSchema(fullFlowSchema);
        expect(flow.originalJson).toEqual(fullFlowSchema);
    });
});
