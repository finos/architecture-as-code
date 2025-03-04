/* eslint-disable  @typescript-eslint/no-explicit-any */
import {CalmTemplateTransformer} from '@finos/calm-shared';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class FailingTransformer implements CalmTemplateTransformer {

    registerTemplateHelpers(): Record<string, (...args: any[]) => any> {
        return {
            uppercase: (text: string) => text.toUpperCase(),
            lowercase: (text: string) => text.toLowerCase(),
        };
    }

     getTransformedModel(inputJson: string): any {
        console.log(inputJson);
        throw new Error('Fail!');
    }
}
