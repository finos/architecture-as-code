import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parsePatternData } from './patternTransformer';
import { extractDecisionPoints, getVisibleNodeIds, DecisionSelections } from './decisionUtils';

/**
 * The visualiser half of the decision-agreement contract. See
 * `test_fixtures/decision-agreement/README.md` - `shared` asserts the same two things
 * against the same files, so a drift on either side fails a test.
 */

const FIXTURES = path.resolve(__dirname, '../../../../../../test_fixtures/decision-agreement');

interface Expected {
    decisions: {
        optionId: string;
        prompt: string;
        optionType: 'oneOf' | 'anyOf';
        choices: { description: string; nodes: string[]; relationships: string[] }[];
    }[];
    answered: { choose: Record<string, string>; nodes: string[] }[];
}

const read = (name: string, suffix: string) =>
    JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.${suffix}.json`), 'utf8'));

const cases = ['one-decision-one-catalog', 'two-decisions-one-catalog'];

describe.each(cases)('decision agreement: %s (visualiser side)', (name) => {
    const pattern = read(name, 'pattern');
    const expected: Expected = read(name, 'expected');

    /**
     * A decision box is identified by its prompt, not its group id. The id is an
     * implementation detail; the prompt is what the fixture and the user both see.
     */
    const pointsByPrompt = () => {
        const { nodes } = parsePatternData(pattern);
        const points = extractDecisionPoints(nodes);
        return { nodes, points };
    };

    it('draws exactly the expected decisions', () => {
        const { points } = pointsByPrompt();
        const actual = points
            .map((p) => ({
                prompt: p.prompt,
                optionType: p.decisionType,
                choices: p.choices.map((c) => ({
                    description: c.description,
                    nodes: c.nodes,
                    relationships: c.relationships,
                })),
            }))
            .sort((a, b) => a.prompt.localeCompare(b.prompt));

        const wanted = expected.decisions
            .map(({ prompt, optionType, choices }) => ({ prompt, optionType, choices }))
            .sort((a, b) => a.prompt.localeCompare(b.prompt));

        expect(actual).toEqual(wanted);
    });

    it.each(expected.answered)('shows the expected nodes for $choose', ({ choose, nodes: wanted }) => {
        const { nodes, points } = pointsByPrompt();

        const selections: DecisionSelections = new Map();
        Object.entries(choose).forEach(([optionId, description]) => {
            // The fixture names decisions by the holder's unique-id. The visualiser
            // keys them by group id, so match on the prompt the holder declares.
            const expectedDecision = expected.decisions.find((d) => d.optionId === optionId)!;
            const point = points.find((p) => p.prompt === expectedDecision.prompt);
            if (!point) throw new Error(`no decision box for "${expectedDecision.prompt}"`);
            const index = point.choices.findIndex((c) => c.description === description);
            if (index < 0) throw new Error(`no choice "${description}" on "${point.prompt}"`);
            selections.set(point.groupId, [index]);
        });

        const visible = getVisibleNodeIds(nodes, points, selections);
        expect(visible, 'no filter was applied').not.toBeNull();

        // Compare only real nodes. Box nodes are always visible and have no counterpart
        // in a generated architecture.
        const boxIds = new Set(nodes.filter((n) => n.type === 'group' || n.type === 'decisionGroup').map((n) => n.id));
        const actual = [...visible!].filter((id) => !boxIds.has(id)).sort();

        expect(actual).toEqual([...wanted].sort());
    });
});
