export type Primitive = string | number | boolean | null;
export type FlatObject = Record<string, Primitive>;

export type ValueShape =
    | { kind: 'empty' }
    | { kind: 'boolean'; value: boolean }
    | { kind: 'number'; value: number }
    | { kind: 'url'; value: string }
    | { kind: 'date'; value: string; dateOnly: boolean }
    | { kind: 'text'; value: string }
    | { kind: 'list'; items: Primitive[] }
    | { kind: 'table'; columns: string[]; rows: FlatObject[] }
    | { kind: 'array'; items: unknown[] }
    | { kind: 'object'; entries: [string, unknown][] };

// ISO 8601 date or date-time only. Date.parse alone accepts too much ("1", "May 3").
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

export function isPrimitive(value: unknown): value is Primitive {
    return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFlatObject(value: unknown): value is FlatObject {
    return isPlainObject(value) && Object.values(value).every(isPrimitive);
}

/** Only http(s) links are rendered as links, so a `javascript:` value in decorator data stays text. */
export function isWebUrl(value: string): boolean {
    if (!/^https?:\/\//i.test(value)) return false;
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
}

// Date.parse rolls an impossible day over (2024-02-30 becomes 1 March), so check the calendar date as written.
function isRealCalendarDate(value: string): boolean {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Whether a string is an ISO 8601 date or date-time that names a real day. */
export function isIsoDate(value: string): boolean {
    return (ISO_DATE.test(value) || ISO_DATE_TIME.test(value)) && !Number.isNaN(Date.parse(value)) && isRealCalendarDate(value);
}

function classifyString(value: string): ValueShape {
    if (isWebUrl(value)) return { kind: 'url', value };
    if (isIsoDate(value)) return { kind: 'date', value, dateOnly: ISO_DATE.test(value) };
    return { kind: 'text', value };
}

export const NO_TYPE_LABEL = '(no type)';

/** The type to show and group by. The API does not require a type, so a decorator can come without one. */
export function decoratorTypeLabel(type: unknown): string {
    if (type === undefined || type === null || type === '') return NO_TYPE_LABEL;
    return typeof type === 'string' ? type : JSON.stringify(type);
}

export function classifyValue(value: unknown): ValueShape {
    if (value === null || value === undefined) return { kind: 'empty' };
    if (typeof value === 'boolean') return { kind: 'boolean', value };
    if (typeof value === 'number') return { kind: 'number', value };
    if (typeof value === 'string') return classifyString(value);
    if (Array.isArray(value)) {
        if (value.length > 0 && value.every(isPrimitive)) return { kind: 'list', items: value };
        if (value.length > 0 && value.every(isFlatObject)) {
            const columns = [...new Set(value.flatMap((row) => Object.keys(row)))];
            return { kind: 'table', columns, rows: value };
        }
        return { kind: 'array', items: value };
    }
    if (isPlainObject(value)) return { kind: 'object', entries: Object.entries(value) };
    return { kind: 'text', value: String(value) };
}

export function formatDate(value: string, dateOnly: boolean): string {
    const date = new Date(value);
    // A date-only value parses as UTC midnight; format it in UTC so it does not move a day.
    return dateOnly ? date.toLocaleDateString(undefined, { timeZone: 'UTC' }) : date.toLocaleString();
}

/** Short size hint for a collapsed branch, for example "3 fields" or "1 item". */
export function describeSize(value: unknown): string {
    if (Array.isArray(value)) return `${value.length} ${value.length === 1 ? 'item' : 'items'}`;
    if (isPlainObject(value)) {
        const count = Object.keys(value).length;
        return `${count} ${count === 1 ? 'field' : 'fields'}`;
    }
    return '';
}
