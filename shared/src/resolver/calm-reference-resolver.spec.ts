import fs from 'fs';
import axios, { AxiosError } from 'axios';
import {
    CompositeReferenceResolver,
    FileReferenceResolver,
    HttpReferenceResolver,
    InMemoryResolver
} from './calm-reference-resolver';

describe('FileReferenceResolver', () => {
    let existsSyncSpy: vi.SpyInstance;
    let readFileSyncSpy: vi.SpyInstance;
    let resolver: FileReferenceResolver;

    beforeEach(() => {
        resolver = new FileReferenceResolver();
        existsSyncSpy = vi.spyOn(fs, 'existsSync');
        readFileSyncSpy = vi.spyOn(fs, 'readFileSync');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns true if file exists', () => {
        existsSyncSpy.mockReturnValue(true);
        expect(resolver.canResolve('test.json')).toBe(true);
    });

    it('returns parsed JSON if file exists', async () => {
        existsSyncSpy.mockReturnValue(true);
        readFileSyncSpy.mockReturnValue('{"key": "value"}');
        const result = await resolver.resolve('test.json');
        expect(result).toEqual({ key: 'value' });
    });

    it('throws error if file does not exist', async () => {
        existsSyncSpy.mockReturnValue(false);
        await expect(resolver.resolve('nonexistent.json')).rejects.toThrow('File not found: nonexistent.json');
    });
});

describe('InMemoryResolver', () => {
    let resolver: InMemoryResolver;
    const dataStore = { 'key': 'value' };

    beforeEach(() => {
        resolver = new InMemoryResolver(dataStore);
    });

    it('returns true if key exists', () => {
        expect(resolver.canResolve('key')).toBe(true);
    });

    it('returns false if key does not exist', () => {
        expect(resolver.canResolve('nonexistent')).toBe(false);
    });

    it('resolves value if key exists', async () => {
        const result = await resolver.resolve('key');
        expect(result).toEqual('value');
    });

    it('throws error if key does not exist', async () => {
        await expect(resolver.resolve('nonexistent')).rejects.toThrow('Mocked reference not found: nonexistent');
    });
});

describe('HttpReferenceResolver', () => {
    let resolver: HttpReferenceResolver;
    let axiosGetSpy: vi.SpyInstance;

    beforeEach(() => {
        resolver = new HttpReferenceResolver();
        axiosGetSpy = vi.spyOn(axios, 'get');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns true for http URL', () => {
        expect(resolver.canResolve('http://example.com')).toBe(true);
    });

    it('returns true for https URL', () => {
        expect(resolver.canResolve('https://example.com')).toBe(true);
    });

    it('returns false for non-http URL', () => {
        expect(resolver.canResolve('ftp://example.com')).toBe(false);
    });

    it('resolves data when axios.get succeeds', async () => {
        axiosGetSpy.mockResolvedValue({ data: { key: 'value' } });
        const result = await resolver.resolve('http://example.com/test.json');
        expect(result).toEqual({ key: 'value' });
    });

    it('throws error when axios.get fails with AxiosError', async () => {
        const error: AxiosError = {
            name: 'AxiosError',
            message: 'Network error',
            isAxiosError: true,
            toJSON: () => ({}),
            code: 'ECONNREFUSED',
            response: undefined
        };
        axiosGetSpy.mockRejectedValue(error);
        await expect(resolver.resolve('http://example.com/test.json'))
            .rejects.toThrow('HTTP request failed for http://example.com/test.json: Network error');
    });
});

describe('CompositeReferenceResolver', () => {
    let resolver: CompositeReferenceResolver;
    let axiosGetSpy: vi.SpyInstance;
    let existsSyncSpy: vi.SpyInstance;
    let readFileSyncSpy: vi.SpyInstance;

    beforeEach(() => {
        resolver = new CompositeReferenceResolver();
        axiosGetSpy = vi.spyOn(axios, 'get');
        existsSyncSpy = vi.spyOn(fs, 'existsSync');
        readFileSyncSpy = vi.spyOn(fs, 'readFileSync');
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('returns true if the HTTP resolver can resolve', () => {
        expect(resolver.canResolve('http://example.com/test.json')).toBe(true);
    });

    it('returns true if the file resolver can resolve', () => {
        existsSyncSpy.mockReturnValue(true);
        expect(resolver.canResolve('/path/to/file.json')).toBe(true);
    });

    it('returns false if neither resolver can resolve', () => {
        existsSyncSpy.mockReturnValue(false);
        expect(resolver.canResolve('ftp://example.com/test.json')).toBe(false);
    });

    it('uses file resolver if it succeeds', async () => {
        existsSyncSpy.mockReturnValue(true);
        readFileSyncSpy.mockReturnValue(JSON.stringify({ key: 'file-value' }));

        const result = await resolver.resolve('file:///test.json');
        expect(result).toEqual({ key: 'file-value' });

        expect(existsSyncSpy).toHaveBeenCalledWith('file:///test.json');
        expect(readFileSyncSpy).toHaveBeenCalledWith('file:///test.json', 'utf-8');
        expect(axiosGetSpy).not.toHaveBeenCalled(); // Should not call HTTP
    });

    it('falls back to HTTP resolver if file resolution fails', async () => {
        existsSyncSpy.mockReturnValue(false); // File does not exist
        axiosGetSpy.mockResolvedValue({ data: { key: 'http-value' } });

        const result = await resolver.resolve('http://example.com/test.json');
        expect(result).toEqual({ key: 'http-value' });

        expect(existsSyncSpy).toHaveBeenCalledWith('http://example.com/test.json');
        expect(readFileSyncSpy).not.toHaveBeenCalled(); // Should not attempt to read file
        expect(axiosGetSpy).toHaveBeenCalledWith('http://example.com/test.json');
    });

    it('throws an error if neither file nor HTTP resolver can resolve', async () => {
        existsSyncSpy.mockReturnValue(false);
        axiosGetSpy.mockRejectedValue(new Error('HTTP error'));

        await expect(resolver.resolve('http://nonexistent.com/test.json'))
            .rejects.toThrow('Composite resolver: Unable to resolve reference http://nonexistent.com/test.json');

        expect(existsSyncSpy).toHaveBeenCalledWith('http://nonexistent.com/test.json');
        expect(readFileSyncSpy).not.toHaveBeenCalled();
        expect(axiosGetSpy).toHaveBeenCalledWith('http://nonexistent.com/test.json');
    });

    it('prioritizes file resolver over HTTP when both are available', async () => {
        existsSyncSpy.mockReturnValue(true);
        readFileSyncSpy.mockReturnValue(JSON.stringify({ key: 'file-value' }));
        axiosGetSpy.mockResolvedValue({ data: { key: 'http-value' } });

        const result = await resolver.resolve('file:///test.json');
        expect(result).toEqual({ key: 'file-value' });

        expect(existsSyncSpy).toHaveBeenCalledWith('file:///test.json');
        expect(readFileSyncSpy).toHaveBeenCalledWith('file:///test.json', 'utf-8');
        expect(axiosGetSpy).not.toHaveBeenCalled();
    });

});
