import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    select: vi.fn(),
    input: vi.fn(),
}));

vi.mock('@inquirer/prompts', () => ({
    select: mocks.select,
    input: mocks.input,
}));

import { promptForDocumentId } from './document-id-prompt';

/**
 * Drive the prompts in order. `select` answers are consumed in call order, as are `input` answers.
 */
function queueAnswers(selects: string[], inputs: (string | undefined)[]) {
    let s = 0;
    let i = 0;
    mocks.select.mockImplementation(async () => selects[s++]);
    mocks.input.mockImplementation(async (cfg: { default?: string }) => {
        const answer = inputs[i++];
        // Emulate inquirer returning the default when the user provides nothing (undefined).
        return answer ?? cfg.default ?? '';
    });
}

describe('promptForDocumentId', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('builds a namespace-resource $id from its components', async () => {
        // selects: scope, resource type. inputs: baseUrl, version, namespace, mapping
        queueAnswers(
            ['namespace', 'architectures'],
            ['https://hub.example.com', '1.2.3', 'finos', 'my-arch']
        );

        const result = await promptForDocumentId();

        expect(result).toEqual({
            id: 'https://hub.example.com/calm/namespaces/finos/architectures/my-arch/versions/1.2.3',
            namespace: 'finos',
            slug: 'my-arch',
        });
    });

    it('defaults the version to 1.0.0 and uses the baseUrl default when nothing is entered', async () => {
        // inputs for baseUrl and version are left empty so the defaults apply
        queueAnswers(
            ['namespace', 'patterns'],
            [undefined, undefined, 'finos', 'my-pattern']
        );

        const result = await promptForDocumentId({ baseUrlDefault: 'https://default.example.com' });

        expect(result.id).toBe('https://default.example.com/calm/namespaces/finos/patterns/my-pattern/versions/1.0.0');
    });

    it('strips a trailing slash from the base URL', async () => {
        queueAnswers(
            ['namespace', 'standards'],
            ['https://hub.example.com/', '1.0.0', 'finos', 'sec']
        );

        const result = await promptForDocumentId();

        expect(result.id).toBe('https://hub.example.com/calm/namespaces/finos/standards/sec/versions/1.0.0');
    });

    it('builds a control requirement $id', async () => {
        // selects: scope. inputs: baseUrl, version, domain, controlName
        queueAnswers(
            ['requirement'],
            ['https://hub.example.com', '1.0.0', 'security', 'access-control']
        );

        const result = await promptForDocumentId();

        expect(result).toEqual({
            id: 'https://hub.example.com/calm/domains/security/controls/access-control/requirement/versions/1.0.0',
            slug: 'access-control',
        });
    });

    it('builds a control configuration $id', async () => {
        // selects: scope. inputs: baseUrl, version, domain, controlName, configName
        queueAnswers(
            ['configuration'],
            ['https://hub.example.com', '1.0.0', 'security', 'access-control', 'prod']
        );

        const result = await promptForDocumentId();

        expect(result).toEqual({
            id: 'https://hub.example.com/calm/domains/security/controls/access-control/configurations/prod/versions/1.0.0',
            slug: 'prod',
        });
    });

    it('rejects empty and slash-containing segments via the input validator', async () => {
        queueAnswers(
            ['namespace', 'architectures'],
            ['https://hub.example.com', '1.0.0', 'finos', 'my-arch']
        );

        await promptForDocumentId();

        // The namespace/mapping prompts carry a validate fn; exercise it.
        const namespaceCall = mocks.input.mock.calls.find(([cfg]) => cfg.message === 'Namespace:');
        expect(namespaceCall).toBeDefined();
        const validate = namespaceCall![0].validate as (v: string) => true | string;
        expect(validate('ok')).toBe(true);
        expect(validate('')).toMatch(/cannot be empty/);
        expect(validate('a/b')).toMatch(/cannot contain/);
    });
});
