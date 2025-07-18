import { CalmMetadata } from './metadata.js';
import { CalmMetadataSchema } from '../types/metadata-types.js';

const metadataData: CalmMetadataSchema = [
    { key1: 'value1', key2: 'value2' },
    { key3: 'value3', key4: 'value4' }
];

describe('CalmMetadata', () => {
    it('should create a CalmMetadata instance from JSON data', () => {
        const metadata = CalmMetadata.fromJson(metadataData);

        expect(metadata).toBeInstanceOf(CalmMetadata);
        expect(metadata.data).toEqual({
            key1: 'value1',
            key2: 'value2',
            key3: 'value3',
            key4: 'value4'
        });
    });

    it('should flatten metadata correctly when there are multiple entries', () => {
        const metadata = CalmMetadata.fromJson(metadataData);

        expect(metadata.data).toEqual({
            key1: 'value1',
            key2: 'value2',
            key3: 'value3',
            key4: 'value4'
        });
    });

    it('should handle empty metadata array', () => {
        const metadata = CalmMetadata.fromJson([]);

        expect(metadata).toBeInstanceOf(CalmMetadata);
        expect(metadata.data).toEqual({});
    });

    it('should handle single metadata entry', () => {
        const singleMetadata: CalmMetadataSchema = [{ key1: 'value1' }];
        const metadata = CalmMetadata.fromJson(singleMetadata);

        expect(metadata).toBeInstanceOf(CalmMetadata);
        expect(metadata.data).toEqual({
            key1: 'value1'
        });
    });

    it('should handle single metadata object', () => {
        const singleMetadata: CalmMetadataSchema = { key1: 'value1', key2: 'value2' };
        const metadata = CalmMetadata.fromJson(singleMetadata);

        expect(metadata).toBeInstanceOf(CalmMetadata);
        expect(metadata.data).toEqual({
            key1: 'value1',
            key2: 'value2'
        });
    });
});
