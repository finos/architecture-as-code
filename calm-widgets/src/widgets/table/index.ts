import { CalmWidget } from '../../types';

type TableContext = Array<Record<string, unknown>> | Record<string, unknown>;

type SectionType = 'overview' | 'extended' | 'metadata';

type TableOptions = {
    key?: string;
    headers?: boolean;
    columns?: string;
    orientation?: 'horizontal' | 'vertical';
    sections?: string;
    'empty-message'?: string;
};

type TableRow = { id: string; data: Record<string, unknown> };

type TableViewModel = {
    headers: boolean;
    rows: TableRow[];
    flatTable?: boolean;
    columnNames?: string[];
    isVertical?: boolean;
    emptyMessage?: string;
    hasRows?: boolean;
};

// Properties that are always shown in overview section
const OVERVIEW_COLUMNS = ['unique-id', 'name', 'description', 'node-type'];

// Properties excluded from extended section (schema-defined optional properties)
const EXCLUDED_FROM_EXTENDED = ['interfaces', 'controls', 'metadata', 'details'];

function isPlainRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Format a value for display in a table cell.
 * - Primitives are returned as-is
 * - Arrays and objects are passed through for recursive table rendering
 */
function formatValueForDisplay(value: unknown): unknown {
    if (value === null || value === undefined) {
        return value;
    }

    // Primitives - return as-is
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    // Arrays and objects - pass through for recursive table rendering by the template
    if (Array.isArray(value) || isPlainRecord(value)) {
        return value;
    }

    return String(value);
}

function parseSections(sectionsStr: string | undefined): SectionType[] {
    if (!sectionsStr) return [];
    return sectionsStr.split(',')
        .map(s => s.trim().toLowerCase())
        .filter((s): s is SectionType => ['overview', 'extended', 'metadata'].includes(s));
}

function buildColumnsFromSections(
    sections: SectionType[],
    context: Record<string, unknown>,
    explicitColumns?: string[]
): string[] {
    const resultColumns: string[] = [];

    for (const section of sections) {
        switch (section) {
            case 'overview':
                for (const col of OVERVIEW_COLUMNS) {
                    if (!resultColumns.includes(col)) {
                        resultColumns.push(col);
                    }
                }
                break;
            case 'extended': {
                // Get all keys from context excluding overview columns and excluded properties
                const allExcluded = [...OVERVIEW_COLUMNS, ...EXCLUDED_FROM_EXTENDED, 'additionalProperties'];
                const extendedKeys = Object.keys(context).filter(
                    key => !allExcluded.includes(key) && !resultColumns.includes(key)
                );
                resultColumns.push(...extendedKeys);

                // Unpack additionalProperties if present
                const additionalProps = context['additionalProperties'];
                if (isPlainRecord(additionalProps)) {
                    for (const key of Object.keys(additionalProps)) {
                        if (!resultColumns.includes(key)) {
                            resultColumns.push(key);
                        }
                    }
                }
                break;
            }
            case 'metadata': {
                // If metadata exists as a property WITH a value, include it
                // We check for truthy value, not just key existence, because toCanonicalSchema()
                // may add undefined metadata properties to all nodes
                const metadataValue = context['metadata'];
                const hasMetadata = metadataValue !== undefined && metadataValue !== null;
                if (hasMetadata && !resultColumns.includes('metadata')) {
                    resultColumns.push('metadata');
                }
                break;
            }
        }
    }

    // Add any explicit columns that aren't already included
    if (explicitColumns) {
        for (const col of explicitColumns) {
            if (!resultColumns.includes(col)) {
                resultColumns.push(col);
            }
        }
    }

    return resultColumns;
}

export const TableWidget: CalmWidget<TableContext, TableOptions, TableViewModel> = {
    id: 'table',
    templatePartial: 'table-template.html',
    partials: ['row-template.html', 'table-horizontal.html', 'table-vertical.html'],

    transformToViewModel: (context, options) => {
        // Handle undefined/null context - return empty table
        if (context === undefined || context === null) {
            const orientation = options?.orientation ?? 'horizontal';
            return {
                headers: options?.headers !== false,
                rows: [],
                flatTable: false,
                columnNames: undefined,
                isVertical: orientation === 'vertical',
                emptyMessage: options?.['empty-message'],
                hasRows: false,
            };
        }

        // Unwrap single-element arrays when they appear to be Handlebars lookup results
        // (i.e., a full CALM node object wrapped in an array)
        // Only unwrap if the object has a non-empty 'unique-id' property (indicating it's a CALM node)
        let unwrappedContext = context;
        if (Array.isArray(context)) {
            if (context.length === 1 && isPlainRecord(context[0])) {
                const innerObj = context[0];
                const uniqueId = innerObj['unique-id'];
                // Only unwrap if unique-id exists and is a non-empty string (after trimming)
                if (typeof uniqueId === 'string' && uniqueId.trim().length > 0) {
                    unwrappedContext = innerObj;
                }
            }
        }

        const {
            key = 'unique-id',
            headers = true,
            columns,
            orientation = 'horizontal',
            sections,
            'empty-message': emptyMessage,
        } = options ?? {};

        const isVertical = orientation === 'vertical';

        // Parse explicit columns from options
        const explicitColumns: string[] | undefined =
            typeof columns === 'string'
                ? columns.split(',').map(c => c.trim()).filter(Boolean)
                : undefined;

        // Parse sections and build column names
        const parsedSections = parseSections(sections);

        // Determine columnNames based on sections and/or explicit columns
        let columnNames: string[] | undefined;
        if (parsedSections.length > 0) {
            // When sections are specified, we need to get the context object for building columns
            // For single object context, use it directly; for array, sections don't apply
            if (isPlainRecord(unwrappedContext) && !Array.isArray(unwrappedContext)) {
                columnNames = buildColumnsFromSections(parsedSections, unwrappedContext, explicitColumns);
                // If sections produced no columns, return empty table with empty message
                if (columnNames.length === 0) {
                    return {
                        headers,
                        rows: [],
                        flatTable: false,
                        columnNames: undefined,
                        isVertical,
                        emptyMessage,
                        hasRows: false,
                    };
                }
            } else {
                // For array context, sections parameter is ignored, use explicit columns
                columnNames = explicitColumns;
            }
        } else {
            columnNames = explicitColumns;
        }
        let flatTable: boolean;
        let entries: Array<Record<string, unknown>>;

        if (Array.isArray(unwrappedContext)) {
            entries = unwrappedContext;
            flatTable = columnNames !== undefined;
        } else if (isPlainRecord(unwrappedContext)) {
            const obj: Record<string, unknown> = unwrappedContext;

            // Flatten additionalProperties into the object for column lookups
            const additionalProps = isPlainRecord(obj['additionalProperties']) ? obj['additionalProperties'] : {};
            const flattenedObj: Record<string, unknown> = { ...obj, ...additionalProps };
            delete flattenedObj['additionalProperties']; // Remove the wrapper

            const canSingleRowWithColumns =
                !!columnNames && columnNames.every(col => Object.prototype.hasOwnProperty.call(flattenedObj, col));

            if (canSingleRowWithColumns || isVertical) {
                flatTable = !!columnNames;
                entries = columnNames
                    ? [Object.fromEntries(columnNames.map(col => [col, flattenedObj[col]]))]
                    : [flattenedObj];
            } else {
                flatTable = false;
                entries = Object.entries(flattenedObj).map(([propKey, value]) =>
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

                // Format complex values for display
                const formattedData: Record<string, unknown> = Object.fromEntries(
                    Object.entries(cleaned).map(([k, v]) => [k, formatValueForDisplay(v)])
                );

                const data: Record<string, unknown> =
                    columnNames && flatTable
                        ? Object.fromEntries(columnNames.map(col => [col, formattedData[col]]))
                        : formattedData;

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
                        data['id'] = formattedData['id'] ?? formattedData['unique-id'] ?? id;
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
            emptyMessage,
            hasRows: rows.length > 0,
        };
    },

    validateContext: (context): context is TableContext => {
        // Allow undefined/null - will render as empty table
        if (context === undefined || context === null) {
            return true;
        }
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
