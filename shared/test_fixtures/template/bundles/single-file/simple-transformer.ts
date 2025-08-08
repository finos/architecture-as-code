/* eslint-disable  @typescript-eslint/no-explicit-any */
import {CalmTemplateTransformer} from '../../../../src/template/types';
import {CalmCore} from '../../../../src/model/core.js';

export default class SimpleTransformer implements CalmTemplateTransformer {

    registerTemplateHelpers(): Record<string, (...args: any[]) => any> {
        return {
            uppercase: (text: string) => text.toUpperCase(),
            lowercase: (text: string) => text.toLowerCase(),
        };
    }

    getTransformedModel(architecture: CalmCore): any {

        return {
            document: architecture.toSchema()
        };

    }
}
