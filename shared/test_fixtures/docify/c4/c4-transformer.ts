import {CalmTemplateTransformer} from '../../../src/template/types';
import {CalmCore} from '../../../src/model/core.js';
import { C4Model } from '../../../src/docify/graphing/c4';

/**
 * Transformer that converts CALM models to C4 model format for C4 templates
 */
export class C4Transformer implements CalmTemplateTransformer {
    public getTransformedModel(calmCore: CalmCore): any {
        const c4Model = new C4Model(calmCore);

        const scenario = calmCore.metadata?.data.scenario;

        return {
            document: {
                id: scenario,
                C4model: {
                    elements: c4Model.elements,
                    relationships: c4Model.relationships
                }
            }
        };
    }

    registerTemplateHelpers() {
        return {
            eq: (a, b) => a === b,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            lookup: (obj, key: any) => obj?.[key]
        };
    }
}

export default C4Transformer;
