import fs from 'fs';
import axios, { AxiosError } from 'axios';
import {
    CompositeReferenceResolver,
    FileReferenceResolver,
    HttpReferenceResolver,
    InMemoryResolver
} from './calm-reference-resolver';

describe('FileReferenceResolver', () => {
    let existsSyncSpy: jest.SpyInstance;
    let readFileSyncSpy: jest.SpyInstance;
    let resolver: FileReferenceResolver;

    beforeEach(() => {
        resolver = new FileReferenceResolver();
        existsSyncSpy = jest.spyOn(fs, 'existsSync');
        readFileSyncSpy = jest.spyOn(fs, 'readFileSync');
    });

    afterEach(() => {
        jest.restoreAllMocks();
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
    let axiosGetSpy: jest.SpyInstance;

    beforeEach(() => {
        resolver = new HttpReferenceResolver();
        axiosGetSpy = jest.spyOn(axios, 'get');
    });

    afterEach(() => {
        jest.restoreAllMocks();
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
    let axiosGetSpy: jest.SpyInstance;
    let existsSyncSpy: jest.SpyInstance;
    let readFileSyncSpy: jest.SpyInstance;

    beforeEach(() => {
        resolver = new CompositeReferenceResolver();
        axiosGetSpy = jest.spyOn(axios, 'get');
        existsSyncSpy = jest.spyOn(fs, 'existsSync');
        readFileSyncSpy = jest.spyOn(fs, 'readFileSync');
    });

    afterEach(() => {
        jest.restoreAllMocks();
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


    it('uses HTTP resolver if it succeeds', async () => {
        axiosGetSpy.mockResolvedValue({ data: { key: 'http-value' } });
        const result = await resolver.resolve('http://example.com/test.json');
        expect(result).toEqual({ key: 'http-value' });
    });

    it('falls back to file resolver if HTTP fails', async () => {
        axiosGetSpy.mockRejectedValue(new Error('HTTP error'));
        existsSyncSpy.mockImplementation((ref: string) => ref === 'http://example.com/test.json');
        readFileSyncSpy.mockReturnValue('{"key": "file-value"}');
        const result = await resolver.resolve('http://example.com/test.json');
        expect(result).toEqual({ key: 'file-value' });
    });

    it('throws error if neither resolver can resolve', async () => {
        axiosGetSpy.mockRejectedValue(new Error('HTTP error'));
        existsSyncSpy.mockReturnValue(false);
        await expect(resolver.resolve('http://nonexistent.com/test.json'))
            .rejects.toThrow('Composite resolver: Unable to resolve reference http://nonexistent.com/test.json');
    });
});
