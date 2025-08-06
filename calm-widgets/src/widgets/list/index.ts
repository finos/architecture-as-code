import { CalmWidget } from '../../types';

export const ListWidget: CalmWidget<
    Array<string | Record<string, unknown>>,
    { ordered?: boolean; property?: string },
    { items: Array<string>; ordered: boolean }
> = {
    id: 'list',
    templatePartial: 'list-template.html',

    transformToViewModel: (context, options) => {
        const hash = options?.hash ?? {};
        const ordered = Boolean(hash.ordered);
        const property = typeof hash.property === 'string' ? hash.property : undefined;

        const cleanItems = context
            .map(item => {
                if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                    const cleaned = Object.fromEntries(
                        Object.entries(item).filter(([_, v]) => v !== undefined)
                    );

                    if (property) {
                        if (!(property in cleaned)) return undefined;
                        const val = cleaned[property];
                        if (val === undefined || val === null) return undefined;
                        if (typeof val === 'string') return val;
                        if (typeof val === 'number' || typeof val === 'boolean') return val.toString();
                        if (typeof val === 'object') return undefined;
                        return String(val);
                    }

                    return Object.entries(cleaned)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(', ');
                }

                if (typeof item === 'string') return item;

                return undefined;
            })
            .filter((item): item is string => typeof item === 'string' && item.length > 0);

        return {
            items: cleanItems,
            ordered,
        };
    },
    validateContext: (context): context is Array<string | Record<string, unknown>> => {
        return (
            Array.isArray(context) &&
            context.every(
                item =>
                    typeof item === 'string' ||
                    (typeof item === 'object' && item !== null && !Array.isArray(item))
            )
        );
    },
};
