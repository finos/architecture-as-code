import { CalmWidget } from '../../types';

export const TableWidget: CalmWidget<
    Array<Record<string, unknown>> | Record<string, unknown>,
    { key?: string; headers?: boolean; columns?: string },
    {
        headers: boolean;
        rows: Array<{ id: string; data: Record<string, unknown> }>;
        flatTable?: boolean;
        columnNames?: string[];
    }
> = {
    id: 'table',
    templatePartial: 'table-template.html',
    partials: ['row-template.html'],

    transformToViewModel: (context, options) => {
        const hash = options?.hash ?? {};
        const key = typeof hash.key === 'string' ? hash.key : 'unique-id';
        const columnList = typeof hash.columns === 'string'
            ? hash.columns.split(',').map(col => col.trim()).filter(Boolean)
            : undefined;

        // Determine if we should render as flat table or nested
        const flatTable = columnList !== undefined;

        let entries: Array<Record<string, unknown>>;

        if (Array.isArray(context)) {
            entries = context;
        } else if (typeof context === 'object' && context !== null && !Array.isArray(context)) {
            // For objects, convert to array of entries with the key as the specified key field
            entries = Object.entries(context).map(([id, value]) => {
                const val = typeof value === 'object' && value !== null && !Array.isArray(value)
                    ? { ...value, [key]: id }
                    : { value, [key]: id };
                return val;
            });
        } else {
            throw new Error('Unsupported context format for table widget');
        }

        const rows = entries
            .filter((item): item is Record<string, unknown> => {
                // For arrays, don't filter by key - just ensure it's a valid object
                if (Array.isArray(context)) {
                    return typeof item === 'object' && item !== null && !Array.isArray(item);
                }
                // For objects/records, filter by key as before
                const id = item?.[key];
                return typeof id === 'string' && id.trim() !== '';
            })
            .map((item, index) => {
                // For arrays, use index as fallback ID if no key field exists
                let id: string;
                if (Array.isArray(context)) {
                    const keyValue = item?.[key];
                    id = typeof keyValue === 'string' && keyValue.trim() !== ''
                        ? keyValue
                        : index.toString();
                } else {
                    id = item[key] as string;
                }

                const cleaned = Object.fromEntries(
                    Object.entries(item).filter(([_, value]) => value !== undefined)
                );

                const selectedData = columnList
                    ? Object.fromEntries(
                        columnList.map(col => [col, cleaned[col]])
                    )
                    : cleaned;

                return {
                    id,
                    data: selectedData
                };
            });

        return {
            headers: hash.headers !== false,
            rows,
            flatTable,
            columnNames: columnList
        };
    },

    validateContext: (context): context is Array<Record<string, unknown>> | Record<string, unknown> => {
        return (
            (Array.isArray(context) &&
                context.every(item => typeof item === 'object' && item !== null && !Array.isArray(item))) ||
            (typeof context === 'object' && context !== null && !Array.isArray(context))
        );
    },

    registerHelpers: () => ({
        objectEntries: (obj: unknown) => {
            if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return [];
            return Object.entries(obj).map(([id, data]) => ({ id, data }));
        }
    })
};
