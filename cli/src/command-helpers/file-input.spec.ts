import { loadJsonFromFile } from './file-input';

const mocks = vi.hoisted(() => {
    return {
        readFile: vi.fn()
    };
});

vi.mock('node:fs/promises', async () => {
    return {
        readFile: mocks.readFile
    };
});

describe('fileInput', () => {
    it('should read a file and return its content as an object', async () => {
        mocks.readFile.mockReturnValue(JSON.stringify({ key: 'value' }));
        
        await expect(loadJsonFromFile('test.json', false)).resolves.toEqual({ key: 'value' });
        expect(mocks.readFile).toHaveBeenCalledWith('test.json', 'utf-8');
    });

    it('should pass along error if a random error is thrown', async () => {
        mocks.readFile.mockImplementation(() => {
            throw new Error('Random error');
        });
        
        await expect(loadJsonFromFile('error.json', false)).rejects.toThrow('Random error');
        expect(mocks.readFile).toHaveBeenCalledWith('error.json', 'utf-8');
    });
});