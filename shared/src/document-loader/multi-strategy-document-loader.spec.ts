import { describe, it, expect, vi } from 'vitest';
import { MultiStrategyDocumentLoader } from './multi-strategy-document-loader';
import { DocumentLoader, DocumentLoadError } from './document-loader';
import { SchemaDirectory } from '../schema-directory';

describe('MultiStrategyDocumentLoader', () => {
    it('throws error if constructed with empty array', () => {
        expect(() => new MultiStrategyDocumentLoader([])).toThrow();
    });

    it('calls initialise on each loader', async () => {
        const mockLoader1: DocumentLoader = {
            initialise: vi.fn().mockResolvedValue(undefined),
            loadMissingDocument: vi.fn(),
            resolvePath: vi.fn()
        };
        const mockLoader2: DocumentLoader = {
            initialise: vi.fn().mockResolvedValue(undefined),
            loadMissingDocument: vi.fn(),
            resolvePath: vi.fn()
        };
        const multi = new MultiStrategyDocumentLoader([mockLoader1, mockLoader2]);
        const schemaDir = {} as SchemaDirectory;
        await multi.initialise(schemaDir);
        expect(mockLoader1.initialise).toHaveBeenCalledWith(schemaDir);
        expect(mockLoader2.initialise).toHaveBeenCalledWith(schemaDir);
    });

    it('falls back to next loader if the first one fails', async () => {
        const error = new Error('fail');
        const mockLoader1: DocumentLoader = {
            initialise: vi.fn(),
            loadMissingDocument: vi.fn().mockRejectedValue(error),
            resolvePath: vi.fn()
        };
        const mockLoader2: DocumentLoader = {
            initialise: vi.fn(),
            loadMissingDocument: vi.fn().mockResolvedValue({ foo: 'bar' }),
            resolvePath: vi.fn()
        };
        const multi = new MultiStrategyDocumentLoader([mockLoader1, mockLoader2]);
        const result = await multi.loadMissingDocument('id', 'schema');
        expect(result).toEqual({ foo: 'bar' });
        expect(mockLoader1.loadMissingDocument).toHaveBeenCalled();
        expect(mockLoader2.loadMissingDocument).toHaveBeenCalled();
    });

    it('surfaces a fatal (non-recoverable) error immediately without trying later loaders', async () => {
        const fatalError = new DocumentLoadError({
            name: 'UNKNOWN',
            message: 'Expected a JSON object from calm:/foo but received: string',
            recoverable: false
        });
        const mockLoader1: DocumentLoader = {
            initialise: vi.fn(),
            loadMissingDocument: vi.fn().mockRejectedValue(fatalError),
            resolvePath: vi.fn()
        };
        const mockLoader2: DocumentLoader = {
            initialise: vi.fn(),
            loadMissingDocument: vi.fn().mockResolvedValue({ foo: 'bar' }),
            resolvePath: vi.fn()
        };
        const multi = new MultiStrategyDocumentLoader([mockLoader1, mockLoader2]);

        await expect(multi.loadMissingDocument('calm:/foo', 'schema'))
            .rejects.toThrow('Expected a JSON object from calm:/foo but received: string');
        expect(mockLoader1.loadMissingDocument).toHaveBeenCalled();
        // The fatal error must not be masked by a later loader.
        expect(mockLoader2.loadMissingDocument).not.toHaveBeenCalled();
    });

    it('falls through recoverable errors but stops at the first fatal error', async () => {
        const recoverableError = new DocumentLoadError({
            name: 'OPERATION_NOT_IMPLEMENTED',
            message: 'not mine'
        });
        const fatalError = new DocumentLoadError({
            name: 'UNKNOWN',
            message: 'fetched but invalid',
            recoverable: false
        });
        const mockLoader1: DocumentLoader = {
            initialise: vi.fn(),
            loadMissingDocument: vi.fn().mockRejectedValue(recoverableError),
            resolvePath: vi.fn()
        };
        const mockLoader2: DocumentLoader = {
            initialise: vi.fn(),
            loadMissingDocument: vi.fn().mockRejectedValue(fatalError),
            resolvePath: vi.fn()
        };
        const mockLoader3: DocumentLoader = {
            initialise: vi.fn(),
            loadMissingDocument: vi.fn().mockResolvedValue({ foo: 'bar' }),
            resolvePath: vi.fn()
        };
        const multi = new MultiStrategyDocumentLoader([mockLoader1, mockLoader2, mockLoader3]);

        await expect(multi.loadMissingDocument('id', 'schema')).rejects.toThrow('fetched but invalid');
        expect(mockLoader1.loadMissingDocument).toHaveBeenCalled();
        expect(mockLoader2.loadMissingDocument).toHaveBeenCalled();
        expect(mockLoader3.loadMissingDocument).not.toHaveBeenCalled();
    });

    it('throws if all loaders fail', async () => {
        const error1 = new Error('fail1');
        const error2 = new Error('fail2');
        const mockLoader1: DocumentLoader = {
            initialise: vi.fn(),
            loadMissingDocument: vi.fn().mockRejectedValue(error1),
            resolvePath: vi.fn()
        };
        const mockLoader2: DocumentLoader = {
            initialise: vi.fn(),
            loadMissingDocument: vi.fn().mockRejectedValue(error2),
            resolvePath: vi.fn()
        };
        const multi = new MultiStrategyDocumentLoader([mockLoader1, mockLoader2]);
        await expect(multi.loadMissingDocument('id', 'schema')).rejects.toThrow();
    });

    describe('resolvePath', () => {
        it('returns path from first loader that resolves it', () => {
            const mockLoader1: DocumentLoader = {
                initialise: vi.fn(),
                loadMissingDocument: vi.fn(),
                resolvePath: vi.fn().mockReturnValue(undefined)
            };
            const mockLoader2: DocumentLoader = {
                initialise: vi.fn(),
                loadMissingDocument: vi.fn(),
                resolvePath: vi.fn().mockReturnValue('/resolved/path')
            };
            
            const multi = new MultiStrategyDocumentLoader([mockLoader1, mockLoader2]);
            const result = multi.resolvePath('ref');
            
            expect(result).toBe('/resolved/path');
            expect(mockLoader1.resolvePath).toHaveBeenCalledWith('ref');
            expect(mockLoader2.resolvePath).toHaveBeenCalledWith('ref');
        });

        it('returns undefined if no loader resolves path', () => {
            const mockLoader1: DocumentLoader = {
                initialise: vi.fn(),
                loadMissingDocument: vi.fn(),
                resolvePath: vi.fn().mockReturnValue(undefined)
            };
            
            const multi = new MultiStrategyDocumentLoader([mockLoader1]);
            const result = multi.resolvePath('ref');
            
            expect(result).toBeUndefined();
        });
    });
});
