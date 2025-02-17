/* eslint-disable  @typescript-eslint/no-explicit-any */
import {CalmTemplateTransformer} from '@finos/calm-shared';

export default class SimpleTransformer implements CalmTemplateTransformer {

    registerTemplateHelpers(): Record<string, (...args: any[]) => any> {
        return {
            uppercase: (text: string) => text.toUpperCase(),
            lowercase: (text: string) => text.toLowerCase(),
        };
    }

    getTransformedModel(inputJson: string): any {
        return {
            document: JSON.parse(inputJson)
        };

    }
}
