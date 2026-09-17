import { asContext } from '../spectral-test-helpers';
import nodeIdExists from './node-id-exists';

function contextFor(nodes: object) {
    return {
        document: { data: { properties: { nodes } } },
        path: ['properties', 'relationships']
    };
}

const node = (id: string) => ({ 'properties': { 'unique-id': { 'const': id } } });

describe('nodeIdExists', () => {
    it('should return an empty array when there is no input', () => {
        const result = nodeIdExists(null, null, asContext(contextFor({})));
        expect(result).toEqual([]);
    });

    it('should return an empty array when the input is not a string', () => {
        const result = nodeIdExists({}, null, asContext(contextFor({})));
        expect(result).toEqual([]);
    });

    it('should accept a node declared as a bare prefixItems entry', () => {
        const result = nodeIdExists('webapp', null, asContext(contextFor({ prefixItems: [node('webapp')] })));
        expect(result).toEqual([]);
    });

    it('should accept a node declared as a oneOf alternative', () => {
        const nodes = { prefixItems: [{ 'oneOf': [node('cache'), node('queue')] }] };
        const result = nodeIdExists('queue', null, asContext(contextFor(nodes)));
        expect(result).toEqual([]);
    });

    it('should accept a node declared as an anyOf alternative', () => {
        const nodes = { prefixItems: [{ 'anyOf': [node('cache'), node('queue')] }] };
        const result = nodeIdExists('queue', null, asContext(contextFor(nodes)));
        expect(result).toEqual([]);
    });




    it('should return a message when the node does not exist', () => {
        const nodes = { prefixItems: [node('webapp'), { 'oneOf': [node('cache')] }] };
        const result = nodeIdExists('typo', null, asContext(contextFor(nodes)));
        expect(result.length).toBe(1);
        expect(result[0].message).toEqual('\'typo\' does not refer to the unique-id of an existing node.');
    });
});
