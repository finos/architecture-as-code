import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { instantiate } from './instantiate';
import { extractOptions, selectChoices, CalmChoice } from './options';
import { SchemaDirectory } from '../../../schema-directory';

/**
 * The generation half of the decision-agreement contract. See
 * `test_fixtures/decision-agreement/README.md` - the visualiser asserts the same two
 * things against the same files, so a drift on either side fails a test.
 */

vi.mock('fs', async () => {
    const actual = await vi.importActual<typeof import('fs')>('fs');
    return { ...actual, default: actual };
});

vi.mock('../../../logger', () => ({
    initLogger: vi.fn(() => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }))
}));

const schemaDirMocks = vi.hoisted(() => ({
    loadSchemas: vi.fn(),
    loadCurrentPatternAsSchema: vi.fn(),
    getDefinition: vi.fn()
}));

vi.mock('../../../schema-directory', () => ({
    SchemaDirectory: vi.fn(function () {
        return {
            loadSchemas: schemaDirMocks.loadSchemas,
            loadCurrentPatternAsSchema: schemaDirMocks.loadCurrentPatternAsSchema,
            getDefinition: schemaDirMocks.getDefinition
        };
    }),
}));

const FIXTURES = path.resolve(__dirname, '../../../../../test_fixtures/decision-agreement');

interface ExpectedDecision {
    optionId: string;
    prompt: string;
    optionType: 'oneOf' | 'anyOf';
    choices: { description: string; nodes: string[]; relationships: string[] }[];
}
interface Expected {
    decisions: ExpectedDecision[];
    answered: { choose: Record<string, string>; nodes: string[] }[];
}

const read = (name: string, suffix: string) =>
    JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.${suffix}.json`), 'utf8'));

const cases = ['one-decision-one-catalog', 'two-decisions-one-catalog'];

describe.each(cases)('decision agreement: %s (generation side)', (name) => {
    const pattern = read(name, 'pattern');
    const expected: Expected = read(name, 'expected');

    it('offers exactly the expected decisions', () => {
        const actual = extractOptions(pattern).map((o) => ({
            optionId: o.optionId,
            prompt: o.prompt,
            optionType: o.optionType,
            choices: o.choices.map((c) => ({
                description: c.description,
                nodes: c.nodes,
                relationships: c.relationships,
            })),
        }));
        expect(actual).toEqual(expected.decisions);
    });

    it.each(expected.answered)('produces the expected nodes for $choose', async ({ choose, nodes }) => {
        const options = extractOptions(pattern);
        const chosen: CalmChoice[] = Object.entries(choose).map(([optionId, description]) => {
            const option = options.find((o) => o.optionId === optionId);
            const choice = option?.choices.find((c) => c.description === description);
            if (!choice) throw new Error(`fixture names a choice that does not exist: ${optionId} / ${description}`);
            return choice;
        });

        const selected = selectChoices(pattern, chosen);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const arch = await instantiate(selected, false, new SchemaDirectory({} as any)) as unknown as {
            nodes: Record<string, unknown>[];
        };
        expect(arch.nodes.map((n) => n['unique-id']).sort()).toEqual([...nodes].sort());
    });
});
