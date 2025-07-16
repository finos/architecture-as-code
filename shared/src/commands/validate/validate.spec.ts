import { validate, sortSpectralIssueBySeverity, convertSpectralDiagnosticToValidationOutputs, convertJsonSchemaIssuesToValidationOutputs, stripRefs, exitBasedOffOfValidationOutcome } from './validate';
import { readFileSync } from 'fs';
import path from 'path';
import { ISpectralDiagnostic } from '@stoplight/spectral-core';
import { ValidationOutcome, ValidationOutput } from './validation.output';
import { ErrorObject } from 'ajv';
import { SchemaDirectory } from '../../schema-directory';

let schemaDirectory: SchemaDirectory = {
    getSchema: vi.fn(),
    getAllSchemas: vi.fn(),
} as unknown as SchemaDirectory;

const mocks = vi.hoisted(() => ({
    jsonSchemaValidate: vi.fn().mockReturnValue([]), // default: always valid
    spectralRun: vi.fn(),
    jsonSchemaValidatorConstructor: vi.fn().mockImplementation(() => {
        return {
            validate: mocks.jsonSchemaValidate
        };
    })
}));

vi.mock('@stoplight/spectral-core', async () => {
    const spectralCore = await vi.importActual('@stoplight/spectral-core');
    return {
        ...spectralCore,
        Spectral: vi.fn().mockImplementation(() => {
            return {
                run: mocks.spectralRun,
                setRuleset: () => { },
            };
        })
    };
});

vi.mock('../../logger.js', () => {
    return {
        initLogger: () => {
            return {
                info: vi.fn(),
                debug: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            };
        }
    };
});

vi.mock('./json-schema-validator', () => {
    return {
        JsonSchemaValidator: mocks.jsonSchemaValidatorConstructor
    };
});

const debugDisabled = false;

describe('validation support functions', () => {
    describe('exitBasedOffOfValidationOutcome', () => {
        let mockExit;

        beforeEach(() => {
            mockExit = vi.spyOn(process, 'exit')
                .mockImplementation((code?) => {
                    if (code != 0) {
                        throw new Error();
                    }
                    return undefined as never;
                });
        });

        it('exit based off of validation outcomes - non-zero outcome if error', () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            mockExit = vi.spyOn(process, 'exit').mockImplementation((code?) => undefined as never);
            const expectedValidationOutcome: ValidationOutcome = new ValidationOutcome([], [], true, false);
            exitBasedOffOfValidationOutcome(expectedValidationOutcome, false);
            expect(mockExit).toHaveBeenCalledWith(1);
        });

        it('exit based off of validation outcomes - zero outcome if warning but failOnWarnings set to false', () => {
            const expectedValidationOutcome: ValidationOutcome = new ValidationOutcome([], [], false, true);
            exitBasedOffOfValidationOutcome(expectedValidationOutcome, false);
            expect(mockExit).toHaveBeenCalledWith(0);
        });

        it('exit based off of validation outcomes - non-zero outcome if warning but failOnWarnings set to true', () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            mockExit = vi.spyOn(process, 'exit').mockImplementation((code?) => undefined as never);
            const expectedValidationOutcome: ValidationOutcome = new ValidationOutcome([], [], false, true);
            exitBasedOffOfValidationOutcome(expectedValidationOutcome, true);
            expect(mockExit).toHaveBeenCalledWith(1);
        });
    });

    describe('sortSpectralIssueBySeverity', () => {

        it('should sort the spectral issues based on the severity', () => {
            const givenFirstError = buildISpectralDiagnostic('error-code-1', 'This is the first error', 0);
            const givenFirstWarning = buildISpectralDiagnostic('warning-code-1', 'This is the first warning', 1);
            const givenSecondWarning = buildISpectralDiagnostic('warning-code-2', 'This is the second warning', 1);
            const givenSecondError = buildISpectralDiagnostic('error-code-2', 'This is the second error', 0);
            const givenNotSortedSpectralIssues: ISpectralDiagnostic[] = [givenFirstError, givenFirstWarning, givenSecondWarning, givenSecondError];
            sortSpectralIssueBySeverity(givenNotSortedSpectralIssues);
            const expectedSortedSpectralIssue: ISpectralDiagnostic[] = [givenFirstError, givenSecondError, givenFirstWarning, givenSecondWarning];
            expect(givenNotSortedSpectralIssues).toStrictEqual(expectedSortedSpectralIssue);
        });
    });

    describe('stripRefs', () => {
        const objectWithRefs = JSON.parse('{"$ref":123,"abc":{"$ref":321}}');
        const expectedString = '{"ref":123,"abc":{"ref":321}}';

        it('should strip refs out of the incoming objects', () => {
            expect(stripRefs(objectWithRefs))
                .toBe(expectedString);
        });
    });

    describe('formatSpectralOutput', () => {

        it('should convert the spectral output to the ValidationOutput format', () => {
            const given: ISpectralDiagnostic[] = [
                {
                    code: 'no-empty-properties',
                    message: 'Must not contain string properties set to the empty string or numerical properties set to zero',
                    severity: 0,
                    path: [
                        'relationships',
                        '0',
                        'relationship-type',
                        'connects',
                        'destination',
                        'interface'
                    ],
                    range: { start: { line: 1, character: 1 }, end: { line: 2, character: 1 } }
                }
            ];

            const expected: ValidationOutput[] = [new ValidationOutput(
                'no-empty-properties',
                'error',
                'Must not contain string properties set to the empty string or numerical properties set to zero',
                '/relationships/0/relationship-type/connects/destination/interface',
                '',
                1,
                2,
                1,
                1
            )];

            const actual = convertSpectralDiagnosticToValidationOutputs(given);

            expect(actual).toStrictEqual(expected);
        });

        it('should convert the spectral output to the ValidationOutput format when path is an empty array', () => {
            const given: ISpectralDiagnostic[] = [
                {
                    code: 'no-empty-properties',
                    message: 'Must not contain string properties set to the empty string or numerical properties set to zero',
                    severity: 0,
                    path: [],
                    range: { start: { line: 1, character: 1 }, end: { line: 2, character: 1 } }
                }
            ];

            const expected: ValidationOutput[] = [new ValidationOutput(
                'no-empty-properties',
                'error',
                'Must not contain string properties set to the empty string or numerical properties set to zero',
                '/',
                '',
                1,
                2,
                1,
                1
            )];

            const actual = convertSpectralDiagnosticToValidationOutputs(given);

            expect(actual).toStrictEqual(expected);
        });

        it('should return an empty array when spectral reports no issues', () => {
            const given: ISpectralDiagnostic[] = [];
            const expected: ValidationOutput[] = [];
            const actual = convertSpectralDiagnosticToValidationOutputs(given);
            expect(actual).toStrictEqual(expected);
        });

    });

    describe('formatJsonSchemaOutput', () => {
        it('should convert the json schema output to the ValidationOutput format', () => {
            const given: ErrorObject[] = [
                {
                    'instancePath': '/nodes/0/interfaces/0/port',
                    'schemaPath': 'https://calm.finos.org/draft/2024-10/meta/interface.json#/defs/host-port-interface/properties/port/type',
                    'keyword': 'type',
                    'params': {
                        'type': 'integer'
                    },
                    'message': 'must be integer'
                }
            ];

            const expected: ValidationOutput[] = [
                new ValidationOutput(
                    'json-schema',
                    'error',
                    'must be integer',
                    '/nodes/0/interfaces/0/port',
                    'https://calm.finos.org/draft/2024-10/meta/interface.json#/defs/host-port-interface/properties/port/type'
                )
            ];

            const actual = convertJsonSchemaIssuesToValidationOutputs(given);

            expect(actual).toStrictEqual(expected);
        });

        it('should convert the json schema output to the ValidationOutput format when instancePath is empty', () => {
            const given: ErrorObject[] = [
                {
                    'instancePath': '',
                    'schemaPath': '#/required',
                    'keyword': 'required',
                    'params': {
                        'missingProperty': 'nodes'
                    },
                    'message': 'must have required property \'nodes\''
                }
            ];

            const expected: ValidationOutput[] = [
                new ValidationOutput(
                    'json-schema',
                    'error',
                    'must have required property \'nodes\'',
                    '',
                    '#/required'
                )
            ];

            const actual = convertJsonSchemaIssuesToValidationOutputs(given);

            expect(actual).toStrictEqual(expected);
        });

        it('should return an empty array when no JSON Schema issues have been reported', () => {
            const given: ErrorObject[] = [];
            const expected: ValidationOutput[] = [];
            const actual = convertJsonSchemaIssuesToValidationOutputs(given);
            expect(actual).toStrictEqual(expected);
        });

    });
});

describe('validate pattern and architecture', () => {
    beforeEach(() => {
        mocks.jsonSchemaValidate.mockReset().mockReturnValue([]); // default: always valid
        mocks.spectralRun.mockReset();
        vi.useFakeTimers();
        schemaDirectory = {
            getSchema: vi.fn(),
            getAllSchemas: vi.fn(),
        } as unknown as SchemaDirectory;
    });

    it('throws error when the the Pattern and the Architecture are undefined', async () => {
        await expect(validate(undefined, undefined, schemaDirectory, debugDisabled))
            .rejects
            .toThrow();
    });

    it('has error when the architecture does not match the json schema', async () => {
        // Simulate invalid schema validation
        mocks.jsonSchemaValidate.mockReturnValue([
            {
                instancePath: '/nodes/0/interfaces/0/port',
                schemaPath: 'schema-path',
                keyword: 'type',
                params: { type: 'integer' },
                message: 'must be integer'
            }
        ]);
        // Use dummy objects
        const dummyPattern = { dummy: 'pattern' };
        const dummyArchitecture = { dummy: 'architecture' };
        schemaDirectory.getSchema = vi.fn(() => Promise.resolve({}));

        const response = await validate(dummyArchitecture, dummyPattern, schemaDirectory, debugDisabled);

        expect(response).not.toBeNull();
        expect(response).not.toBeUndefined();
        expect(response.hasErrors).toBeTruthy();
        expect(response.allValidationOutputs()).not.toBeNull();
        expect(response.allValidationOutputs().length).toBeGreaterThan(0);
    });

    it('has error when the architecture does not pass all the spectral validations', async () => {
        // Simulate valid schema validation
        mocks.jsonSchemaValidate.mockReturnValue([]);
        const expectedSpectralOutput: ISpectralDiagnostic[] = [
            {
                code: 'no-empty-properties',
                message: 'Must not contain string properties set to the empty string or numerical properties set to zero',
                severity: 0,
                path: ['/nodes'],
                range: { start: { line: 1, character: 1 }, end: { line: 2, character: 1 } }
            }
        ];

        mocks.spectralRun.mockReturnValue(expectedSpectralOutput);

        // Use dummy objects
        const dummyPattern = { dummy: 'pattern' };
        const dummyArchitecture = { dummy: 'architecture' };
        schemaDirectory.getSchema = vi.fn(() => Promise.resolve({}));

        const response = await validate(dummyArchitecture, dummyPattern, schemaDirectory, debugDisabled);

        expect(response).not.toBeNull();
        expect(response).not.toBeUndefined();
        expect(response.hasErrors).toBeTruthy();
        expect(response.allValidationOutputs()).not.toBeNull();
        expect(response.allValidationOutputs().length).toBeGreaterThan(0);
    });

    it('has error when the pattern does not pass all the spectral validations ', async () => {
        // Simulate valid schema validation
        mocks.jsonSchemaValidate.mockReturnValue([]);
        const expectedSpectralOutput: ISpectralDiagnostic[] = [
            {
                code: 'no-empty-properties',
                message: 'Must not contain string properties set to the empty string or numerical properties set to zero',
                severity: 0,
                path: ['/nodes'],
                range: { start: { line: 1, character: 1 }, end: { line: 2, character: 1 } }
            }
        ];

        mocks.spectralRun.mockReturnValue(expectedSpectralOutput);

        // Use dummy objects
        const dummyPattern = { dummy: 'pattern' };
        const dummyArchitecture = { dummy: 'architecture' };
        schemaDirectory.getSchema = vi.fn(() => Promise.resolve({}));

        const response = await validate(dummyArchitecture, dummyPattern, schemaDirectory, debugDisabled);
        expect(response).not.toBeNull();
        expect(response).not.toBeUndefined();
        expect(response.hasErrors).toBeTruthy();
        expect(response.allValidationOutputs()).not.toBeNull();
        expect(response.allValidationOutputs().length).toBeGreaterThan(0);
    });

    it('completes successfully when the spectral validation returns warnings and errors', async () => {
        // Simulate valid schema validation
        mocks.jsonSchemaValidate.mockReturnValue([]);
        const expectedSpectralOutput: ISpectralDiagnostic[] = [
            {
                code: 'warning-test',
                message: 'Test warning',
                severity: 1,
                path: ['nodes'],
                range: { start: { line: 1, character: 1 }, end: { line: 2, character: 1 } }
            }
        ];

        mocks.spectralRun.mockReturnValue(expectedSpectralOutput);

        // Use dummy objects
        const dummyPattern = { dummy: 'pattern' };
        const dummyArchitecture = { dummy: 'architecture' };
        schemaDirectory.getSchema = vi.fn(() => Promise.resolve({}));

        const response = await validate(dummyArchitecture, dummyPattern, schemaDirectory, debugDisabled);
        expect(response).not.toBeNull();
        expect(response).not.toBeUndefined();
        expect(response.hasErrors).not.toBeTruthy();
        expect(response.hasWarnings).toBeTruthy();
        expect(response.allValidationOutputs()).not.toBeNull();
        expect(response.allValidationOutputs().length).toBeGreaterThan(0);
    });

});

describe('validate pattern only', () => {
    beforeEach(() => {
        schemaDirectory = {
            getSchema: vi.fn(),
            getAllSchemas: vi.fn(),
        } as unknown as SchemaDirectory;
    });

    it('has errors when the pattern does not pass all the spectral validations ', async () => {
        const expectedSpectralOutput: ISpectralDiagnostic[] = [
            {
                code: 'example-error',
                message: 'Example error',
                severity: 0,
                path: ['/nodes'],
                range: { start: { line: 1, character: 1 }, end: { line: 2, character: 1 } }
            }
        ];

        mocks.spectralRun.mockReturnValue(expectedSpectralOutput);

        // Use dummy object
        const dummyPattern = { dummy: 'pattern' };
        schemaDirectory.getSchema = vi.fn(() => Promise.resolve({}));

        const response = await validate(undefined, dummyPattern, schemaDirectory, debugDisabled);
        expect(response).not.toBeNull();
        expect(response).not.toBeUndefined();
        expect(response.hasErrors).toBeTruthy();
        expect(response.allValidationOutputs()).not.toBeNull();
        expect(response.allValidationOutputs().length).toBeGreaterThan(0);
    });

    it('has errors when spectral returns no errors, but json schema is invalid', async () => {
        mocks.spectralRun.mockReturnValue([]);

        // Mock JsonSchemaValidator constructor to throw when compiling the pattern
        mocks.jsonSchemaValidatorConstructor.mockImplementation(() => {
            throw new Error('Pattern schema is invalid');
        });

        // Use dummy object
        const dummyPattern = { dummy: 'pattern' };

        const response = await validate(undefined, dummyPattern, schemaDirectory, debugDisabled);
        expect(response).not.toBeNull();
        expect(response).not.toBeUndefined();
        expect(response.hasErrors).toBeTruthy();
        expect(response.allValidationOutputs()).not.toBeNull();
        expect(response.allValidationOutputs().length).toBeGreaterThan(0);
    });
});

describe('validate - architecture only', () => {
    beforeEach(() => {
        schemaDirectory = {
            getSchema: vi.fn(),
            getAllSchemas: vi.fn(),
        } as unknown as SchemaDirectory;
    });

    it('return errors when the architecture does not pass all the spectral validations ', async () => {
        const expectedSpectralOutput: ISpectralDiagnostic[] = [
            {
                code: 'example-error',
                message: 'Example error',
                severity: 0,
                path: ['/nodes'],
                range: { start: { line: 1, character: 1 }, end: { line: 2, character: 1 } }
            }
        ];

        mocks.spectralRun.mockReturnValue(expectedSpectralOutput);

        // Use dummy object
        const dummyPattern = { dummy: 'pattern' };
        schemaDirectory.getSchema = vi.fn(() => Promise.resolve({}));

        const response = await validate(dummyPattern, undefined, schemaDirectory, debugDisabled);
        expect(response).not.toBeNull();
        expect(response).not.toBeUndefined();
        expect(response.hasErrors).toBeTruthy();
        expect(response.allValidationOutputs()).not.toBeNull();
        expect(response.allValidationOutputs().length).toBeGreaterThan(0);
    });

    it('returns no errors when the architecture passes all the spectral validations with no errors', async () => {
        const expectedSpectralOutput: ISpectralDiagnostic[] = [];

        mocks.spectralRun.mockReturnValue(expectedSpectralOutput);

        // Use dummy object
        const dummyPattern = { dummy: 'pattern' };
        schemaDirectory.getSchema = vi.fn(() => Promise.resolve({}));

        const response = await validate(dummyPattern, undefined, schemaDirectory, debugDisabled);

        expect(response).not.toBeNull();
        expect(response).not.toBeUndefined();
        expect(response.hasErrors).not.toBeTruthy();
        expect(response.hasWarnings).not.toBeTruthy();
        expect(response.allValidationOutputs()).not.toBeNull();
        expect(response.allValidationOutputs().length).toBe(0);
    });

    it('validates architecture against schema specified in $schema property when no pattern provided', async () => {
        const expectedSpectralOutput: ISpectralDiagnostic[] = [];
        mocks.spectralRun.mockReturnValue(expectedSpectralOutput);

        // Create a simple valid architecture with a CALM schema reference
        const validArchitecture = {
            '$schema': 'https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-03/meta/calm.json',
            'nodes': [
                {
                    'unique-id': 'test-node',
                    'node-type': 'system',
                    'name': 'Test Node',
                    'description': 'A test node'
                }
            ],
            'relationships': []
        };

        const calmSchema = readFileSync(path.resolve(__dirname, '../../../test_fixtures/calm/calm.json'), 'utf8');
        const coreSchema = readFileSync(path.resolve(__dirname, '../../../test_fixtures/calm/core.json'), 'utf8');
        schemaDirectory.getSchema = vi.fn((id: string) => {
            if (id.includes('calm.json')) return JSON.parse(calmSchema);
            if (id.includes('core.json')) return JSON.parse(coreSchema);
            return undefined;
        });

        const response = await validate(validArchitecture, undefined, schemaDirectory, false);

        expect(response).not.toBeNull();
        expect(response).not.toBeUndefined();

        // For a valid architecture, we should not have errors
        expect(response.hasErrors).toBeFalsy();
        expect(response.hasWarnings).toBeFalsy();
    });
});

function buildISpectralDiagnostic(code: string, message: string, severity: number): ISpectralDiagnostic {
    return {
        code: code,
        message: message,
        severity: severity,
        path: [
            'relationships',
            '0',
            'relationship-type',
            'connects',
            'destination',
            'interface'
        ],
        range: { start: { line: 1, character: 1 }, end: { line: 2, character: 1 } }
    };
}