import fs from 'fs';
import axios, { AxiosError } from 'axios';
import { vi } from 'vitest';
import {
    CompositeReferenceResolver,
    FileReferenceResolver,
    HttpReferenceResolver,
    InMemoryResolver,
    MappedReferenceResolver
} from './calm-reference-resolver';

describe('FileReferenceResolver', () => {
    let existsSyncSpy: ReturnType<typeof vi.spyOn>;
    let readFileSyncSpy: ReturnType<typeof vi.spyOn>;
    let loggerInfoSpy: ReturnType<typeof vi.spyOn>;
    let resolver: FileReferenceResolver;

    beforeEach(() => {
        resolver = new FileReferenceResolver();
        existsSyncSpy = vi.spyOn(fs, 'existsSync');
        readFileSyncSpy = vi.spyOn(fs, 'readFileSync');
        loggerInfoSpy = vi.spyOn(FileReferenceResolver['logger'], 'info');
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

    it('throws error if file contains invalid JSON', async () => {
        existsSyncSpy.mockReturnValue(true);
        readFileSyncSpy.mockReturnValue('not-json');
        await expect(resolver.resolve('bad.json')).rejects.toThrow();
    });

    it('logs info when resolving a file', async () => {
        existsSyncSpy.mockReturnValue(true);
        readFileSyncSpy.mockReturnValue('{"key": "value"}');
        await resolver.resolve('test.json');
        expect(loggerInfoSpy).toHaveBeenCalledWith('Resolving reference: test.json');
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

    it('handles non-string keys', async () => {
        const dataStore = { 123: 'number-key', symbol: 'symbol-key' };
        const resolver = new InMemoryResolver(dataStore);
        expect(resolver.canResolve('123')).toBe(true);
        expect(await resolver.resolve('123')).toBe('number-key');
    });

    it('resolves complex objects as values', async () => {
        const dataStore = { obj: { a: 1, b: 2 } };
        const resolver = new InMemoryResolver(dataStore);
        expect(resolver.canResolve('obj')).toBe(true);
        expect(await resolver.resolve('obj')).toEqual({ a: 1, b: 2 });
    });
});

describe('HttpReferenceResolver', () => {
    let resolver: HttpReferenceResolver;
    let axiosGetSpy: ReturnType<typeof vi.spyOn>;
    let loggerInfoSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        resolver = new HttpReferenceResolver();
        axiosGetSpy = vi.spyOn(axios, 'get');
        loggerInfoSpy = vi.spyOn(HttpReferenceResolver['logger'], 'info');
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

    it('handles non-JSON responses gracefully', async () => {
        axiosGetSpy.mockResolvedValue({ data: 'plain text' });
        const result = await resolver.resolve('http://example.com/text');
        expect(result).toBe('plain text');
    });

    it('logs info when fetching a reference', async () => {
        axiosGetSpy.mockResolvedValue({ data: { key: 'value' } });
        await resolver.resolve('http://example.com/test.json');
        expect(loggerInfoSpy).toHaveBeenCalledWith('Fetching reference via HTTP: http://example.com/test.json');
    });

    it('handles network timeouts or other axios errors', async () => {
        const error: AxiosError = {
            name: 'AxiosError',
            message: 'Timeout',
            isAxiosError: true,
            toJSON: () => ({}),
            code: 'ETIMEDOUT',
            response: undefined
        };
        axiosGetSpy.mockRejectedValue(error);
        await expect(resolver.resolve('http://example.com/test.json')).rejects.toThrow('HTTP request failed for http://example.com/test.json: Timeout');
    });
});

describe('CompositeReferenceResolver', () => {
    let resolver: CompositeReferenceResolver;
    let axiosGetSpy: ReturnType<typeof vi.spyOn>;
    let existsSyncSpy: ReturnType<typeof vi.spyOn>;
    let readFileSyncSpy: ReturnType<typeof vi.spyOn>;
    let loggerDebugSpy: ReturnType<typeof vi.spyOn>;
    let loggerInfoSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        resolver = new CompositeReferenceResolver();
        axiosGetSpy = vi.spyOn(axios, 'get');
        existsSyncSpy = vi.spyOn(fs, 'existsSync');
        readFileSyncSpy = vi.spyOn(fs, 'readFileSync');
        loggerInfoSpy = vi.spyOn(CompositeReferenceResolver['logger'], 'info');
        loggerDebugSpy = vi.spyOn(CompositeReferenceResolver['logger'], 'debug');
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
        expect(axiosGetSpy).not.toHaveBeenCalled();
    });

    it('falls back to HTTP resolver if file resolution fails', async () => {
        existsSyncSpy.mockReturnValue(false);
        axiosGetSpy.mockResolvedValue({ data: { key: 'http-value' } });

        const result = await resolver.resolve('http://example.com/test.json');
        expect(result).toEqual({ key: 'http-value' });

        expect(existsSyncSpy).toHaveBeenCalledWith('http://example.com/test.json');
        expect(readFileSyncSpy).not.toHaveBeenCalled();
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

    it('logs debug on file fallback', async () => {
        // Simulate file exists but fails to read
        existsSyncSpy.mockReturnValue(true);
        readFileSyncSpy.mockImplementation(() => {
            throw new Error('bad file');
        });

        // Simulate fallback to HTTP
        axiosGetSpy.mockResolvedValue({ data: { key: 'http-value' } });

        const result = await resolver.resolve('http://example.com/file.json'); // must be resolvable by HTTP
        expect(result).toEqual({ key: 'http-value' });

        expect(loggerDebugSpy).toHaveBeenCalledWith(
            expect.stringContaining('File resolution failed for http://example.com/file.json')
        );
    });



    it('logs info on HTTP fallback', async () => {
        existsSyncSpy.mockReturnValue(false);
        axiosGetSpy.mockImplementation(() => { throw new Error('bad http'); });
        await expect(resolver.resolve('http://bad.com')).rejects.toThrow();
        expect(loggerInfoSpy).toHaveBeenCalled();
    });

    it('handles both resolvers failing with different error types', async () => {
        existsSyncSpy.mockReturnValue(true);
        readFileSyncSpy.mockImplementation(() => { throw new Error('bad file'); });
        axiosGetSpy.mockImplementation(() => { throw new Error('bad http'); });
        await expect(resolver.resolve('file.json')).rejects.toThrow('Composite resolver: Unable to resolve reference file.json');
    });
});

describe('MappedReferenceResolver', () => {
    let delegate: InMemoryResolver;
    let mapping: Map<string, string>;
    let resolver: MappedReferenceResolver;

    beforeEach(() => {
        mapping = new Map([
            ['alias', 'real-key']
        ]);
        delegate = new InMemoryResolver({ 'real-key': 'resolved-value', 'other': 'other-value' });
        resolver = new MappedReferenceResolver(mapping, delegate);
    });

    it('returns true if mapping exists and delegate can resolve', () => {
        expect(resolver.canResolve('alias')).toBe(true);
    });

    it('returns false if mapping does not exist and delegate cannot resolve', () => {
        expect(resolver.canResolve('missing')).toBe(false);
    });

    it('resolves mapped reference correctly', async () => {
        const result = await resolver.resolve('alias');
        expect(result).toBe('resolved-value');
    });

    it('resolves original reference if not mapped', async () => {
        const result = await resolver.resolve('other');
        expect(result).toBe('other-value');
    });

    it('throws error if delegate cannot resolve mapped reference', async () => {
        await expect(resolver.resolve('missing')).rejects.toThrow('Mocked reference not found: missing');
    });
});
