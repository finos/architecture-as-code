import { CalmMetadataSchema } from '../types/metadata-types.js';

export class CalmMetadata {
    constructor(public data: Record<string, unknown>) {}

    static fromJson(data: CalmMetadataSchema): CalmMetadata {
        if(!data) return new CalmMetadata({});

        var flattenedData: Record<string, unknown> = {};
        if (Array.isArray(data)) {
            flattenedData = data.reduce((acc, curr) => {
                return { ...acc, ...curr };
            }, {} as Record<string, unknown>);
        } else {
            // If data is not an array, we assume it's a single object
            flattenedData = data;
        }

        return new CalmMetadata(flattenedData);
    }
}
