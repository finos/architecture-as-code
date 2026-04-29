export type OutputFormat = 'json' | 'table';

export function parseOutputFormat(value: string | undefined): OutputFormat {
    return value === 'table' ? 'table' : 'json';
}

export function printJsonSuccess(data: unknown): void {
    console.log(JSON.stringify(data, null, 2));
}

/**
 * Renders a list of row objects as a plain-text table using manual padding.
 * @param rows     Array of objects where values are strings or numbers.
 * @param columns  Ordered column definitions: key to read from row + header label.
 */
export function printTableSuccess(
    rows: Record<string, unknown>[],
    columns: { key: string; header: string }[]
): void {
    if (rows.length === 0) {
        console.log('(no results)');
        return;
    }

    // Compute column widths: max of header length and all row values
    const widths = columns.map(col => {
        const headerLen = col.header.length;
        const maxValueLen = rows.reduce((max, row) => {
            const val = String(row[col.key] ?? '');
            return Math.max(max, val.length);
        }, 0);
        return Math.max(headerLen, maxValueLen);
    });

    const formatRow = (values: string[]) =>
        values.map((v, i) => v.padEnd(widths[i])).join('  ');

    const header = formatRow(columns.map(c => c.header));
    const divider = widths.map(w => '-'.repeat(w)).join('  ');

    console.log(header);
    console.log(divider);
    for (const row of rows) {
        console.log(formatRow(columns.map(col => String(row[col.key] ?? ''))));
    }
}

/**
 * Prints an error to stderr.
 * JSON mode: `{ "status": N, "error": "...", "request": "..." }`
 * Table mode: plain text.
 */
export function printError(
    status: number,
    error: string,
    request: string,
    format: OutputFormat
): void {
    if (format === 'table') {
        process.stderr.write(`Error ${status} [${request}]: ${error}\n`);
    } else {
        process.stderr.write(JSON.stringify({ status, error, request }) + '\n');
    }
}
