/* eslint-disable  @typescript-eslint/no-explicit-any */
import {CalmTemplateTransformer} from '../../../../src/template/types';
import {CalmCore} from '../../../../src/model/core.js';

export default class DerefTransformer implements CalmTemplateTransformer {
    registerTemplateHelpers() {
        return {};
    }

    getTransformedModel(architecture: CalmCore): any {
        const parsed = architecture.toCanonicalSchema();
        return { document: parsed };
    }
}
