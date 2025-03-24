import { CalmMetadataSchema } from '../types/metadata-types.js';

export class CalmMetadata {
    constructor(public data: Record<string, unknown>) {}

    static fromJson(data: CalmMetadataSchema): CalmMetadata {
        if(!data) return new CalmMetadata({});

        const flattenedData = data.reduce((acc, curr) => {
            return { ...acc, ...curr };
        }, {} as Record<string, unknown>);

        return new CalmMetadata(flattenedData);
    }
}
