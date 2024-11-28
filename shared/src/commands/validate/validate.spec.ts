import fetchMock from 'fetch-mock';
import { validate, validateAndExitConditionally, sortSpectralIssueBySeverity, convertSpectralDiagnosticToValidationOutputs, convertJsonSchemaIssuesToValidationOutputs, stripRefs, exitBasedOffOfValidationOutcome } from './validate';
import { readFileSync } from 'fs';
import path from 'path';
import { ISpectralDiagnostic } from '@stoplight/spectral-core';
import { ValidationOutcome, ValidationOutput } from './validation.output';
import { ErrorObject } from 'ajv';

const mockRunFunction = jest.fn();

jest.mock('@stoplight/spectral-core', () => {
    const spectralCore = jest.requireActual('@stoplight/spectral-core');
    return {
        ...spectralCore,
        Spectral: jest.fn().mockImplementation(() => {
            return {
                run: mockRunFunction,
                setRuleset: () => { },
            };
        })
    };
});

jest.mock('../helper.js', () => {
    return {
        initLogger: () => {
            return {
                info: jest.fn(),
                debug: jest.fn(),
                error: jest.fn()
            };
        }
    };
});

const metaSchemaLocation = 'test_fixtures/calm';
const debugDisabled = false;

describe('validate-all', () => {
    describe('validate', () => {

        let mockExit;

        beforeEach(() => {
            mockRunFunction.mockReturnValue([]);
            jest.useFakeTimers();
            mockExit = jest.spyOn(process, 'exit')
                .mockImplementation((code?) => {
                    if (code != 0) {
                        throw new Error();
                    }
                    return undefined as never;
                });
        });

        afterEach(() => {
            fetchMock.restore();
        });


        it('returns validation error when the JSON Schema pattern cannot be found in the input path', async () => {
            await expect(validate('../test_fixtures/api-gateway-implementation.json', 'thisFolderDoesNotExist/api-gateway.json', metaSchemaLocation, debugDisabled))
                .rejects
                .toThrow();
            expect(mockExit).toHaveBeenCalledWith(1);

        });

        it('returns validation error when the pattern instantiation file cannot be found in the input path', async () => {
            await expect(validate('../doesNotExists/api-gateway-implementation.json', 'test_fixtures/api-gateway.json', metaSchemaLocation, debugDisabled))
                .rejects
                .toThrow();
            expect(mockExit).toHaveBeenCalledWith(1);
        });

        it('returns validation error when the pattern instantiation file does not contain JSON', async () => {
            await expect(validate('test_fixtures/api-gateway-implementation.json', 'test_fixtures/markdown.md', metaSchemaLocation, debugDisabled))
                .rejects
                .toThrow();
            expect(mockExit).toHaveBeenCalledWith(1);
        });

        it('exits with error when the JSON Schema pattern URL returns a 404', async () => {
            fetchMock.mock('http://does-not-exist/api-gateway.json', 404);

            await expect(validate('https://does-not-exist/api-gateway-implementation.json', 'http://does-not-exist/api-gateway.json', metaSchemaLocation, debugDisabled))
                .rejects
                .toThrow();

            expect(mockExit).toHaveBeenCalledWith(1);
        });

        it('exits with error when the pattern instantiation URL returns a 404', async () => {
            const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');

            fetchMock.mock('http://exist/api-gateway.json', apiGateway);
            fetchMock.mock('https://does-not-exist/api-gateway-implementation.json', 404);

            await expect(validate('https://does-not-exist/api-gateway-implementation.json', 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled))
                .rejects
                .toThrow();

            expect(mockExit).toHaveBeenCalledWith(1);
        });

        it('exits with error when the pattern instantiation file at given URL returns non JSON response', async () => {
            const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');

            const markdown = ' #This is markdown';
            fetchMock.mock('http://exist/api-gateway.json', apiGateway);
            fetchMock.mock('https://url/with/non/json/response', markdown);

            await expect(validate('https://url/with/non/json/response', 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled))
                .rejects
                .toThrow();

            expect(mockExit).toHaveBeenCalledWith(1);
        });

        it('exits with error when the meta schema location is not a directory', async () => {
            await expect(validate('https://url/with/non/json/response', 'http://exist/api-gateway.json', 'test_fixtures/api-gateway.json', debugDisabled))
                .rejects
                .toThrow();

            expect(mockExit).toHaveBeenCalledWith(1);
        });


        it('has error when the pattern instantiation does not match the json schema', async () => {

            const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');
            fetchMock.mock('http://exist/api-gateway.json', apiGateway);

            const apiGatewayInstantiation = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway-implementation-that-does-not-match-schema.json'), 'utf8');
            fetchMock.mock('https://exist/api-gateway-implementation.json', apiGatewayInstantiation);

            const response = await validate('https://exist/api-gateway-implementation.json', 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled);

            expect(response).not.toBeNull();
            expect(response).not.toBeUndefined();
            expect(response.hasErrors).toBeTruthy();
            expect(response.allValidationOutputs()).not.toBeNull();
            expect(response.allValidationOutputs().length).toBeGreaterThan(0);
        });

        it('has error when the pattern instantiation does not pass all the spectral validations', async () => {

            const expectedSpectralOutput: ISpectralDiagnostic[] = [
                {
                    code: 'no-empty-properties',
                    message: 'Must not contain string properties set to the empty string or numerical properties set to zero',
                    severity: 0,
                    path: ['/nodes'],
                    range: { start: { line: 1, character: 1 }, end: { line: 2, character: 1 } }
                }
            ];

            mockRunFunction.mockReturnValue(expectedSpectralOutput);

            const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');
            fetchMock.mock('http://exist/api-gateway.json', apiGateway);

            const apiGatewayInstantiation = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway-implementation-that-does-not-pass-the-spectral-validation.json'), 'utf8');
            fetchMock.mock('https://exist/api-gateway-implementation.json', apiGatewayInstantiation);

            const response = await validate('https://exist/api-gateway-implementation.json', 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled);
            expect(response).not.toBeNull();
            expect(response).not.toBeUndefined();
            expect(response.hasErrors).toBeTruthy();
            expect(response.allValidationOutputs()).not.toBeNull();
            expect(response.allValidationOutputs().length).toBeGreaterThan(0);
        });

        it('has error when the pattern does not pass all the spectral validations ', async () => {
            const expectedSpectralOutput: ISpectralDiagnostic[] = [
                {
                    code: 'no-empty-properties',
                    message: 'Must not contain string properties set to the empty string or numerical properties set to zero',
                    severity: 0,
                    path: ['/nodes'],
                    range: { start: { line: 1, character: 1 }, end: { line: 2, character: 1 } }
                }
            ];

            mockRunFunction.mockReturnValue(expectedSpectralOutput);

            const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway-with-no-relationships.json'), 'utf8');
            fetchMock.mock('http://exist/api-gateway.json', apiGateway);

            const apiGatewayInstantiation = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway-implementation.json'), 'utf8');
            fetchMock.mock('https://exist/api-gateway-implementation.json', apiGatewayInstantiation);

            const response = await validate('https://exist/api-gateway-implementation.json', 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled);
            expect(response).not.toBeNull();
            expect(response).not.toBeUndefined();
            expect(response.hasErrors).toBeTruthy();
            expect(response.allValidationOutputs()).not.toBeNull();
            expect(response.allValidationOutputs().length).toBeGreaterThan(0);
        });

        it('completes successfully when the spectral validation returns warnings and errors', async () => {

            const expectedSpectralOutput: ISpectralDiagnostic[] = [
                {
                    code: 'warning-test',
                    message: 'Test warning',
                    severity: 1,
                    path: ['nodes'],
                    range: { start: { line: 1, character: 1 }, end: { line: 2, character: 1 } }
                }
            ];

            mockRunFunction.mockReturnValue(expectedSpectralOutput);

            const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');
            fetchMock.mock('http://exist/api-gateway.json', apiGateway);

            const apiGatewayInstantiation = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway-implementation.json'), 'utf8');
            fetchMock.mock('https://exist/api-gateway-implementation.json', apiGatewayInstantiation);

            const response = await validate('https://exist/api-gateway-implementation.json', 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled);
            expect(response).not.toBeNull();
            expect(response).not.toBeUndefined();
            expect(response.hasErrors).not.toBeTruthy();
            expect(response.hasWarnings).toBeTruthy();
            expect(response.allValidationOutputs()).not.toBeNull();
            expect(response.allValidationOutputs().length).toBeGreaterThan(0);
        });

        it('exit based off of validation outcomes - non-zero outcome if error', () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            mockExit = jest.spyOn(process, 'exit').mockImplementation((code?) => undefined as never);
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
            mockExit = jest.spyOn(process, 'exit').mockImplementation((code?) => undefined as never);
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
                    'schemaPath': 'https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/interface.json#/defs/host-port-interface/properties/port/type',
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
                    'https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/interface.json#/defs/host-port-interface/properties/port/type'
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

    describe('validate - pattern only', () => {
    
        let mockExit;
    
        beforeEach(() => {
            mockRunFunction.mockReturnValue([]);
            mockExit = jest.spyOn(process, 'exit')
                .mockImplementation((code) => {
                    if (code != 0) {
                        throw new Error('Expected successful run, code was nonzero: ' + code);
                    }
                    return undefined as never;
                });
        });
    
        afterEach(() => {
            fetchMock.restore();
        });
    
        it('exits with non zero exit code when the pattern does not pass all the spectral validations ', async () => {
            const expectedSpectralOutput: ISpectralDiagnostic[] = [
                {
                    code: 'example-error',
                    message: 'Example error',
                    severity: 0,
                    path: ['/nodes'],
                    range: { start: { line: 1, character: 1 }, end: { line: 2, character: 1 } }
                }
            ];
    
            mockRunFunction.mockReturnValue(expectedSpectralOutput);
    
            const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');
            fetchMock.mock('http://exist/api-gateway.json', apiGateway);
    
            await expect(validateAndExitConditionally('', 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled))
                .rejects
                .toThrow();
        });
    
        it('exits with error when spectral returns warnings, but failOnWarnings is set', async () => {
            const expectedSpectralOutput: ISpectralDiagnostic[] = [
                {
                    code: 'example-warning',
                    message: 'Example warning',
                    severity: 1,
                    path: ['/nodes'],
                    range: { start: { line: 1, character: 1 }, end: { line: 2, character: 1 } }
                }
            ];
    
            mockRunFunction.mockReturnValue(expectedSpectralOutput);
    
            const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');
            fetchMock.mock('http://exist/api-gateway.json', apiGateway);
            await expect(validateAndExitConditionally('', 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled, true))
                .rejects
                .toThrow();
    
            expect(mockExit)
                .toHaveBeenCalledWith(1);
        });
    
        it('when spectral no errors, but json schema is invalid - raise non-zero exit code', async () => {
            const expectedSpectralOutput: ISpectralDiagnostic[] = [
            ];
    
            mockRunFunction.mockReturnValue(expectedSpectralOutput);
    
            const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/bad-schema/bad-json-schema.json'), 'utf8');
            fetchMock.mock('http://exist/api-gateway.json', apiGateway);
    
            await expect(validateAndExitConditionally('', 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled))
                .rejects
                .toThrow();
    
            expect(mockExit)
                .toHaveBeenCalledWith(1);
        });
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