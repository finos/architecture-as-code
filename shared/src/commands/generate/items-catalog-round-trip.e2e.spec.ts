import { describe, it, expect, vi } from 'vitest';
import { selectChoices, extractOptions, CalmChoice } from './components/options';
import { instantiate } from './components/instantiate';
import { validate } from '../validate/validate';
import { SchemaDirectory } from '../../schema-directory';

/**
 * Round-trip baseline for `items` catalog decisions: generate, then validate the result
 * against the same pattern, through the real functions each side actually uses - not just
 * unit-level assertions on one function in isolation. No control requirements, so this is
 * unaffected by the separate, pre-existing conference-signup round-trip gap (see #2932
 * follow-up tracking).
 */

vi.mock('../../schema-directory', () => ({
    SchemaDirectory: vi.fn(function () {
        return { loadSchemas: vi.fn(), loadCurrentPatternAsSchema: vi.fn(), getDefinition: vi.fn() };
    }),
}));

function node(uniqueId: string) {
    return {
        type: 'object',
        properties: {
            'unique-id': { const: uniqueId },
            name: { const: uniqueId },
            'node-type': { const: 'service' },
        },
        required: ['unique-id', 'name', 'node-type'],
    };
}

function connects(id: string, source: string, destination: string) {
    return {
        type: 'object',
        properties: {
            'unique-id': { const: id },
            description: { const: `${source} to ${destination}` },
            'relationship-type': {
                const: { connects: { source: { node: source }, destination: { node: destination } } },
            },
        },
        required: ['unique-id', 'description', 'relationship-type'],
    };
}

function choice(description: string, nodeId: string, relationshipId: string) {
    return {
        type: 'object',
        properties: {
            description: { const: description },
            nodes: { const: [nodeId] },
            relationships: { const: [relationshipId] },
        },
    };
}

const pattern = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'items-catalog-round-trip-pattern',
    properties: {
        nodes: {
            type: 'array',
            prefixItems: [node('webapp')],
            items: { anyOf: [node('candidate-a'), node('candidate-b')] },
        },
        relationships: {
            type: 'array',
            prefixItems: [
                {
                    type: 'object',
                    properties: {
                        'unique-id': { const: 'catalog-choice' },
                        description: { const: 'Which optional components?' },
                        'relationship-type': {
                            type: 'object',
                            properties: {
                                options: {
                                    type: 'array',
                                    prefixItems: [
                                        {
                                            anyOf: [
                                                choice('Use Candidate A', 'candidate-a', 'webapp-to-a'),
                                                choice('Use Candidate B', 'candidate-b', 'webapp-to-b'),
                                            ],
                                        },
                                    ],
                                },
                            },
                        },
                    },
                },
            ],
            items: { anyOf: [connects('webapp-to-a', 'webapp', 'candidate-a'), connects('webapp-to-b', 'webapp', 'candidate-b')] },
        },
    },
};

async function generateAndValidate(choices: CalmChoice[]) {
    const selected = selectChoices(pattern, choices, false);
    const architecture = await instantiate(selected, false, new SchemaDirectory({} as never)) as {
        nodes: Array<Record<string, unknown>>;
        relationships: Array<Record<string, unknown>>;
    };
    const response = await validate(architecture, pattern, undefined, new SchemaDirectory({} as never), false);
    return { architecture, response };
}

describe('items-catalog round trip (baseline)', () => {
    it('succeeds when two candidates are selected and both validate cleanly', async () => {
        const options = extractOptions(pattern);
        const chosen = options[0].choices; // both choices for the one anyOf decision
        const { response } = await generateAndValidate(chosen);

        expect(response.hasErrors).toBe(false);
    });

    it('does not crash and produces a valid empty selection when zero candidates are chosen', async () => {
        const { response } = await generateAndValidate([]);

        expect(response.hasErrors).toBe(false);
    });

    it('catches a corruption on the second selection, not just the first', async () => {
        const options = extractOptions(pattern);
        const chosen = options[0].choices;
        const { architecture } = await generateAndValidate(chosen);

        // Corrupt the second selected node's const-constrained field.
        const secondNode = architecture.nodes.find((n) => n['unique-id'] === 'candidate-b') as Record<string, unknown>;
        expect(secondNode).toBeDefined();
        secondNode['node-type'] = 'not-a-valid-value';

        const response = await validate(architecture, pattern, undefined, new SchemaDirectory({} as never), false);

        expect(response.hasErrors).toBe(true);
        expect(response.jsonSchemaValidationOutputs).toContainEqual(
            expect.objectContaining({ path: '/nodes/2/node-type' })
        );
    });
});
