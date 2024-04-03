import fetchMock from 'fetch-mock';
import validate from './validate';
import { readFileSync } from 'fs';
import path from 'path';

jest.mock('@stoplight/spectral-core', () => {
    const spectralCore = jest.requireActual('@stoplight/spectral-core');
    return {
        ...spectralCore,
        Spectral: jest.fn().mockImplementation(() => {
            return {
                run: () => [],
                setRuleset: () => {},
            };
        })
    };
});

const metaSchemaLocation = '../calm/draft/2024-03/meta';

describe('validate input files', () => {

    it('The JSON Schema pattern cannot be found in set path', async () => {
        const mockExit = jest.spyOn(process, 'exit')
            .mockImplementation((code) => { throw new Error(`${code}`); });

        await expect(validate('../test_fixtures/api-gateway-implementation.json', 'thisFolderDoesNotExist/api-gateway.json',metaSchemaLocation ))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
        mockExit.mockRestore();
    });

    it('The pattern instantiation file cannot be found in set path', async () => {
        const mockExit = jest.spyOn(process, 'exit')
            .mockImplementation((code) => { throw new Error(`${code}`); });

        await expect(validate('../doesNotExists/api-gateway-implementation.json', 'test_fixtures/api-gateway.json', metaSchemaLocation)) 
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
        mockExit.mockRestore();
    });

    it('The pattern instantiation file does not contain JSON', async () => {
        const mockExit = jest.spyOn(process, 'exit')
            .mockImplementation((code) => { throw new Error(`${code}`); });

        await expect(validate('test_fixtures/api-gateway-implementation.json', 'test_fixtures/markdown.md', metaSchemaLocation))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
        mockExit.mockRestore();
    });

    it('The JSON Schema pattern URL returns a 404', async () => {
        const mockExit = jest.spyOn(process, 'exit')
            .mockImplementation((code) => { throw new Error(`${code}`); });

        fetchMock.mock('http://does-not-exist/api-gateway.json', 404);

        await expect(validate('https://does-not-exist/api-gateway-implementation.json', 'http://does-not-exist/api-gateway.json', metaSchemaLocation))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
        fetchMock.restore();
        mockExit.mockRestore();
    });

    it('The pattern instantiation URL returns a 404', async () => {
        const mockExit = jest.spyOn(process, 'exit')
            .mockImplementation((code) => { throw new Error(`${code}`); });
        
        const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');

        fetchMock.mock('http://exist/api-gateway.json', apiGateway);
        fetchMock.mock('https://does-not-exist/api-gateway-implementation.json', 404);

        await expect(validate('https://does-not-exist/api-gateway-implementation.json', 'http://exist/api-gateway.json', metaSchemaLocation))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
        fetchMock.restore();
        mockExit.mockRestore();
    });

    it('The pattern instantiation file at given URL returns non JSON response', async () => {
        
        const mockExit = jest.spyOn(process, 'exit')
            .mockImplementation((code) => { throw new Error(`${code}`); });
        
        const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');

        const markdown = ' #This is markdown';
        fetchMock.mock('http://exist/api-gateway.json', apiGateway);
        fetchMock.mock('https://url/with/non/json/response', markdown);

        await expect(validate('https://url/with/non/json/response', 'http://exist/api-gateway.json', metaSchemaLocation))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
        fetchMock.restore();
        mockExit.mockRestore();
    });

    it('The pattern instantiation validates against the pattern json schema', async () => {
        
        const mockExit = jest.spyOn(process, 'exit')
            .mockImplementation((code) => {
                if(code != 0){
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
        mockExit.mockRestore();
        fetchMock.restore();
    });

});

