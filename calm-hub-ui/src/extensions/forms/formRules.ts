import { ExtensionContext, ExtensionForm, ExtensionFormField } from '../../model/extensions.js';

/** What a field holds while the user edits it: a number stays text until the form is sent. */
export type FieldValue = string | boolean;
export type FormInput = Record<string, string | number | boolean>;

// The same caps and messages as ExtensionForms in calm-hub, so the UI shows the error that Hub would return.
const TEXT_MAX_LENGTH = 1000;
const MULTILINE_MAX_LENGTH = 10000;
// eslint-disable-next-line no-control-regex
const TEXT_FORBIDDEN = /[\u0000-\u001f\u007f]/;
// eslint-disable-next-line no-control-regex
const MULTILINE_FORBIDDEN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
// A whole number as digits, so a fraction or a large exponent cannot round to a whole number without a message.
const WHOLE = /^[+-]?\d+$/;
const SAFE_INTEGER_MESSAGE = `Enter a whole number from ${Number.MIN_SAFE_INTEGER} to ${Number.MAX_SAFE_INTEGER}.`;

/**
 * The value under a field id, but only an own property. A field id such as `constructor` or `toString` is valid, and
 * a plain object inherits a function under that name.
 */
export const own = <T>(record: Record<string, T> | undefined, id: string): T | undefined =>
    record && Object.hasOwn(record, id) ? record[id] : undefined;

export const maxLength = (field: ExtensionFormField) => {
    const cap = field.type === 'multiline' ? MULTILINE_MAX_LENGTH : TEXT_MAX_LENGTH;
    return field.maxLength === undefined ? cap : Math.min(field.maxLength, cap);
};

export function initialValues(form: ExtensionForm): Record<string, FieldValue> {
    return Object.fromEntries(
        form.fields.map((field) => [
            field.id,
            field.type === 'checkbox' ? field.default === true : field.default === undefined ? '' : String(field.default),
        ])
    );
}

function requiredMessage(field: ExtensionFormField) {
    return field.type === 'choice' ? 'Choose an option.' : field.type === 'checkbox' ? 'Tick this box to continue.' : 'Enter a value.';
}

function textError(field: ExtensionFormField, text: string): string | undefined {
    const multiline = field.type === 'multiline';
    if ((multiline ? MULTILINE_FORBIDDEN : TEXT_FORBIDDEN).test(text) || LONE_SURROGATE.test(text)) {
        return multiline ? 'Remove the control characters.' : 'Enter one line of text.';
    }
    if (text.length > maxLength(field)) return `Enter at most ${maxLength(field)} characters.`;
    if (field.minLength !== undefined && text.length < field.minLength) return `Enter at least ${field.minLength} characters.`;
    return undefined;
}

function numberError(field: ExtensionFormField, text: string, value: number): string | undefined {
    if (field.integer && !WHOLE.test(text)) return 'Enter a whole number.';
    const { minimum: min, maximum: max } = field;
    if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
        return min !== undefined && max !== undefined
            ? `Enter a number from ${min} to ${max}.`
            : min !== undefined
              ? `Enter ${min} or more.`
              : `Enter ${max} or less.`;
    }
    // JavaScript and many JSON parsers cannot hold a larger whole number exactly.
    if (field.integer && !Number.isSafeInteger(value)) return SAFE_INTEGER_MESSAGE;
    return undefined;
}

/** The input to send, with only the fields that have a value, and a message for each field that fails. */
export function checkValues(form: ExtensionForm, values: Record<string, FieldValue>): { input: FormInput; errors: Record<string, string> } {
    const input: FormInput = {};
    const errors: Record<string, string> = {};
    for (const field of form.fields) {
        const value = own(values, field.id);
        if (field.type === 'checkbox') {
            if (field.required && value !== true) errors[field.id] = requiredMessage(field);
            else input[field.id] = value === true;
            continue;
        }
        const text = typeof value === 'string' ? value : '';
        if (text === '' || (field.required && text.trim() === '')) {
            if (field.required) errors[field.id] = requiredMessage(field);
            continue;
        }
        if (field.type === 'number') {
            const number = DECIMAL.test(text.trim()) ? Number(text.trim()) : NaN;
            const error = Number.isFinite(number) ? numberError(field, text.trim(), number) : 'Enter a number.';
            if (error) errors[field.id] = error;
            else input[field.id] = number;
        } else if (field.type === 'choice') {
            if (field.options?.some((option) => option.value === text)) input[field.id] = text;
            else errors[field.id] = 'Choose one of the options.';
        } else {
            const error = textError(field, text);
            if (error) errors[field.id] = error;
            else input[field.id] = text;
        }
    }
    return { input, errors };
}

const RESOURCE_KEYS = ['namespace', 'resourceType', 'resourceId', 'version'] as const;

/**
 * The target that a form sends from a context, or undefined while the context lacks a value the form needs. A
 * resource target also keeps the selected node, when there is one.
 */
export function formTarget(form: ExtensionForm, context: ExtensionContext | undefined): ExtensionContext | undefined {
    if (form.target === 'none') return {};
    if (!context || RESOURCE_KEYS.some((key) => !context[key])) return undefined;
    if (form.target === 'element' && !context.selectedElement) return undefined;
    const { namespace, resourceType, resourceId, version, selectedElement } = context;
    return {
        namespace,
        resource: `${resourceType}/${resourceId}`,
        resourceType,
        resourceId,
        version,
        ...(selectedElement ? { selectedElement } : {}),
    };
}

export const sameTarget = (a: ExtensionContext | undefined, b: ExtensionContext | undefined) =>
    JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** A short name of a target for notices: "demo architectures/1 1.0.0, node api-gateway". */
export function targetName(target: ExtensionContext): string {
    const resource = [target.namespace, target.resource, target.version].filter(Boolean).join(' ');
    return target.selectedElement ? `${resource}, node ${target.selectedElement}` : resource;
}

/** A lower-case version 4 UUID. crypto.randomUUID needs a secure context, and Hub can be served over plain http. */
export function newSubmissionId(random: (bytes: Uint8Array) => Uint8Array = (bytes) => crypto.getRandomValues(bytes)): string {
    const bytes = random(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
