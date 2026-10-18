import { describe, it, expect } from 'vitest';
import { buildBuildingBlockDoc } from './building-block-doc';
import { makeControlMapKey } from '../../extension/services/control-curie';

describe('BuildingBlockCreator integration', () => {
    it('produces valid building block JSON via buildBuildingBlockDoc', () => {
        const { json, fileName } = buildBuildingBlockDoc({
            name: 'API Gateway',
            nodeType: 'service',
            description: 'Routes requests',
            controls: [],
        });
        const doc = JSON.parse(json);
        expect(fileName).toContain('api-gateway');
        expect(doc.nodes).toHaveLength(1);
        expect(doc.nodes[0].name).toBe('API Gateway');
        expect(doc.nodes[0]['node-type']).toBe('service');
    });

    it('includes controls in building block', () => {
        const { json } = buildBuildingBlockDoc({
            name: 'Secure Service',
            nodeType: 'service',
            description: 'A secured service',
            controls: [
                { ref: 'platform:controls:encryption', parsed: { identity: { controlId: 'encryption', name: 'Encryption' }, properties: {} } },
            ],
        });
        const doc = JSON.parse(json);
        const node = doc.nodes[0];
        expect(node.controls).toBeDefined();
    });

    it('deduplicates controls by makeControlMapKey', () => {
        const controls = [
            { ref: 'platform:controls:encryption', parsed: { identity: { controlId: 'encryption', name: 'Encryption' }, properties: {} } },
        ];
        const existingKeys = new Set(controls.map(c => makeControlMapKey(c.ref)));

        const newRef = 'platform:controls:encryption';
        const newKey = makeControlMapKey(newRef);
        const isDuplicate = existingKeys.has(newKey);
        expect(isDuplicate).toBe(true);

        const differentRef = 'platform:controls:logging';
        const differentKey = makeControlMapKey(differentRef);
        expect(existingKeys.has(differentKey)).toBe(false);
    });
});
