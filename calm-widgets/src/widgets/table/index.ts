import { CalmWidget } from '../../types';

type TableContext = Array<Record<string, unknown>> | Record<string, unknown>;

type TableOptions = {
    key?: string;
    headers?: boolean;
    columns?: string;
    orientation?: 'horizontal' | 'vertical';
};

type TableRow = { id: string; data: Record<string, unknown> };

type TableViewModel = {
    headers: boolean;
    rows: TableRow[];
    flatTable?: boolean;
    columnNames?: string[];
    isVertical?: boolean;
};

function isPlainRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export const TableWidget: CalmWidget<TableContext, TableOptions, TableViewModel> = {
    id: 'table',
    templatePartial: 'table-template.html',
    partials: ['row-template.html', 'table-horizontal.html', 'table-vertical.html'],

    transformToViewModel: (context, options) => {
        const {
            key = 'unique-id',
            headers = true,
            columns,
            orientation = 'horizontal',
        } = options ?? {};

        const isVertical = orientation === 'vertical';

        let columnNames: string[] | undefined =
            typeof columns === 'string'
                ? columns.split(',').map(c => c.trim()).filter(Boolean)
                : undefined;

        let flatTable: boolean;
        let entries: Array<Record<string, unknown>>;

        if (Array.isArray(context)) {
            entries = context;
            flatTable = columnNames !== undefined;
        } else if (isPlainRecord(context)) {
            const obj: Record<string, unknown> = context;
            const canSingleRowWithColumns =
                !!columnNames && columnNames.every(col => Object.prototype.hasOwnProperty.call(obj, col));

            if (canSingleRowWithColumns || isVertical) {
                flatTable = !!columnNames;
                entries = columnNames
                    ? [Object.fromEntries(columnNames.map(col => [col, obj[col]]))]
                    : [obj];
            } else {
                flatTable = false;
                entries = Object.entries(obj).map(([propKey, value]) =>
                    isPlainRecord(value) ? { ...value, [key]: propKey } : { value, [key]: propKey }
                );
            }
        } else {
            throw new Error('Unsupported context format for table widget');
        }

        const rows: TableRow[] = entries
            .filter(isPlainRecord)
            .map((item, index) => {
                const rec: Record<string, unknown> = item;

                const candidate = rec[key] ?? rec['unique-id'] ?? rec['id'];
                const id = (() => {
                    const s = candidate == null ? '' : String(candidate).trim();
                    return s === '' ? String(index) : s;
                })();

                const cleaned: Record<string, unknown> = Object.fromEntries(
                    Object.entries(rec).filter(([, v]) => v !== undefined)
                );

                const data: Record<string, unknown> =
                    columnNames && flatTable
                        ? Object.fromEntries(columnNames.map(col => [col, cleaned[col]]))
                        : cleaned;

                // Ensure key/id values are present in data when explicitly requested in columns
                if (columnNames?.includes(key)) {
                    const curr = data[key];
                    const missing = curr == null || (typeof curr === 'string' && curr === '');
                    if (missing) data[key] = id;
                }

                if (columnNames?.includes('id')) {
                    const curr = data['id'];
                    const missing = curr == null || (typeof curr === 'string' && curr === '');
                    if (missing) {
                        data['id'] = cleaned['id'] ?? cleaned['unique-id'] ?? id;
                    }
                }

                return { id, data };
            });

        // If vertical and no explicit columns, infer columnNames from the first row's keys
        if (isVertical && !columnNames && rows.length > 0) {
            columnNames = Object.keys(rows[0].data);
            // Note: flatTable stays false here; vertical partial uses columnNames to pivot.
        }

        return {
            headers,
            rows,
            flatTable,
            columnNames,
            isVertical,
        };
    },

    validateContext: (context): context is TableContext => {
        return (Array.isArray(context) && context.every(isPlainRecord)) || isPlainRecord(context);
    },

    registerHelpers: () => ({
        objectEntries: (obj: unknown) => {
            if (!isPlainRecord(obj)) return [];
            return Object.entries(obj).map(([id, data]) => ({ id, data }));
        },
        and: (...args: unknown[]) => {
            const realArgs = args.slice(0, -1);
            return realArgs.every(Boolean);
        },
    }),
};
