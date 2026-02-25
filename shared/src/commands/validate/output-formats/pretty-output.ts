

import path from 'path';
import { ValidationOutcome, ValidationOutput } from '../validation.output.js';
import { ValidationFormattingOptions, ValidationDocumentContext } from '../validate.js';

type Severity = 'error' | 'warning' | 'info' | 'hint' | string;

const severityOrder: Severity[] = ['error', 'warning', 'info', 'hint'];
const supportsColor = Boolean(process?.stdout?.isTTY) && process.env.NO_COLOR !== '1';

const colors = {
    red: (text: string) => (supportsColor ? `\u001b[31m${text}\u001b[0m` : text),
    // Bold bright yellow foreground for WARN
    yellow: (text: string) => (supportsColor ? `\u001b[1;93m${text}\u001b[0m` : text),
    blue: (text: string) => (supportsColor ? `\u001b[34m${text}\u001b[0m` : text),
    gray: (text: string) => (supportsColor ? `\u001b[90m${text}\u001b[0m` : text),
    bold: (text: string) => (supportsColor ? `\u001b[1m${text}\u001b[0m` : text)
};

const severityLabel: Partial<Record<Severity, string>> = {
    error: 'ERROR',
    warning: 'WARN',
    info: 'INFO',
    hint: 'HINT'
};

const severityColor: Partial<Record<Severity, (text: string) => string>> = {
    error: colors.red,
    warning: colors.yellow,
    info: colors.blue,
    hint: colors.gray
};

function formatSeverity(severity: Severity): string {
    const label = severityLabel[severity] ?? (severity ? severity.toUpperCase() : 'ISSUE');
    const color = severityColor[severity] ?? ((text: string) => text);
    return color(label.padEnd(5));
}

export default function prettyFormat(validationOutcome: ValidationOutcome, options?: ValidationFormattingOptions): string {
    const outputs = validationOutcome.allValidationOutputs?.() ?? [];
    const lines: string[] = [];

    lines.push('Summary');
    lines.push(`- Errors: ${validationOutcome.hasErrors ? 'yes' : 'no'} (${countBySeverity(outputs, 'error')})`);
    lines.push(`- Warnings: ${validationOutcome.hasWarnings ? 'yes' : 'no'} (${countBySeverity(outputs, 'warning')})`);
    lines.push(`- Info/Hints: ${countBySeverity(outputs, 'info') + countBySeverity(outputs, 'hint')}`);

    if (outputs.length === 0) {
        lines.push('\nNo issues found.');
        return lines.join('\n') + '\n';
    }

    severityOrder.forEach(severity => {
        const matches = outputs.filter(output => output.severity === severity);
        if (matches.length === 0) {
            return;
        }

        lines.push('', `${formatSeverity(severity)} issues:`);
        const grouped = groupByDocument(matches);
        Object.entries(grouped).forEach(([documentId, issues]) => {
            const docContext = options?.documents?.[documentId];
            const header = buildDocumentHeader(documentId, docContext);
            lines.push(header);
            issues.forEach(issue => {
                lines.push(formatIssue(issue, docContext));
            });
        });
    });

    return lines.join('\n').trimEnd() + '\n';
}

function countBySeverity(outputs: ValidationOutput[], severity: Severity): number {
    return outputs.filter(output => output.severity === severity).length;
}

function groupByDocument(outputs: ValidationOutput[]): Record<string, ValidationOutput[]> {
    return outputs.reduce((acc, output) => {
        const key = output.source || 'document';
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(output);
        return acc;
    }, {} as Record<string, ValidationOutput[]>);
}

function buildDocumentHeader(documentId: string, context?: ValidationDocumentContext): string {
    if (!context) {
        return `- In ${documentId || 'document'}:`;
    }
    const label = context.label || path.basename(context.filePath || context.id || '');
    const location = context.filePath ? ` (${context.filePath})` : '';
    return `- In ${label}${location}:`;
}

function formatIssue(issue: ValidationOutput, docContext?: ValidationDocumentContext): string {
    const code = issue.code ?? 'unknown';
    const message = issue.message ?? '';
    const severityText = formatSeverity(issue.severity).trimEnd();
    const messageLine = `  ${severityText} ${code}: ${message}`;
    const pathLine = `    path: ${issue.path || '-'}`;
    const schemaLine = issue.schemaPath ? `    schema: ${issue.schemaPath}` : '';
    const locationLine = formatLocation(issue, docContext);
    const snippet = formatSnippet(issue, docContext);

    return [messageLine, pathLine, locationLine, schemaLine, snippet].filter(Boolean).join('\n');
}

function formatLocation(issue: ValidationOutput, docContext?: ValidationDocumentContext): string {
    if (issue.line_start === undefined && issue.character_start === undefined) {
        return docContext?.filePath ? `    file: ${docContext.filePath}` : '';
    }

    const line = issue.line_start;
    const col = issue.character_start !== undefined ? issue.character_start + 1 : undefined;
    const locationParts = [];
    if (line !== undefined) {
        locationParts.push(`line ${line}`);
    }
    if (col !== undefined) {
        locationParts.push(`col ${col}`);
    }
    const location = locationParts.length > 0 ? locationParts.join(', ') : 'location unknown';
    const file = docContext?.filePath ? ` (${docContext.filePath})` : '';
    return `    at ${location}${file}`;
}

function formatSnippet(issue: ValidationOutput, docContext?: ValidationDocumentContext): string {
    if (!docContext?.lines || issue.line_start === undefined) {
        return '';
    }

    const lineIndex = Math.max((issue.line_start ?? 1) - 1, 0);
    const lineText = docContext.lines[lineIndex];
    if (lineText === undefined) {
        return '';
    }

    // Clamp caret rendering on empty lines to the first column with width 1.
    if (lineText.length === 0) {
        const lineNumber = issue.line_start ?? (lineIndex + 1);
        const gutterWidth = String(lineNumber).length;
        const snippetLine = `    ${String(lineNumber).padStart(gutterWidth)} | `;
        const caretLine = `    ${' '.repeat(gutterWidth)} | ^`;
        return [snippetLine, caretLine].join('\n');
    }

    const rawColStart = Math.max(issue.character_start ?? 0, 0);
    const rawColEndExclusive = Math.max(issue.character_end ?? rawColStart + 1, rawColStart + 1);
    const lineLength = lineText.length;
    const colStart = Math.min(rawColStart, Math.max(lineLength - 1, 0));
    const colEndExclusive = Math.min(rawColEndExclusive, Math.max(lineLength, colStart + 1));
    const caretWidth = Math.max(1, colEndExclusive - colStart);

    // Trim very long lines to a window around the caret to keep output readable.
    const maxSnippetLength = 140;
    const windowPadding = 40;
    const needsTrim = lineText.length > maxSnippetLength;
    const windowStart = needsTrim ? Math.max(0, colStart - windowPadding) : 0;
    const windowEnd = needsTrim ? Math.min(lineText.length, colEndExclusive + windowPadding) : lineText.length;
    const prefix = windowStart > 0 ? '...' : '';
    const suffix = windowEnd < lineText.length ? '...' : '';
    const visibleText = prefix + lineText.slice(windowStart, windowEnd) + suffix;
    const adjustedColStart = (colStart - windowStart) + prefix.length;
    const adjustedCaretWidth = Math.max(1, Math.min(caretWidth, visibleText.length - adjustedColStart));

    const lineNumber = issue.line_start ?? (lineIndex + 1);
    const gutterWidth = String(lineNumber).length;
    const snippetLine = `    ${String(lineNumber).padStart(gutterWidth)} | ${visibleText}`;
    const caretLine = `    ${' '.repeat(gutterWidth)} | ${' '.repeat(adjustedColStart)}${'^'.repeat(adjustedCaretWidth)}`;

    return [snippetLine, caretLine].join('\n');
}


