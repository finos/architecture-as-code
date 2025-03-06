import {CalmControlDetailSchema, CalmControlsSchema} from '../types/control-types.js';

export class CalmControlDetail {
    constructor(
        public controlRequirementUrl: string,
        public controlConfigUrl: string
    ) {}

    static fromJson(data: CalmControlDetailSchema): CalmControlDetail {
        return new CalmControlDetail(
            data['control-requirement-url'],
            data['control-config-url']
        );
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