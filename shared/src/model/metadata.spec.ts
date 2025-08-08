import { CalmMetadata } from './metadata';
import { CalmMetadataSchema } from '../types/metadata-types.js';

const metadataArray: CalmMetadataSchema = [
    { key1: 'value1', key2: 'value2', nested: { a: 1, b: 2 } },
    { key3: 'value3', key4: 'value4', nested: { c: 3 } }
];

const metadataObject: CalmMetadataSchema = {
    key1: 'value1',
    key2: 'value2',
    key3: 'value3',
    nested: { a: 1, b: 2, c: 3 }
};

describe('CalmMetadata', () => {
    it('should create a CalmMetadata instance from array schema', () => {
        const metadata = CalmMetadata.fromSchema(metadataArray);
        expect(metadata).toBeInstanceOf(CalmMetadata);
        expect(metadata.originalJson).toEqual(metadataArray);
        expect(metadata.data).toEqual({
            key1: 'value1',
            key2: 'value2',
            key3: 'value3',
            key4: 'value4',
            nested: { c: 3 }
        });
    });

    it('should create a CalmMetadata instance from object schema', () => {
        const metadata = CalmMetadata.fromSchema(metadataObject);
        expect(metadata).toBeInstanceOf(CalmMetadata);
        expect(metadata.originalJson).toEqual(metadataObject);
        expect(metadata.data).toEqual({
            key1: 'value1',
            key2: 'value2',
            key3: 'value3',
            nested: { a: 1, b: 2, c: 3 }
        });
    });

    it('should flatten metadata in order when there are duplicate keys', () => {
        const metadata = CalmMetadata.fromSchema([
            { key1: 'value1', key2: 'value2a' },
            { key2: 'value2b', key4: 'value4' }
        ]);
        expect(metadata.data).toEqual({
            key1: 'value1',
            key2: 'value2b',
            key4: 'value4'
        });
    });

    it('should handle empty metadata array', () => {
        const metadata = CalmMetadata.fromSchema([]);
        expect(metadata).toBeInstanceOf(CalmMetadata);
        expect(metadata.originalJson).toEqual([]);
        expect(metadata.data).toEqual({});
    });

    it('should handle single metadata array entry', () => {
        const singleMetadata: CalmMetadataSchema = [{ key1: 'value1' }];
        const metadata = CalmMetadata.fromSchema(singleMetadata);
        expect(metadata).toBeInstanceOf(CalmMetadata);
        expect(metadata.originalJson).toEqual(singleMetadata);
        expect(metadata.data).toEqual({ key1: 'value1' });
    });

    it('should handle empty metadata object', () => {
        const metadata = CalmMetadata.fromSchema({});
        expect(metadata).toBeInstanceOf(CalmMetadata);
        expect(metadata.originalJson).toEqual({});
        expect(metadata.data).toEqual({});
    });

    it('should handle metadata object with 1 property', () => {
        const metadata = CalmMetadata.fromSchema({ key1: 'value1' });
        expect(metadata).toBeInstanceOf(CalmMetadata);
        expect(metadata.originalJson).toEqual({ key1: 'value1' });
        expect(metadata.data).toEqual({ key1: 'value1' });
    });

    it('should handle metadata object with many properties', () => {
        const metadata = CalmMetadata.fromSchema(metadataObject);
        expect(metadata).toBeInstanceOf(CalmMetadata);
        expect(metadata.originalJson).toEqual(metadataObject);
        expect(metadata.data).toEqual({
            key1: 'value1',
            key2: 'value2',
            key3: 'value3',
            nested: { a: 1, b: 2, c: 3 }
        });
    });

    it('should return the original schema with toSchema()', () => {
        const metadata = CalmMetadata.fromSchema(metadataArray);
        expect(metadata.toSchema()).toEqual(metadataArray);
    });

    it('should return the canonical model with toCanonicalSchema()', () => {
        const metadata = CalmMetadata.fromSchema(metadataArray);
        expect(metadata.toCanonicalSchema()).toEqual({
            key1: 'value1',
            key2: 'value2',
            key3: 'value3',
            key4: 'value4',
            nested: { c: 3 }
        });
    });
});
