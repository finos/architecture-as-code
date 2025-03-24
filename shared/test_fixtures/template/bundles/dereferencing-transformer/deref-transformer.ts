/* eslint-disable  @typescript-eslint/no-explicit-any */
import { CalmTemplateTransformer } from '@finos/calm-shared';

export default class DerefTransformer implements CalmTemplateTransformer {
    registerTemplateHelpers() {
        return {};
    }
    getTransformedModel(doc: string): any {
        const parsed = JSON.parse(doc);
        return { document: parsed };
    }
}
