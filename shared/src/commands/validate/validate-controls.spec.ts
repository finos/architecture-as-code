import { validateAllControls } from './validate-controls';
import { SchemaDirectory } from '../../schema-directory';

const mocks = vi.hoisted(() => ({
    jsonSchemaValidate: vi.fn().mockReturnValue([]),
    jsonSchemaValidatorConstructor: vi.fn().mockImplementation(function () {
        return {
            validate: mocks.jsonSchemaValidate,
            initialize: vi.fn().mockResolvedValue(undefined),
        };
    })
}));

vi.mock('./json-schema-validator', () => ({
    JsonSchemaValidator: mocks.jsonSchemaValidatorConstructor
}));

vi.mock('../../logger.js', () => ({
    initLogger: () => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    })
}));

const requirementSchema = {
    $id: 'https://example.com/requirement.json',
    type: 'object',
    required: ['control-id', 'name'],
    properties: {
        'control-id': { type: 'string' },
        name: { type: 'string' }
    }
};

function makeSchemaDirectory(getSchemaResult: object | undefined = requirementSchema): SchemaDirectory {
    return {
        getSchema: vi.fn().mockResolvedValue(getSchemaResult),
        loadDocument: vi.fn(),
        fork: vi.fn(),
        loadSchemas: vi.fn(),
        storeDocument: vi.fn(),
        getLoadedSchemas: vi.fn().mockReturnValue([]),
    } as unknown as SchemaDirectory;
}

const inlineConfig = { 'control-id': 'sec-001', name: 'Security Control' };

function architectureWithNodeControl(config?: object, requirementUrl = 'https://example.com/requirement.json') {
    const requirement: Record<string, unknown> = { 'requirement-url': requirementUrl };
    if (config !== undefined) {
        requirement['config'] = config;
    }
    return {
        nodes: [{
            'unique-id': 'node-1',
            'node-type': 'service',
            name: 'Node 1',
            description: 'Test node',
            controls: {
                security: {
                    description: 'Security controls',
                    requirements: [requirement]
                }
            }
        }]
    };
}

describe('validateAllControls', () => {
    beforeEach(() => {
        mocks.jsonSchemaValidate.mockReturnValue([]);
        mocks.jsonSchemaValidatorConstructor.mockClear();
    });

    it('returns empty outputs when architecture has no controls', async () => {
        const arch = { nodes: [{ 'unique-id': 'n1', 'node-type': 'service', name: 'N', description: 'D' }] };
        const result = await validateAllControls(arch, undefined, makeSchemaDirectory(), false);
        expect(result.jsonSchemaOutputs).toHaveLength(0);
        expect(result.hasErrors).toBe(false);
        expect(result.hasWarnings).toBe(false);
    });

    it('validates node control with valid inline config and emits no errors', async () => {
        const arch = architectureWithNodeControl(inlineConfig);
        const result = await validateAllControls(arch, undefined, makeSchemaDirectory(), false);
        expect(result.hasErrors).toBe(false);
        expect(result.jsonSchemaOutputs).toHaveLength(0);
        expect(mocks.jsonSchemaValidatorConstructor).toHaveBeenCalledOnce();
    });

    it('emits errors with correct path when node control config is invalid', async () => {
        mocks.jsonSchemaValidate.mockReturnValue([{
            instancePath: '/name',
            schemaPath: '#/properties/name/type',
            keyword: 'type',
            params: {},
            message: 'must be string'
        }]);
        const arch = architectureWithNodeControl({ 'control-id': 'sec-001', name: 42 });
        const result = await validateAllControls(arch, undefined, makeSchemaDirectory(), false);
        expect(result.hasErrors).toBe(true);
        expect(result.jsonSchemaOutputs).toHaveLength(1);
        expect(result.jsonSchemaOutputs[0].path).toBe('/nodes/0/controls/security/requirements/0/name');
    });

    it('uses controlPath as path when instancePath is empty (root error)', async () => {
        mocks.jsonSchemaValidate.mockReturnValue([{
            instancePath: '',
            schemaPath: '#/required',
            keyword: 'required',
            params: { missingProperty: 'name' },
            message: 'must have required property \'name\''
        }]);
        const arch = architectureWithNodeControl({ 'control-id': 'sec-001' });
        const result = await validateAllControls(arch, undefined, makeSchemaDirectory(), false);
        expect(result.jsonSchemaOutputs[0].path).toBe('/nodes/0/controls/security/requirements/0');
    });

    it('assigns correct path prefix for relationship controls', async () => {
        mocks.jsonSchemaValidate.mockReturnValue([{
            instancePath: '',
            schemaPath: '#/required',
            keyword: 'required',
            params: {},
            message: 'missing required'
        }]);
        const arch = {
            relationships: [{
                'unique-id': 'rel-1',
                'relationship-type': { connects: { source: { node: 'a' }, destination: { node: 'b' } } },
                controls: {
                    auth: {
                        description: 'Auth controls',
                        requirements: [{ 'requirement-url': 'https://example.com/requirement.json', config: { 'control-id': 'auth-001', name: 'Auth' } }]
                    }
                }
            }]
        };
        const result = await validateAllControls(arch, undefined, makeSchemaDirectory(), false);
        expect(result.jsonSchemaOutputs[0].path).toBe('/relationships/0/controls/auth/requirements/0');
    });

    it('assigns correct path prefix for flow controls', async () => {
        mocks.jsonSchemaValidate.mockReturnValue([{
            instancePath: '',
            schemaPath: '#/required',
            keyword: 'required',
            params: {},
            message: 'missing required'
        }]);
        const arch = {
            flows: [{
                'unique-id': 'flow-1',
                name: 'Flow',
                description: 'A flow',
                transitions: [],
                controls: {
                    data: {
                        description: 'Data controls',
                        requirements: [{ 'requirement-url': 'https://example.com/requirement.json', config: { 'control-id': 'd-001', name: 'Data' } }]
                    }
                }
            }]
        };
        const result = await validateAllControls(arch, undefined, makeSchemaDirectory(), false);
        expect(result.jsonSchemaOutputs[0].path).toBe('/flows/0/controls/data/requirements/0');
    });

    it('assigns correct path prefix for top-level controls', async () => {
        mocks.jsonSchemaValidate.mockReturnValue([{
            instancePath: '',
            schemaPath: '#/required',
            keyword: 'required',
            params: {},
            message: 'missing required'
        }]);
        const arch = {
            controls: {
                global: {
                    description: 'Global controls',
                    requirements: [{ 'requirement-url': 'https://example.com/requirement.json', config: { 'control-id': 'g-001', name: 'Global' } }]
                }
            }
        };
        const result = await validateAllControls(arch, undefined, makeSchemaDirectory(), false);
        expect(result.jsonSchemaOutputs[0].path).toBe('/controls/global/requirements/0');
    });

    it('resolves requirement-url starting with # as JSON pointer into pattern', async () => {
        const pattern = {
            defs: {
                myRequirement: requirementSchema
            }
        };
        const arch = architectureWithNodeControl(inlineConfig, '#/defs/myRequirement');
        const result = await validateAllControls(arch, pattern, makeSchemaDirectory(), false);
        expect(result.hasErrors).toBe(false);
        // JsonSchemaValidator should have been called with the resolved requirement schema
        expect(mocks.jsonSchemaValidatorConstructor).toHaveBeenCalledWith(
            expect.anything(),
            requirementSchema,
            false
        );
    });

    it('emits error when requirement-url is JSON pointer but pattern is undefined', async () => {
        const arch = architectureWithNodeControl(inlineConfig, '#/defs/myRequirement');
        const result = await validateAllControls(arch, undefined, makeSchemaDirectory(), false);
        expect(result.hasErrors).toBe(true);
        expect(result.jsonSchemaOutputs[0].code).toBe('control-requirement-validation');
        expect(result.jsonSchemaOutputs[0].message).toContain('JSON pointer');
        expect(mocks.jsonSchemaValidatorConstructor).not.toHaveBeenCalled();
    });

    it('emits error when JSON pointer path does not exist in pattern', async () => {
        const pattern = { defs: {} };
        const arch = architectureWithNodeControl(inlineConfig, '#/defs/nonExistent');
        const result = await validateAllControls(arch, pattern, makeSchemaDirectory(), false);
        expect(result.hasErrors).toBe(true);
        expect(result.jsonSchemaOutputs[0].message).toContain('Could not resolve');
    });

    it('loads config via getSchema when config-url is present', async () => {
        const schemaDir = makeSchemaDirectory(requirementSchema);
        (schemaDir.getSchema as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(requirementSchema)   // first call: requirement schema
            .mockResolvedValueOnce(inlineConfig);        // second call: config doc

        const arch = {
            nodes: [{
                'unique-id': 'node-1',
                'node-type': 'service',
                name: 'N',
                description: 'D',
                controls: {
                    security: {
                        description: 'Security',
                        requirements: [{
                            'requirement-url': 'https://example.com/requirement.json',
                            'config-url': 'https://example.com/config.json'
                        }]
                    }
                }
            }]
        };
        const result = await validateAllControls(arch, undefined, schemaDir, false);
        expect(result.hasErrors).toBe(false);
        expect(schemaDir.getSchema).toHaveBeenCalledWith('https://example.com/config.json');
    });

    it('skips control detail when neither config nor config-url is present', async () => {
        const arch = {
            nodes: [{
                'unique-id': 'node-1',
                'node-type': 'service',
                name: 'N',
                description: 'D',
                controls: {
                    security: {
                        description: 'Security',
                        requirements: [{ 'requirement-url': 'https://example.com/requirement.json' }]
                    }
                }
            }]
        };
        const result = await validateAllControls(arch, undefined, makeSchemaDirectory(), false);
        expect(result.hasErrors).toBe(false);
        expect(mocks.jsonSchemaValidatorConstructor).not.toHaveBeenCalled();
    });

    it('emits error when requirement schema cannot be loaded', async () => {
        const schemaDir = makeSchemaDirectory();
        (schemaDir.getSchema as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
        const arch = architectureWithNodeControl(inlineConfig);
        const result = await validateAllControls(arch, undefined, schemaDir, false);
        expect(result.hasErrors).toBe(true);
        expect(result.jsonSchemaOutputs[0].code).toBe('control-requirement-validation');
        expect(result.jsonSchemaOutputs[0].message).toContain('not found');
    });

    it('emits warning when architecture contains legacy control-requirement-url naming', async () => {
        const arch = {
            nodes: [{
                'unique-id': 'node-1',
                'node-type': 'service',
                name: 'N',
                description: 'D',
                controls: {
                    security: {
                        description: 'Security',
                        requirements: [{
                            'control-requirement-url': 'https://example.com/requirement.json',
                            'control-config-url': 'https://example.com/config.json'
                        }]
                    }
                }
            }]
        };
        const result = await validateAllControls(arch, undefined, makeSchemaDirectory(), false);
        expect(result.hasWarnings).toBe(true);
        const warning = result.jsonSchemaOutputs.find(o => o.code === 'control-legacy-naming');
        expect(warning).toBeDefined();
        expect(warning?.severity).toBe('warning');
    });

    it('emits error when getSchema throws for requirement-url', async () => {
        const schemaDir = makeSchemaDirectory();
        (schemaDir.getSchema as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network error'));
        const arch = architectureWithNodeControl(inlineConfig);
        const result = await validateAllControls(arch, undefined, schemaDir, false);
        expect(result.hasErrors).toBe(true);
        expect(result.jsonSchemaOutputs[0].message).toContain('network error');
    });

    it('returns no outputs when architecture cannot be parsed as CalmCore', async () => {
        const result = await validateAllControls(null as unknown as object, undefined, makeSchemaDirectory(), false);
        expect(result.jsonSchemaOutputs).toHaveLength(0);
        expect(result.hasErrors).toBe(false);
        expect(result.hasWarnings).toBe(false);
        expect(mocks.jsonSchemaValidatorConstructor).not.toHaveBeenCalled();
    });

    it('skips validation when in-pattern JSON pointer resolves to an undefined schema', async () => {
        const pattern = { defs: { myRequirement: undefined } };
        const arch = architectureWithNodeControl(inlineConfig, '#/defs/myRequirement');
        const result = await validateAllControls(arch, pattern, makeSchemaDirectory(), false);
        expect(result.hasErrors).toBe(false);
        expect(result.jsonSchemaOutputs).toHaveLength(0);
        expect(mocks.jsonSchemaValidatorConstructor).not.toHaveBeenCalled();
    });

    it('emits error when config-url document fails to load', async () => {
        const schemaDir = makeSchemaDirectory();
        (schemaDir.getSchema as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(requirementSchema)                 // requirement schema
            .mockRejectedValueOnce(new Error('config fetch failed')); // config-url
        const arch = {
            nodes: [{
                'unique-id': 'node-1', 'node-type': 'service', name: 'N', description: 'D',
                controls: {
                    security: {
                        description: 'Security',
                        requirements: [{
                            'requirement-url': 'https://example.com/requirement.json',
                            'config-url': 'https://example.com/config.json'
                        }]
                    }
                }
            }]
        };
        const result = await validateAllControls(arch, undefined, schemaDir, false);
        expect(result.hasErrors).toBe(true);
        expect(result.jsonSchemaOutputs[0].message).toContain('config fetch failed');
        expect(mocks.jsonSchemaValidatorConstructor).not.toHaveBeenCalled();
    });

    it('skips validation when config-url document is not found', async () => {
        const schemaDir = makeSchemaDirectory();
        (schemaDir.getSchema as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(requirementSchema)  // requirement schema
            .mockResolvedValueOnce(undefined);         // config-url -> not found
        const arch = {
            nodes: [{
                'unique-id': 'node-1', 'node-type': 'service', name: 'N', description: 'D',
                controls: {
                    security: {
                        description: 'Security',
                        requirements: [{
                            'requirement-url': 'https://example.com/requirement.json',
                            'config-url': 'https://example.com/missing-config.json'
                        }]
                    }
                }
            }]
        };
        const result = await validateAllControls(arch, undefined, schemaDir, false);
        expect(result.hasErrors).toBe(false);
        expect(result.jsonSchemaOutputs).toHaveLength(0);
        expect(mocks.jsonSchemaValidatorConstructor).not.toHaveBeenCalled();
    });

    it('emits error when the requirement schema cannot be compiled', async () => {
        mocks.jsonSchemaValidatorConstructor.mockImplementationOnce(function () {
            return {
                validate: mocks.jsonSchemaValidate,
                initialize: vi.fn().mockRejectedValue(new Error('invalid schema'))
            };
        });
        const arch = architectureWithNodeControl(inlineConfig);
        const result = await validateAllControls(arch, undefined, makeSchemaDirectory(), false);
        expect(result.hasErrors).toBe(true);
        expect(result.jsonSchemaOutputs[0].message).toContain('Could not compile');
        expect(result.jsonSchemaOutputs[0].message).toContain('invalid schema');
    });

    it('ignores relationships and flows that have no controls', async () => {
        const arch = {
            nodes: [{ 'unique-id': 'n1', 'node-type': 'service', name: 'N', description: 'D' }],
            relationships: [{
                'unique-id': 'rel-1',
                'relationship-type': { connects: { source: { node: 'a' }, destination: { node: 'b' } } }
            }],
            flows: [{ 'unique-id': 'flow-1', name: 'Flow', description: 'A flow', transitions: [] }]
        };
        const result = await validateAllControls(arch, undefined, makeSchemaDirectory(), false);
        expect(result.jsonSchemaOutputs).toHaveLength(0);
        expect(result.hasErrors).toBe(false);
    });

    it('handles validation errors with missing instancePath and message', async () => {
        mocks.jsonSchemaValidate.mockReturnValue([{
            schemaPath: '#/required',
            keyword: 'required',
            params: {}
        }]);
        const arch = architectureWithNodeControl(inlineConfig);
        const result = await validateAllControls(arch, undefined, makeSchemaDirectory(), false);
        expect(result.hasErrors).toBe(true);
        expect(result.jsonSchemaOutputs[0].path).toBe('/nodes/0/controls/security/requirements/0');
        expect(result.jsonSchemaOutputs[0].message).toBe('');
    });

    it('coerces a non-Error string thrown while loading the requirement schema', async () => {
        const schemaDir = makeSchemaDirectory();
        (schemaDir.getSchema as ReturnType<typeof vi.fn>).mockRejectedValueOnce('plain string failure');
        const arch = architectureWithNodeControl(inlineConfig);
        const result = await validateAllControls(arch, undefined, schemaDir, false);
        expect(result.hasErrors).toBe(true);
        expect(result.jsonSchemaOutputs[0].message).toContain('plain string failure');
    });

    // Note: this codebase uses the shared getErrorMessage util (String(error)) rather than
    // JSON.stringify, so a non-Error object throw is coerced to '[object Object]'. The behaviour
    // under test is that a non-Error throw is handled gracefully (an error output, no crash).
    it('coerces a non-Error object thrown while loading the requirement schema', async () => {
        const schemaDir = makeSchemaDirectory();
        (schemaDir.getSchema as ReturnType<typeof vi.fn>).mockRejectedValueOnce({ code: 500 });
        const arch = architectureWithNodeControl(inlineConfig);
        const result = await validateAllControls(arch, undefined, schemaDir, false);
        expect(result.hasErrors).toBe(true);
        expect(result.jsonSchemaOutputs[0].message).toContain('[object Object]');
    });

    it('does not throw when a non-stringifiable (circular) value is thrown while loading the requirement schema', async () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        const schemaDir = makeSchemaDirectory();
        (schemaDir.getSchema as ReturnType<typeof vi.fn>).mockRejectedValueOnce(circular);
        const arch = architectureWithNodeControl(inlineConfig);
        const result = await validateAllControls(arch, undefined, schemaDir, false);
        expect(result.hasErrors).toBe(true);
        expect(result.jsonSchemaOutputs[0].message).toContain('[object Object]');
    });
});
