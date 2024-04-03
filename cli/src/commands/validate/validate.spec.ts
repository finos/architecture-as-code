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

describe('validate input files', () => {

    it('The JSON Schema pattern cannot be found in set path', async () => {
        const mockExit = jest.spyOn(process, 'exit')
            .mockImplementation((code) => { throw new Error(`${code}`); });

        await expect(validate('thisFolderDoesNotExist/api-gateway.json', '../test_fixtures/api-gateway-implementation.json'))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
        mockExit.mockRestore();
    });

    it('The pattern instantiation file cannot be found in set path', async () => {
        const mockExit = jest.spyOn(process, 'exit')
            .mockImplementation((code) => { throw new Error(`${code}`); });

        await expect(validate('test_fixtures/api-gateway.json', '../doesNotExists/api-gateway-implementation.json')) 
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
        mockExit.mockRestore();
    });

    it('The pattern instantiation file does not contain JSON', async () => {
        const mockExit = jest.spyOn(process, 'exit')
            .mockImplementation((code) => { throw new Error(`${code}`); });

        await expect(validate('test_fixtures/markdown.md', 'test_fixtures/api-gateway-implementation.json'))
            .rejects
            .toThrow();

        expect(mockExit).toHaveBeenCalledWith(1);
        mockExit.mockRestore();
    });

    it('The JSON Schema pattern URL returns a 404', async () => {
        const mockExit = jest.spyOn(process, 'exit')
            .mockImplementation((code) => { throw new Error(`${code}`); });

        fetchMock.mock('http://does-not-exist/api-gateway.json', 404);

        await expect(validate('http://does-not-exist/api-gateway.json', 'https://does-not-exist/api-gateway-implementation.json'))
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

        await expect(validate('http://exist/api-gateway.json', 'https://does-not-exist/api-gateway-implementation.json'))
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

        await expect(validate('http://exist/api-gateway.json', 'https://url/with/non/json/response'))
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
        
        // Loading the needed meta schema
        const calm = readFileSync(path.resolve(__dirname, '../../../test_fixtures/calm.json'), 'utf8');
        fetchMock.mock('https://raw.githubusercontent.com/finos-labs/architecture-as-code/main/calm/draft/2024-03/meta/calm.json', calm);

        const core = readFileSync(path.resolve(__dirname, '../../../test_fixtures/core.json'), 'utf8');
        fetchMock.mock('https://raw.githubusercontent.com/finos-labs/architecture-as-code/main/calm/draft/2024-03/meta/core.json', core);

        const apiGateway = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway.json'), 'utf8');
        fetchMock.mock('https://raw.githubusercontent.com/finos-labs/architecture-as-code/main/calm/pattern/api-gateway.json', apiGateway);
        
        fetchMock.mock('http://exist/api-gateway.json', apiGateway);
        const apiGatewayInstantiation = readFileSync(path.resolve(__dirname, '../../../test_fixtures/api-gateway-implementation.json'), 'utf8');
        fetchMock.mock('https://exist/api-gateway-implementation.json', apiGatewayInstantiation);

        await validate('http://exist/api-gateway.json', 'https://exist/api-gateway-implementation.json');
        
        expect(mockExit).toHaveBeenCalledWith(0);
        mockExit.mockRestore();
        fetchMock.restore();
    });

});

