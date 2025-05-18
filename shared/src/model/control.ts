import {CalmControlDetailSchema, CalmControlsSchema} from '../types/control-types.js';

export class CalmControlDetail {
    constructor(
        public controlRequirementUrl: string,
        public controlConfigUrl?: string,
        public controlConfig?: Record<string, unknown>
    ) {}

    static fromJson(data: CalmControlDetailSchema): CalmControlDetail {
        if ('control-config-url' in data) {
            // old‐style URL config
            return new CalmControlDetail(
                data['control-requirement-url'],
                data['control-config-url'],
                undefined
            );
        } else {
            // new‐style full config object
            return new CalmControlDetail(
                data['control-requirement-url'],
                undefined,
                data['control-config']
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