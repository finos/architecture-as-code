import fetchMock from 'fetch-mock';
import validate from './validate';
import { readFileSync } from 'fs';
import path from 'path';
import { ISpectralDiagnostic } from '@stoplight/spectral-core';

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

const metaSchemaLocation = 'test_fixtures/calm';

describe('validate', () => {
    let mockExit;

    beforeEach(() => {
        mockRunFunction.mockReturnValue([]);
        mockExit = jest.spyOn(process, 'exit')
            .mockImplementation((code) => { throw new Error(`The exit code is ${code}`); });
    });

    afterEach(() => {
        mockExit.mockRestore();
    });


    it('exits with error when the JSON Schema pattern cannot be found in the input path', async () => {
        await expect(validate('../test_fixtures/api-gateway-implementation.json', 'thisFolderDoesNotExist/api-gateway.json', metaSchemaLocation))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('exits with error when the pattern instantiation file cannot be found in the input path', async () => {
        await expect(validate('../doesNotExists/api-gateway-implementation.json', 'test_fixtures/api-gateway.json', metaSchemaLocation))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('exits with error when the pattern instantiation file does not contain JSON', async () => {
        await expect(validate('test_fixtures/api-gateway-implementation.json', 'test_fixtures/markdown.md', metaSchemaLocation))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('exits with error when the JSON Schema pattern URL returns a 404', async () => {
        fetchMock.mock('http://does-not-exist/api-gateway.json', 404);

        await expect(validate('https://does-not-exist/api-gateway-implementation.json', 'http://does-not-exist/api-gateway.json', metaSchemaLocation))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
        fetchMock.restore();
    });

    it('exits with error when the pattern instantiation URL returns a 404', async () => {
        const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');

        fetchMock.mock('http://exist/api-gateway.json', apiGateway);
        fetchMock.mock('https://does-not-exist/api-gateway-implementation.json', 404);

        await expect(validate('https://does-not-exist/api-gateway-implementation.json', 'http://exist/api-gateway.json', metaSchemaLocation))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
        fetchMock.restore();
    });

    it('exits with error when the pattern instantiation file at given URL returns non JSON response', async () => {
        const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');

        const markdown = ' #This is markdown';
        fetchMock.mock('http://exist/api-gateway.json', apiGateway);
        fetchMock.mock('https://url/with/non/json/response', markdown);

        await expect(validate('https://url/with/non/json/response', 'http://exist/api-gateway.json', metaSchemaLocation))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
        fetchMock.restore();
    });


    it('exits with error when the pattern instantiation does not match the json schema', async () => {
        const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');
        

        fetchMock.mock('http://exist/api-gateway.json', apiGateway);
        const apiGatewayInstantiation = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway-implementation-that-does-not-match-schema.json'), 'utf8');
        fetchMock.mock('https://exist/api-gateway-implementation.json', apiGatewayInstantiation);

        await expect(validate('https://exist/api-gateway-implementation.json', 'http://exist/api-gateway.json', metaSchemaLocation))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
        fetchMock.restore();
    });

    it('exits with error when the pattern instantiation does not pass all the spectral validations', async () => {

        const expectedSpectralOutput: ISpectralDiagnostic[] = [
            {
                code: 'no-empty-properties',
                message: 'Must not contain string properties set to the empty string or numerical properties set to zero',
                severity: 0,
                path: JSON.parse(JSON.stringify('$..*')),
                range: { start: { line: 1, character: 1 }, end: { line: 2, character: 1 } }
            }
        ];

        mockRunFunction.mockReturnValue(expectedSpectralOutput);

        const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');
        fetchMock.mock('http://exist/api-gateway.json', apiGateway);

        const apiGatewayInstantiation = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway-implementation-that-does-not-pass-the-spectral-validation.json'), 'utf8');
        fetchMock.mock('https://exist/api-gateway-implementation.json', apiGatewayInstantiation);

        await expect(validate('https://exist/api-gateway-implementation.json', 'http://exist/api-gateway.json', metaSchemaLocation))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
        fetchMock.restore();
    });

    it('exits with error when the meta schema location is not a directory', async () => {
        await expect(validate('https://url/with/non/json/response', 'http://exist/api-gateway.json', 'test_fixtures/api-gateway.json'))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('complete successfully when the pattern instantiation validates against the pattern json schema', async () => {
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

        await validate('https://exist/api-gateway-implementation.json', 'http://exist/api-gateway.json', metaSchemaLocation);

        expect(mockExit).toHaveBeenCalledWith(0);
        fetchMock.restore();
    });

});




