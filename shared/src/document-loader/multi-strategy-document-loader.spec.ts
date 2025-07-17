import { describe, it, expect, vi } from 'vitest';
import { MultiStrategyDocumentLoader } from './multi-strategy-document-loader';
import { DocumentLoader } from './document-loader';
import { SchemaDirectory } from '../schema-directory';

describe('MultiStrategyDocumentLoader', () => {
    it('throws error if constructed with empty array', () => {
        expect(() => new MultiStrategyDocumentLoader([])).toThrow();
    });

    it('calls initialise on each loader', async () => {
        const mockLoader1: DocumentLoader = {
            initialise: vi.fn().mockResolvedValue(undefined),
            loadMissingDocument: vi.fn()
        };
        const mockLoader2: DocumentLoader = {
            initialise: vi.fn().mockResolvedValue(undefined),
            loadMissingDocument: vi.fn()
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
            loadMissingDocument: vi.fn().mockRejectedValue(error)
        };
        const mockLoader2: DocumentLoader = {
            initialise: vi.fn(),
            loadMissingDocument: vi.fn().mockResolvedValue({ foo: 'bar' })
        };
        const multi = new MultiStrategyDocumentLoader([mockLoader1, mockLoader2]);
        const result = await multi.loadMissingDocument('id', 'schema');
        expect(result).toEqual({ foo: 'bar' });
        expect(mockLoader1.loadMissingDocument).toHaveBeenCalled();
        expect(mockLoader2.loadMissingDocument).toHaveBeenCalled();
    });

    it('throws if all loaders fail', async () => {
        const error1 = new Error('fail1');
        const error2 = new Error('fail2');
        const mockLoader1: DocumentLoader = {
            initialise: vi.fn(),
            loadMissingDocument: vi.fn().mockRejectedValue(error1)
        };
        const mockLoader2: DocumentLoader = {
            initialise: vi.fn(),
            loadMissingDocument: vi.fn().mockRejectedValue(error2)
        };
        const multi = new MultiStrategyDocumentLoader([mockLoader1, mockLoader2]);
        await expect(multi.loadMissingDocument('id', 'schema')).rejects.toThrow();
    });
});
