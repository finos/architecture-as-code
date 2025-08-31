import { CalmWidget } from '../../types';

type TableContext = Array<Record<string, unknown>> | Record<string, unknown>;
type TableOptions = { key?: string; headers?: boolean; columns?: string };
type TableRow = { id: string; data: Record<string, unknown> };
type TableViewModel = {
    headers: boolean;
    rows: TableRow[];
    flatTable?: boolean;
    columnNames?: string[];
};

function isPlainRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export const TableWidget: CalmWidget<TableContext, TableOptions, TableViewModel> = {
    id: 'table',
    templatePartial: 'table-template.html',
    partials: ['row-template.html'],

    transformToViewModel: (context, options) => {
        const { key = 'unique-id', headers = true, columns } = options ?? {};
        const columnNames =
            typeof columns === 'string'
                ? columns.split(',').map(c => c.trim()).filter(Boolean)
                : undefined;

        const flatTable = columnNames !== undefined;

        let entries: Array<Record<string, unknown>>;

        if (Array.isArray(context)) {
            entries = context as Array<Record<string, unknown>>;
        } else if (isPlainRecord(context)) {
            entries = Object.entries(context).map(([id, value]) =>
                isPlainRecord(value) ? { ...value, [key]: id } : { value, [key]: id }
            );
        } else {
            throw new Error('Unsupported context format for table widget');
        }

        const rows: TableRow[] = entries
            .filter(item => isPlainRecord(item))
            .map((item, index) => {
                const candidate = item[key];
                const id =
                    typeof candidate === 'string' && candidate.trim() !== ''
                        ? candidate
                        : String(index);

                const cleaned = Object.fromEntries(
                    Object.entries(item).filter(([, value]) => value !== undefined)
                );

                const data = columnNames
                    ? Object.fromEntries(columnNames.map(col => [col, cleaned[col]]))
                    : cleaned;

                return { id, data };
            });

        return { headers, rows, flatTable, columnNames };
    },

    validateContext: (context): context is TableContext => {
        return (
            (Array.isArray(context) && context.every(isPlainRecord)) ||
            isPlainRecord(context)
        );
    },

    registerHelpers: () => ({
        objectEntries: (obj: unknown) => {
            if (!isPlainRecord(obj)) return [];
            return Object.entries(obj).map(([id, data]) => ({ id, data }));
        }
    })
};
