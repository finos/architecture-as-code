import {CalmParser} from './parser.js';
import {CalmCore} from '../model/core.js';
import {CalmConnectsType, CalmInteractsType} from '../model/relationship.js';

describe('CalmParser Integration Tests verifying traderx example and model fromJson', () => {
    let calmCore: CalmCore;
    let calmParser: CalmParser;

    beforeAll(async () => {
        calmParser = new CalmParser();
        calmCore = calmParser.parse('../calm/samples/2024-12/traderx/traderx.json');
    });

    test('should parse nodes correctly', () => {
        expect(calmCore.nodes).toBeDefined();
        expect(Array.isArray(calmCore.nodes)).toBe(true);
        expect(calmCore.nodes.length).toBe(14);

        const firstNode = calmCore.nodes[0];
        expect(firstNode.uniqueId).toBe('traderx-system');
        expect(firstNode.nodeType).toBe('system');
        expect(firstNode.name).toBe('TraderX');
        expect(firstNode.description).toBe('Simple Trading System');
    });

    test('should parse interacts relationships correctly and cast to InteractsType', () => {
        const interactsRel = calmCore.relationships.find(
            (r) => r.uniqueId === 'trader-executes-trades'
        );
        expect(interactsRel).toBeDefined();
        expect(interactsRel.description).toBe('Executes Trades');

        const interactsType = interactsRel.relationshipType as CalmInteractsType;
        expect(interactsType.actor).toBe('traderx-trader');
        expect(Array.isArray(interactsType.nodes)).toBe(true);
        expect(interactsType.nodes).toContain('web-client');
    });

    test('should parse connects relationships correctly and cast to ConnectsType', () => {
        const connectsRel = calmCore.relationships.find(
            (r) => r.uniqueId === 'web-client-uses-web-gui'
        );
        expect(connectsRel).toBeDefined();
        expect(connectsRel.protocol).toBe('HTTPS');

        const connectsType = connectsRel.relationshipType as CalmConnectsType;
        expect(connectsType.source.node).toBe('web-client');
        expect(connectsType.destination.node).toBe('web-gui-process');
    });

});
