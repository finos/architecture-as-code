import { CALMInstantiation } from '../../types';
import calmToDot from './calmToDot';

jest.mock('../helper.js', () => {
    return {
        initLogger: () => {
            return {
                info: jest.fn(),
                debug: jest.fn(),
                error: jest.fn()
            };
        }
    };
});

describe('calmToDot', () => {
    let calm: CALMInstantiation;

    beforeEach(() => {
        calm = {
            nodes: [
                {
                    'unique-id': 'node-1',
                    'name': 'Node 1',
                    'node-type': 'service',
                    'description': 'This is node 1'
                },
                {
                    'unique-id': 'node-2',
                    'name': 'Node 2',
                    'node-type': 'service',
                    'description': 'This is node 2'
                }
            ],
            relationships: [
                {
                    'uniqueId': 'relationship-1',
                    'description': 'test description',
                    'protocol': 'HTTPS',
                    'relationship-type': {
                        'connects': {
                            source: {
                                node: 'node-1'
                            },
                            destination: {
                                node: 'node-2'
                            }
                        }
                    }
                }
            ]
        };
    });

    it('creates a basic node', () => {
        const actualDot = calmToDot(calm);
        expect(actualDot).toContain('"node-1" [');
        expect(actualDot).toContain('label = "Node 1\\n\\nThis is node 1 "');
        expect(actualDot).toContain('shape = "box"');
    });

    it('creates a basic relationship', () => {
        const actualDot = calmToDot(calm);
        expect(actualDot).toContain('"node-1" -> "node-2" [');
        expect(actualDot).toContain('label = "test description\\n [HTTPS ]"');
    });

    it('creates an empty graph when given empty calm', () => {
        calm = { nodes: [], relationships: []};
        const actualDot = calmToDot(calm);
        expect(actualDot).toEqual('digraph {   layout = "fdp";   sep = "+80,50"; }');
    });

    it('creates a subgraph relationship', () => {
        calm = {
            ...calm,
            relationships: [
                {
                    'uniqueId': 'subtest',
                    'relationship-type': {
                        'deployed-in': {
                            container: 'node-1',
                            nodes: ['node-2']
                        }
                    }
                }
            ]
        };
        const actualDot = calmToDot(calm);
        expect(actualDot).toContain('subgraph "clusternode-1" {');
        expect(actualDot).toContain('label = "node-1"');
        expect(actualDot).toContain('"node-2" [');
    });
});