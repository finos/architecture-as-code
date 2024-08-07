import fetchMock from 'fetch-mock';
import validate, { exportedForTesting } from './validate';
import { readFileSync, mkdtempSync, existsSync, rmSync } from 'fs';
import path from 'path';
import { ISpectralDiagnostic } from '@stoplight/spectral-core';
import { ValidationOutput } from './validation.output';
import { ErrorObject } from 'ajv';
import os from 'os';

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

jest.mock('../../consts', () => ({
    get CALM_SPECTRAL_RULES_DIRECTORY() { return '../spectral'; }
}));

const metaSchemaLocation = 'test_fixtures/calm';
const debugDisabled = false;
const jsonFormat = 'json';
const jUnitFormat = 'junit';

describe('validate', () => {
    let mockExit;

    beforeEach(() => {
        mockRunFunction.mockReturnValue([]);
        mockExit = jest.spyOn(process, 'exit')
            .mockImplementation((code) => {
                if (code != 0) {
                    throw new Error();
                }
                return undefined as never;
            });
    });

    afterEach(() => {
        fetchMock.restore();
        mockExit.mockRestore();
    });


    it('exits with error when the JSON Schema pattern cannot be found in the input path', async () => {
        await expect(validate('../test_fixtures/api-gateway-implementation.json', 'thisFolderDoesNotExist/api-gateway.json', metaSchemaLocation, debugDisabled, jsonFormat))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('exits with error when the pattern instantiation file cannot be found in the input path', async () => {
        await expect(validate('../doesNotExists/api-gateway-implementation.json', 'test_fixtures/api-gateway.json', metaSchemaLocation, debugDisabled, jsonFormat))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('exits with error when the pattern instantiation file does not contain JSON', async () => {
        await expect(validate('test_fixtures/api-gateway-implementation.json', 'test_fixtures/markdown.md', metaSchemaLocation, debugDisabled, jsonFormat))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('exits with error when the JSON Schema pattern URL returns a 404', async () => {
        fetchMock.mock('http://does-not-exist/api-gateway.json', 404);

        await expect(validate('https://does-not-exist/api-gateway-implementation.json', 'http://does-not-exist/api-gateway.json', metaSchemaLocation, debugDisabled, jsonFormat))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('exits with error when the pattern instantiation URL returns a 404', async () => {
        const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');

        fetchMock.mock('http://exist/api-gateway.json', apiGateway);
        fetchMock.mock('https://does-not-exist/api-gateway-implementation.json', 404);

        await expect(validate('https://does-not-exist/api-gateway-implementation.json', 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled, jsonFormat))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('exits with error when the pattern instantiation file at given URL returns non JSON response', async () => {
        const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');

        const markdown = ' #This is markdown';
        fetchMock.mock('http://exist/api-gateway.json', apiGateway);
        fetchMock.mock('https://url/with/non/json/response', markdown);

        await expect(validate('https://url/with/non/json/response', 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled, jsonFormat))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
    });


    it('exits with error when the pattern instantiation does not match the json schema', async () => {
        const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');
        

        fetchMock.mock('http://exist/api-gateway.json', apiGateway);
        const apiGatewayInstantiation = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway-implementation-that-does-not-match-schema.json'), 'utf8');
        fetchMock.mock('https://exist/api-gateway-implementation.json', apiGatewayInstantiation);

        await expect(validate('https://exist/api-gateway-implementation.json', 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled, jsonFormat))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('exits with error when the pattern instantiation does not pass all the spectral validations', async () => {

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

        await expect(validate('https://exist/api-gateway-implementation.json', 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled, jsonFormat))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('exits with error when the pattern does not pass all the spectral validations ', async () => {
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

        await expect(validate('https://exist/api-gateway-implementation.json', 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled, jsonFormat))
            .rejects
            .toThrow();
    });
    
    it('exits with error when spectral returns warnings, but failOnWarnings is set', async () => {
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

        await expect(validate('https://exist/api-gateway-implementation.json', 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled, jsonFormat, undefined, true))
            .rejects
            .toThrow();
    });

    it('completes successfully when the spectral validation returns warnings only and failOnWarnings is not set', async () => {
        const mockExit = jest.spyOn(process, 'exit')
            .mockImplementation((code) => {
                console.log(code);
                if (code != 0) {
                    throw new Error('Expected successful code 0');
                }
                return undefined as never;
            });

        const expectedSpectralOutput: ISpectralDiagnostic[] = [
            {
                code: 'warning-test',
                message: 'Test warning',
                severity: 1,
                path: [ 'nodes' ],
                range: { start: { line: 1, character: 1 }, end: { line: 2, character: 1 } }
            }
        ];

        mockRunFunction.mockReturnValue(expectedSpectralOutput);

        const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');
        fetchMock.mock('http://exist/api-gateway.json', apiGateway);

        const apiGatewayInstantiation = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway-implementation.json'), 'utf8');
        fetchMock.mock('https://exist/api-gateway-implementation.json', apiGatewayInstantiation);

        await validate('https://exist/api-gateway-implementation.json', 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled, jsonFormat, undefined, false);

        expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('exits with error when the meta schema location is not a directory', async () => {
        await expect(validate('https://url/with/non/json/response', 'http://exist/api-gateway.json', 'test_fixtures/api-gateway.json', debugDisabled, jsonFormat))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('complete successfully when the pattern instantiation validates against the pattern json schema in Json format', async () => {
        const mockExit = jest.spyOn(process, 'exit')
            .mockImplementation((code) => {
                if (code != 0) {
                    throw new Error();
                }
                return undefined as never;
            });

        const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');
        fetchMock.mock('http://exist/api-gateway.json', apiGateway);

        const apiGatewayInstantiation = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway-implementation.json'), 'utf8');
        fetchMock.mock('https://exist/api-gateway-implementation.json', apiGatewayInstantiation);

        await validate('https://exist/api-gateway-implementation.json', 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled, jsonFormat);

        expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('complete successfully when the pattern instantiation validates against the pattern json schema in JUnit format', async () => {
        const mockExit = jest.spyOn(process, 'exit')
            .mockImplementation((code) => {
                if (code != 0) {
                    throw new Error();
                }
                return undefined as never;
            });

        const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');
        fetchMock.mock('http://exist/api-gateway.json', apiGateway);

        const apiGatewayInstantiation = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway-implementation.json'), 'utf8');
        fetchMock.mock('https://exist/api-gateway-implementation.json', apiGatewayInstantiation);

        await validate('https://exist/api-gateway-implementation.json', 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled, jUnitFormat);

        expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('complete successfully when the pattern instantiation validates against the pattern json schema and the JUnit format output file is created', async () => {
        const mockExit = jest.spyOn(process, 'exit')
            .mockImplementation((code) => {
                if (code != 0) {
                    throw new Error();
                }
                return undefined as never;
            });

        const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');
        fetchMock.mock('http://exist/api-gateway.json', apiGateway);

        const apiGatewayInstantiation = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway-implementation.json'), 'utf8');
        fetchMock.mock('https://exist/api-gateway-implementation.json', apiGatewayInstantiation);

        const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'report'));
        const testReportLocation = path.join(tmpDir,  'test-report.xml');
        await validate('https://exist/api-gateway-implementation.json', 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled, jUnitFormat, testReportLocation);

        expect(existsSync(testReportLocation)).toBe(true); //check that the test report exists

        rmSync(tmpDir, {recursive: true}); //delete folder with the test report

        expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('complete successfully when the pattern instantiation validates against the pattern json schema and the JSON format output file is created', async () => {
        const mockExit = jest.spyOn(process, 'exit')
            .mockImplementation((code) => {
                if (code != 0) {
                    throw new Error();
                }
                return undefined as never;
            });

        const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');
        fetchMock.mock('http://exist/api-gateway.json', apiGateway);

        const apiGatewayInstantiation = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway-implementation.json'), 'utf8');
        fetchMock.mock('https://exist/api-gateway-implementation.json', apiGatewayInstantiation);

        const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'report'));
        const reportLocation = path.join(tmpDir,  'report.json');
        await validate('https://exist/api-gateway-implementation.json', 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled, jsonFormat, reportLocation);

        expect(existsSync(reportLocation)).toBe(true); //check that the test report exists

        rmSync(tmpDir, {recursive: true}); //delete folder with the test report

        expect(mockExit).toHaveBeenCalledWith(0);
    });

});

const {
    formatSpectralOutput,
    formatJsonSchemaOutput,
    sortSpectralIssueBySeverity
} = exportedForTesting;

describe('sortSpectralIssueBySeverity', () => {

    it('should sort the spectral issues based on the severity', () => {
        const givenFirstError = buildISpectralDiagnostic('error-code-1', 'This is the first error', 0);
        const givenFirstWarning = buildISpectralDiagnostic('warning-code-1', 'This is the first warning', 1);
        const givenSecondWarning = buildISpectralDiagnostic('warning-code-2', 'This is the second warning', 1);
        const givenSecondError = buildISpectralDiagnostic('error-code-2', 'This is the second error', 0);
        const givenNotSortedSpectralIssues: ISpectralDiagnostic[] = [ givenFirstError, givenFirstWarning, givenSecondWarning, givenSecondError];
        sortSpectralIssueBySeverity(givenNotSortedSpectralIssues);
        const expectedSortedSpectralIssue: ISpectralDiagnostic[] = [givenFirstError, givenSecondError, givenFirstWarning, givenSecondWarning];
        expect(givenNotSortedSpectralIssues).toStrictEqual(expectedSortedSpectralIssue);
    });
});

function buildISpectralDiagnostic(code: string, message: string, severity: number): ISpectralDiagnostic{
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

        const expected : ValidationOutput[] = [new ValidationOutput(
            'no-empty-properties',
            'error',
            'Must not contain string properties set to the empty string or numerical properties set to zero',
            '/relationships/0/relationship-type/connects/destination/interface')]; 

        const actual = formatSpectralOutput(given);

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

        const expected : ValidationOutput[] = [new ValidationOutput(
            'no-empty-properties',
            'error',
            'Must not contain string properties set to the empty string or numerical properties set to zero',
            '/')]; 

        const actual = formatSpectralOutput(given);

        expect(actual).toStrictEqual(expected);
    });

    it('should return an empty array when spectral reports no issues', () => {
        const given: ISpectralDiagnostic[] = [];
        const expected : ValidationOutput[] = []; 
        const actual = formatSpectralOutput(given);
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
        
        const expected : ValidationOutput[] = [
            new ValidationOutput(
                'json-schema',
                'error',
                'must be integer',
                '/nodes/0/interfaces/0/port',
                'https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/interface.json#/defs/host-port-interface/properties/port/type'
            )
        ]; 

        const actual = formatJsonSchemaOutput(given);

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
        
        const expected : ValidationOutput[] = [
            new ValidationOutput(
                'json-schema',
                'error',
                'must have required property \'nodes\'',
                '',
                '#/required'
            )
        ]; 

        const actual = formatJsonSchemaOutput(given);

        expect(actual).toStrictEqual(expected);
    });

    it('should return an empty array when no JSON Schema issues have been reported', () => {
        const given: ErrorObject[] = [];
        const expected : ValidationOutput[] = [];
        const actual = formatJsonSchemaOutput(given);
        expect(actual).toStrictEqual(expected);
    });

});

describe('stripRefs', () => {
    const objectWithRefs = JSON.parse('{"$ref":123,"abc":{"$ref":321}}');
    const expectedString = '{"ref":123,"abc":{"ref":321}}';

    expect(exportedForTesting.stripRefs(objectWithRefs))
        .toBe(expectedString);
});




