import { loadJsonFromFile } from './file-input';

const mocks = vi.hoisted(() => {
    return {
        readFileSync: vi.fn()
    };
});

vi.mock('fs', async () => {
    return {
        readFileSync: mocks.readFileSync
    };
});

describe('fileInput', () => {
    it('should read a file and return its content as an object', async () => {
        mocks.readFileSync.mockReturnValue(JSON.stringify({ key: 'value' }));
        
        await expect(loadJsonFromFile('test.json', false)).resolves.toEqual({ key: 'value' });
        expect(mocks.readFileSync).toHaveBeenCalledWith('test.json', 'utf-8');
    });

    it('should pass along error if a random error is thrown', async () => {
        mocks.readFileSync.mockImplementation(() => {
            throw new Error('Random error');
        });
        
        await expect(loadJsonFromFile('error.json', false)).rejects.toThrow('Random error');
        expect(mocks.readFileSync).toHaveBeenCalledWith('error.json', 'utf-8');
    });
});