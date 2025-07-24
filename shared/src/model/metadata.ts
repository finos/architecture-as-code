import { CalmMetadataSchema } from '../types/metadata-types.js';

export class CalmMetadata {
    constructor(public data: Record<string, unknown>) {}

    static fromJson(data: CalmMetadataSchema): CalmMetadata {
        if (!data) return new CalmMetadata({});

        if (Array.isArray(data)) {
            const flattenedData = data.reduce(
                (acc, curr) => ({ ...acc, ...curr }),
                {} as Record<string, unknown>
            );
            return new CalmMetadata(flattenedData);
        } else {
            return new CalmMetadata(data);
        }
    }
}
