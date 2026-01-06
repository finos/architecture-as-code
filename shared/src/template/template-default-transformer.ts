import {CalmTemplateTransformer} from './types';
import {CalmCore} from '@finos/calm-models/model';

export default class TemplateDefaultTransformer implements CalmTemplateTransformer {

    getTransformedModel(calmCore: CalmCore) {
        const canonicalModel = calmCore.toCanonicalSchema();
        // The canonical model is spread at top level so widgets receive it directly.
        // The 'document' alias is included for backward compatibility with external templates.
        // TODO: Consider removing 'document' alias in future release - ask community if safe to remove.
        // Internal templates should use direct paths (e.g., 'nodes' instead of 'document.nodes').
        return {
            ...canonicalModel,
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
            kebabToTitleCase: (str: string) => {
                if (!str) return '';
                return str
                    .split('-')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
            },
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