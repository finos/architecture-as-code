import { ValidationOutcome } from './validation.output.js';
import prettyFormat from './output-formats/pretty-output.js';
import { prettifyJson } from './validation-helpers.js';

export type OutputFormat = 'junit' | 'json' | 'pretty';
export type ValidateOutputFormat = OutputFormat;

export interface ValidationDocumentContext {
    id: string;
    label?: string;
    filePath?: string;
    lines?: string[];
}

export interface ValidationFormattingOptions {
    documents?: Record<string, ValidationDocumentContext>;
}

export type OutputFormatter = (outcome: ValidationOutcome, options?: ValidationFormattingOptions) => string;

const formatters = new Map<OutputFormat, OutputFormatter>([
    ['json', (outcome) => prettifyJson(outcome)],
    ['pretty', (outcome, options) => prettyFormat(outcome, options)],
]);

/**
 * Registers (or replaces) the formatter for an output format. The root entry point registers
 * `junit`, which depends on a Node-oriented XML builder; the browser entry ships json + pretty.
 */
export function registerOutputFormatter(format: OutputFormat, formatter: OutputFormatter): void {
    formatters.set(format, formatter);
}

export function formatOutput(
    validationOutcome: ValidationOutcome,
    format: OutputFormat,
    options?: ValidationFormattingOptions
): string {
    const formatter = formatters.get(format);
    if (!formatter) {
        throw new Error(`Output format '${format}' is not available in this environment. Available: ${[...formatters.keys()].join(', ')}`);
    }
    return formatter(validationOutcome, options);
}
