import { Resolvable } from './resolvable.js';
import {CalmAdaptable} from './adaptable.js';
import {CalmControlDetailSchema, CalmControlSchema, CalmControlsSchema} from '../types';
import {
    CalmControlCanonicalModel,
    CalmControlDetailCanonicalModel,
    CalmControlsCanonicalModel
} from '../canonical/template-models.js';

export class CalmControlDetail implements CalmAdaptable<CalmControlDetailSchema, CalmControlDetailCanonicalModel> {
    constructor(
        public originalJson: CalmControlDetailSchema,
        public requirement: Resolvable<Record<string, unknown>>,
        public configUrl?: Resolvable<Record<string, unknown>>,
        public config?: Record<string, unknown>
    ) {}

    toCanonicalSchema(): CalmControlDetailCanonicalModel {
        const config = (this.configUrl && this.configUrl.isResolved) ? this.configUrl.value : this.config;
        return {
            'requirement-url': this.requirement.reference,
            ...config
        };
    }

    static fromSchema(schema: CalmControlDetailSchema): CalmControlDetail {
        const controlRequirement = new Resolvable<Record<string, unknown>>(schema['requirement-url']);
        if ('config-url' in schema) {
            return new CalmControlDetail(schema, controlRequirement, new Resolvable(schema['config-url']));
        } else {
            return new CalmControlDetail(schema, controlRequirement, undefined, schema.config);
        }
    }

    toSchema(): CalmControlDetailSchema {
        return this.originalJson;
    }
}

export class CalmControl implements CalmAdaptable<CalmControlSchema, CalmControlCanonicalModel> {
    constructor(
        public originalJson: CalmControlSchema,
        public description: string,
        public requirements: CalmControlDetail[]
    ) {}

    toCanonicalSchema(): CalmControlCanonicalModel {
        return {
            description: this.description,
            requirements: this.requirements.map(req => req.toCanonicalSchema())
        };
    }

    static fromSchema(schema: CalmControlSchema): CalmControl {
        const requirements = (schema.requirements || []).map(CalmControlDetail.fromSchema);
        return new CalmControl(schema, schema.description, requirements);
    }

    toSchema(): CalmControlSchema {
        return this.originalJson;
    }
}

export class CalmControls implements CalmAdaptable<CalmControlsSchema, CalmControlsCanonicalModel> {
    constructor(
        public originalJson: CalmControlsSchema,
        public data: Record<string, CalmControl>
    ) {}

    toCanonicalSchema(): CalmControlsCanonicalModel {
        return Object.fromEntries(
            Object.entries(this.data).map(([key, control]) => [key, control.toCanonicalSchema()])
        );
    }


    static fromSchema(schema: CalmControlsSchema): CalmControls {
        const controls: Record<string, CalmControl> = {};
        for (const [controlId, controlSchema] of Object.entries(schema)) {
            controls[controlId] = CalmControl.fromSchema(controlSchema);
        }
        return new CalmControls(schema, controls);
    }

    toSchema(): CalmControlsSchema {
        return this.originalJson;
    }
}
