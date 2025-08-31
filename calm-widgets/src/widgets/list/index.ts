import { CalmWidget } from '../../types';

type ListItem = string | Record<string, unknown>;
type ListOptions = { ordered?: boolean; property?: string };
type ListViewModel = { items: string[]; ordered: boolean };

export const ListWidget: CalmWidget<ListItem[], ListOptions, ListViewModel> = {
    id: 'list',
    templatePartial: 'list-template.html',

    transformToViewModel: (context, options) => {
        const { ordered = false, property } = options ?? {};

        const items = context
            .map((item) => {
                if (typeof item === 'string') return item;

                if (item && typeof item === 'object' && !Array.isArray(item)) {
                    const cleaned = Object.fromEntries(
                        Object.entries(item).filter(([, v]) => v !== undefined)
                    );

                    if (property) {
                        if (!(property in cleaned)) return undefined;
                        const val = cleaned[property];

                        if (val == null) return undefined;
                        if (typeof val === 'string') return val;
                        if (typeof val === 'number' || typeof val === 'boolean') return String(val);
                        if (typeof val === 'object') return undefined;

                        return String(val);
                    }

                    return Object.entries(cleaned)
                        .map(([k, v]) => `${k}: ${v as unknown as string}`)
                        .join(', ');
                }

                return undefined;
            })
            .filter((v): v is string => typeof v === 'string' && v.length > 0);

        return { items, ordered };
    },

    validateContext: (context): context is ListItem[] => {
        return (
            Array.isArray(context) &&
            context.every(
                (item) =>
                    typeof item === 'string' ||
                    (item !== null && typeof item === 'object' && !Array.isArray(item))
            )
        );
    },
};
