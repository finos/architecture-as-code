import { CalmMetadata } from './metadata.js';
import { CalmMetadataSchema } from '../types/metadata-types.js';

const metadataDataAsArray: CalmMetadataSchema = [
    { key1: 'value1', key2: 'value2' },
    { key3: 'value3', key4: 'value4' }
];

// CALM schema 1.0-rc2 introduced metadata as an object.
const metadataDataAsObject: CalmMetadataSchema = {
    key1: 'value1',
    key2: 'value2',
    key3: 'value3'
};

describe('CalmMetadata', () => {
    it('should create a CalmMetadata instance from JSON data', () => {
        const metadata = CalmMetadata.fromJson(metadataDataAsArray);

        expect(metadata).toBeInstanceOf(CalmMetadata);
        expect(metadata.data).toEqual({
            key1: 'value1',
            key2: 'value2',
            key3: 'value3',
            key4: 'value4'
        });
    });

    it('should flatten metadata correctly when there are multiple entries', () => {
        const metadata = CalmMetadata.fromJson(metadataDataAsArray);

        expect(metadata.data).toEqual({
            key1: 'value1',
            key2: 'value2',
            key3: 'value3',
            key4: 'value4'
        });
    });

    it('should flatten metadata in order when there are duplicate keys', () => {
        const metadata = CalmMetadata.fromJson([
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
        const metadata = CalmMetadata.fromJson([]);

        expect(metadata).toBeInstanceOf(CalmMetadata);
        expect(metadata.data).toEqual({});
    });

    it('should handle single metadata array entry', () => {
        const singleMetadata: CalmMetadataSchema = [{ key1: 'value1' }];
        const metadata = CalmMetadata.fromJson(singleMetadata);

        expect(metadata).toBeInstanceOf(CalmMetadata);
        expect(metadata.data).toEqual({
            key1: 'value1'
        });
    });

    it('should handle empty metadata object', () => {
        const metadata = CalmMetadata.fromJson({});

        expect(metadata).toBeInstanceOf(CalmMetadata);
        expect(metadata.data).toEqual({});
    });

    it('should handle metadata object with 1 property', () => {
        const metadata = CalmMetadata.fromJson({ key1: 'value1' });

        expect(metadata).toBeInstanceOf(CalmMetadata);
        expect(metadata.data).toEqual({
            key1: 'value1'
        });
    });

    it('should handle metadata object with many properties', () => {
        const metadata = CalmMetadata.fromJson(metadataDataAsObject);

        expect(metadata).toBeInstanceOf(CalmMetadata);
        expect(metadata.data).toEqual({
            key1: 'value1',
            key2: 'value2',
            key3: 'value3'
        });
    });
});
