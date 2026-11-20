import { afterEach, describe, expect, it } from 'vitest';
import { flowToCalm, setLastParsedArch, type CalmArchitecture } from './calm-editor-transformer';
import { parseCALMData } from './calm-parser';

const nodes = ['a', 'b'].map((id) => ({ 'unique-id': id, 'node-type': 'service', name: id, description: '' }));
const connects = (id: string, source: string, destination: string, metadata?: unknown) => ({
    'unique-id': id,
    'relationship-type': { connects: { source: { node: source }, destination: { node: destination } } },
    ...(metadata === undefined ? {} : { metadata }),
});

afterEach(() => setLastParsedArch(null));

describe('relationship metadata across the feature composition merge', () => {
    it.each(['none', 'target-to-source'])('keeps array metadata, handles, and %s direction after an unrelated node edit', (direction) => {
        const original = {
            nodes,
            relationships: [connects('ab', 'a', 'b', [
                { owner: 'team' },
                { 'source-handle': 'right-source', 'target-handle': 'left-target', direction, routing: 'smoothstep' },
            ])],
        };
        setLastParsedArch(original);
        const parsed = parseCALMData(original);
        expect(parsed.edges[0]).toMatchObject({
            sourceHandle: 'right-source', targetHandle: 'left-target',
            data: { direction, routing: 'smoothstep' },
        });
        parsed.nodes[0].data.label = 'renamed';
        expect(flowToCalm(parsed.nodes, parsed.edges).relationships).toEqual(original.relationships);
    });

    it('does not save the render-only handle used to separate distinct reverse relationships', () => {
        const original = {
            nodes,
            relationships: [
                { ...connects('ab', 'a', 'b'), description: 'request' },
                { ...connects('ba', 'b', 'a'), description: 'response' },
            ],
        };
        setLastParsedArch(original);
        const parsed = parseCALMData(original);
        expect(parsed.edges).toHaveLength(2);
        expect(parsed.edges[1].targetHandle).toBe('left-target');
        expect(flowToCalm(parsed.nodes, parsed.edges).relationships).toEqual(original.relationships);
        parsed.edges[1].targetHandle = 'right-target';
        expect(flowToCalm(parsed.nodes, parsed.edges).relationships?.[1].metadata).toEqual({ 'target-handle': 'right-target' });
    });

    it('keeps reverse relationships separate when their saved handles differ', () => {
        const original: CalmArchitecture = {
            nodes,
            relationships: [
                connects('ab', 'a', 'b', { 'source-handle': 'right-source' }),
                connects('ba', 'b', 'a', { 'source-handle': 'left-source' }),
            ],
        };
        setLastParsedArch(original);
        const parsed = parseCALMData(original);
        expect(parsed.edges).toHaveLength(2);
        expect(flowToCalm(parsed.nodes, parsed.edges).relationships).toEqual(original.relationships);
    });
});
