/* eslint-disable  @typescript-eslint/no-explicit-any */
import {CalmTemplateTransformer} from '../../../../src/template/types';
import {CalmCore} from '../../../../src/model/core.js';

export class CalmTransformer implements CalmTemplateTransformer {
    registerTemplateHelpers(): Record<string, (...args: any[]) => any> {
        return {
            uppercase: (text: string) => text.toUpperCase()
        };
    }

    getTransformedModel(architecture: CalmCore): any {
        const parsed = architecture.toCanonicalSchema();

        return {
            document: {
                nodes: parsed.nodes || []
            }
        };
    }
}

export default CalmTransformer;
