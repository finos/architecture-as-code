import {CalmControlDetailSchema, CalmControlsSchema} from '../types/control-types.js';

export class CalmControlDetail {
    constructor(
        public requirementUrl: string,
        public configUrl?: string,
        public config?: Record<string, unknown>
    ) {}

    static fromJson(data: CalmControlDetailSchema): CalmControlDetail {
        if ('config-url' in data) {
            return new CalmControlDetail(
                data['requirement-url'],
                data['config-url'],
                undefined
            );
        } else {
            return new CalmControlDetail(
                data['requirement-url'],
                undefined,
                data['config']
            );
        }
    }

}

export class CalmControl {
    constructor(
        public controlId: string,
        public description: string,
        public requirements: CalmControlDetail[]
    ) {}

    static fromJson(data: CalmControlsSchema): CalmControl[] {
        if(!data) return [];
        return Object.entries(data).map(([controlId, controlData]) =>
            new CalmControl(
                controlId,
                controlData.description,
                controlData.requirements.map(CalmControlDetail.fromJson)
            )
        );
    }

}