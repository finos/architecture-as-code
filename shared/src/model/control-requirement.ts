import {CalmControlRequirementSchema} from '../types/control-requirement-types.js';

export class CalmControlRequirement {
    constructor(
        public controlId: string,
        public name: string,
        public description: string
    ) {}

    static fromJson(data: CalmControlRequirementSchema): CalmControlRequirement {
        return new CalmControlRequirement(
            data['control-id'],
            data['name'],
            data['description']
        );
    }
}
