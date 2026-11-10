import { describe, it, expect } from 'vitest';
import { buildStandardNodeDoc } from './standard-node-doc';
import { makeControlMapKey } from '../../extension/services/control-curie';

describe('StandardNodeCreator integration', () => {
    it('produces valid standard node JSON via buildStandardNodeDoc', () => {
        const { json, fileName } = buildStandardNodeDoc({
            name: 'API Gateway',
            nodeType: 'service',
            description: 'Routes requests',
            controls: [],
        });
        const doc = JSON.parse(json);
        expect(fileName).toBe('api-gateway.json');
        expect(doc.default).toBeDefined();
        expect(doc.default.name).toBe('API Gateway');
        expect(doc.default['node-type']).toBe('service');
    });

    it('includes controls in standard node', () => {
        const { json } = buildStandardNodeDoc({
            name: 'Secure Service',
            nodeType: 'service',
            description: 'A secured service',
            controls: [
                { ref: 'platform:controls:encryption', parsed: { identity: { controlId: 'encryption', name: 'Encryption' }, properties: {} } },
            ],
        });
        const doc = JSON.parse(json);
        const node = doc.default;
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
