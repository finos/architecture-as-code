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
        mockExit.mockRestore();
    });

    it('exits with error when the pattern does not pass all the spectral validations ', async () => {
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

        await expect(validate(undefined, 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled, jsonFormat))
            .rejects
            .toThrow();

        expect(mockExit)
            .toHaveBeenCalledWith(1);
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

        await expect(validate(undefined, 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled, jsonFormat, undefined, true))
            .rejects
            .toThrow();

        expect(mockExit)
            .toHaveBeenCalledWith(1);
    });

    it('exits with error when spectral no errors, but json schema is invalid', async () => {
        const expectedSpectralOutput: ISpectralDiagnostic[] = [
        ];

        mockRunFunction.mockReturnValue(expectedSpectralOutput);

        const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/bad-schema/bad-json-schema.json'), 'utf8');
        fetchMock.mock('http://exist/api-gateway.json', apiGateway);

        await expect(validate(undefined, 'http://exist/api-gateway.json', metaSchemaLocation, debugDisabled, jsonFormat))
            .rejects
            .toThrow();

        expect(mockExit)
            .toHaveBeenCalledWith(1);
    });
});