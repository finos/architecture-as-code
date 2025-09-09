export function registerGlobalTemplateHelpers(): Record<string, (...args: unknown[]) => unknown> {
    return {
        eq: (a: unknown, b: unknown): boolean => a === b,
        ne: (a: unknown, b: unknown): boolean => a !== b,
        currentTimestamp: (): string => new Date().toISOString(),
        currentDate: (): string => new Date().toISOString().split('T')[0],
        lookup: (obj: unknown, key: unknown): unknown => {
            if (obj && (typeof key === 'string' || typeof key === 'number')) {
                return (obj as Record<string | number, unknown>)[key];
            }
            return undefined;
        },
        json: (obj: unknown): string => JSON.stringify(obj, null, 2),
        instanceOf: (value: unknown, className: unknown): boolean =>
            typeof className === 'string' &&
            typeof value === 'object' &&
            value !== null &&
            'constructor' in value &&
            (value as { constructor: { name: string } }).constructor.name === className,

        kebabToTitleCase: (str: unknown): string => {
            if (typeof str !== 'string') return '';
            return str
                .split('-')
                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
        },

        kebabCase: (str: unknown): string => {
            if (typeof str !== 'string') return '';
            return str
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
        },

        isObject: (value: unknown): boolean =>
            typeof value === 'object' && value !== undefined && value !== null && !Array.isArray(value),

        isArray: (value: unknown): boolean => Array.isArray(value),

        notEmpty: (value: unknown): boolean => {
            if (value == null) return false;
            if (Array.isArray(value)) return value.length > 0;
            if (typeof value === 'object') {
                if (value instanceof Map || value instanceof Set) return value.size > 0;
                return Object.keys(value).length > 0;
            }
            if (typeof value === 'string') return value.trim().length > 0;
            return Boolean(value);
        },

        or: (...args: unknown[]): boolean => {
            const maybeOptions = args[args.length - 1];

            const isHandlebarsOptions = (obj: unknown): obj is { fn: (...args: unknown[]) => unknown } =>
                typeof obj === 'object' &&
                obj !== null &&
                'fn' in obj &&
                typeof (obj as { fn: unknown }).fn === 'function';

            const actualArgs = isHandlebarsOptions(maybeOptions) ? args.slice(0, -1) : args;

            return actualArgs.some(Boolean);
        },

        length: (value: unknown): number => {
            if (Array.isArray(value) || typeof value === 'string') return value.length;
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                return Object.keys(value).length;
            }
            return 0;
        },

        gt: (a: unknown, b: unknown): boolean => {
            const an = typeof a === 'number' ? a : Number(a);
            const bn = typeof b === 'number' ? b : Number(b);
            return an > bn;
        },

        eachInMap: (map: unknown, options: unknown): string => {
            let result = '';
            if (
                typeof map === 'object' &&
                map !== null &&
                typeof options === 'object' &&
                options !== null &&
                'fn' in options &&
                typeof (options as Record<string, unknown>).fn === 'function'
            ) {
                const fn = (options as { fn: (context: unknown) => string }).fn;
                for (const key in map as Record<string, unknown>) {
                    if (Object.prototype.hasOwnProperty.call(map, key)) {
                        const value = (map as Record<string, unknown>)[key];
                        const context: Record<string, unknown> =
                            typeof value === 'object' && value !== null
                                ? { ...value, key }
                                : { key };
                        result += fn(context);
                    }
                }
            }
            return result;
        },
    };
}
