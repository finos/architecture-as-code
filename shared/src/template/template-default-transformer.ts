import {CalmTemplateTransformer} from './types';
import {CalmCore} from '@finos/calm-models/model';

export default class TemplateDefaultTransformer implements CalmTemplateTransformer {

    getTransformedModel(calmCore: CalmCore) {
        const canonicalModel = calmCore.toCanonicalSchema();
        return {
            'document': canonicalModel
        };

    }

    registerTemplateHelpers(): Record<string, (...args: unknown[]) => unknown> {
        // TODO: if this is the default transformer even used by docify then this will clash with widget helpers.
        // Move these out in subsequent PR

        return {
            eq: (a, b) => a === b,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            lookup: (obj, key: any) => obj?.[key],
            json: (obj) => JSON.stringify(obj, null, 2),
            instanceOf: (value, className: string) => value?.constructor?.name === className,
            kebabToTitleCase: (str: string) => str
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' '),
            kebabCase: (str: string) => str
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric characters with hyphens
                .replace(/^-+|-+$/g, ''), // Remove leading or trailing hyphens
            isObject: (value: unknown) => typeof value === 'object' && value !== null && !Array.isArray(value),
            isArray: (value: unknown) => Array.isArray(value),
            join: (arr: unknown[], separator:string = ', ') =>
                Array.isArray(arr) ? arr.join(separator) : '',
        };
    }

}