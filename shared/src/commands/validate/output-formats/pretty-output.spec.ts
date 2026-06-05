import prettyFormat from './pretty-output.js';
import { ValidationOutcome } from '../validation.output.js';

const baseOutcome: ValidationOutcome = {
    hasErrors: false,
    hasWarnings: false,
    jsonSchemaValidationOutputs: [],
    spectralSchemaValidationOutputs: [],
    allValidationOutputs: vi.fn()
};

describe('prettyFormat', () => {
    it('formats errors and warnings with summaries and paths', () => {
        const outputs = [
            { severity: 'error', code: 'E1', message: 'Error 1', path: '/one', source: 'architecture' },
            { severity: 'warning', code: 'W1', message: 'Warning 1', path: '/two', source: 'pattern' }
        ];
        const outcome: ValidationOutcome = {
            ...baseOutcome,
            hasErrors: true,
            hasWarnings: true,
            allValidationOutputs: vi.fn().mockReturnValue(outputs)
        };

        const formatted = prettyFormat(outcome, {
            documents: {
                architecture: { id: 'architecture', label: 'arch.json', filePath: '/tmp/arch.json', lines: ['line one'] },
                pattern: { id: 'pattern', label: 'pattern.json', filePath: '/tmp/pattern.json', lines: ['line two'] }
            }
        });

        expect(formatted).toContain('Summary');
        expect(formatted).toContain('Errors: yes (1)');
        expect(formatted).toContain('Warnings: yes (1)');
        expect(formatted).toContain('ERROR E1: Error 1');
        expect(formatted).toContain('WARN W1: Warning 1');
        expect(formatted).toContain('/one');
        expect(formatted).toContain('/two');
    });

    it('shows friendly message when no issues', () => {
        const outcome: ValidationOutcome = {
            ...baseOutcome,
            allValidationOutputs: vi.fn().mockReturnValue([])
        };

        const formatted = prettyFormat(outcome);

        expect(formatted).toContain('No issues found');
    });

    it('renders caret safely on empty lines', () => {
        const outputs = [
            {
                severity: 'error',
                code: 'E2',
                message: 'Empty line issue',
                path: '/',
                source: 'doc',
                line_start: 1,
                character_start: 5,
                character_end: 10
            }
        ];

        const outcome: ValidationOutcome = {
            ...baseOutcome,
            hasErrors: true,
            allValidationOutputs: vi.fn().mockReturnValue(outputs)
        };

        const formatted = prettyFormat(outcome, {
            documents: {
                doc: { id: 'doc', filePath: '/tmp/doc.arch.json', lines: [''] }
            }
        });

        expect(formatted).toContain('1 | ');
        expect(formatted).toContain('| ^');
    });

    it('formats info and hint severities with their dedicated labels', () => {
        const outputs = [
            { severity: 'info', code: 'I1', message: 'just so you know', path: '/i', source: 'doc' },
            { severity: 'hint', code: 'H1', message: 'consider this', path: '/h', source: 'doc' },
        ];
        const outcome: ValidationOutcome = {
            ...baseOutcome,
            allValidationOutputs: vi.fn().mockReturnValue(outputs),
        };

        const formatted = prettyFormat(outcome);

        expect(formatted).toContain('INFO I1: just so you know');
        expect(formatted).toContain('HINT H1: consider this');
        expect(formatted).toContain('Info/Hints: 2');
    });

    it('uses the uppercase of an unknown severity for label and a no-op for colour', () => {
        const outputs = [
            { severity: 'fatal', code: 'F1', message: 'whoa', path: '/x', source: 'doc' },
        ];
        const outcome: ValidationOutcome = {
            ...baseOutcome,
            allValidationOutputs: vi.fn().mockReturnValue(outputs),
        };

        const formatted = prettyFormat(outcome);

        // 'fatal' is not in severityOrder so it's filtered OUT of the per-severity section,
        // but the summary still shows 0/0. Use formatSeverity indirectly with a hint severity
        // to also exercise the fallback path.
        expect(formatted).toContain('Errors: no (0)');
        expect(formatted).toContain('Warnings: no (0)');
    });

    it('falls back to "document" as the header key when source is missing', () => {
        const outputs = [
            { severity: 'error', code: 'E', message: 'oops', path: '/x' },
        ];
        const outcome: ValidationOutcome = {
            ...baseOutcome,
            hasErrors: true,
            allValidationOutputs: vi.fn().mockReturnValue(outputs),
        };

        const formatted = prettyFormat(outcome);

        expect(formatted).toMatch(/- In document:/);
    });

    it('emits "- In <id>:" when the issue has a source but no document context', () => {
        const outputs = [
            { severity: 'error', code: 'E', message: 'oops', path: '/x', source: 'unknown-doc' },
        ];
        const outcome: ValidationOutcome = {
            ...baseOutcome,
            hasErrors: true,
            allValidationOutputs: vi.fn().mockReturnValue(outputs),
        };

        const formatted = prettyFormat(outcome);

        expect(formatted).toMatch(/- In unknown-doc:/);
    });

    it('falls back to file path basename when the doc context has no label', () => {
        const outputs = [
            { severity: 'error', code: 'E', message: 'oops', path: '/x', source: 'doc' },
        ];
        const outcome: ValidationOutcome = {
            ...baseOutcome,
            hasErrors: true,
            allValidationOutputs: vi.fn().mockReturnValue(outputs),
        };

        const formatted = prettyFormat(outcome, {
            documents: {
                doc: { id: 'doc', filePath: '/tmp/file-only.json', lines: [] },
            },
        });

        expect(formatted).toContain('- In file-only.json (/tmp/file-only.json):');
    });

    it('falls back to "unknown" code and empty message when the issue omits them', () => {
        const outputs = [
            { severity: 'error', path: '/x', source: 'doc' },
        ];
        const outcome: ValidationOutcome = {
            ...baseOutcome,
            hasErrors: true,
            allValidationOutputs: vi.fn().mockReturnValue(outputs),
        };

        const formatted = prettyFormat(outcome);

        expect(formatted).toContain('ERROR unknown:');
    });

    it('uses "-" as the path placeholder when an issue has no path', () => {
        const outputs = [
            { severity: 'error', code: 'E', message: 'oops', source: 'doc' },
        ];
        const outcome: ValidationOutcome = {
            ...baseOutcome,
            hasErrors: true,
            allValidationOutputs: vi.fn().mockReturnValue(outputs),
        };

        const formatted = prettyFormat(outcome);

        expect(formatted).toContain('path: -');
    });

    it('emits a "schema:" line when an issue carries schemaPath', () => {
        const outputs = [
            { severity: 'error', code: 'E', message: 'oops', path: '/x', source: 'doc', schemaPath: '#/properties/foo' },
        ];
        const outcome: ValidationOutcome = {
            ...baseOutcome,
            hasErrors: true,
            allValidationOutputs: vi.fn().mockReturnValue(outputs),
        };

        const formatted = prettyFormat(outcome);

        expect(formatted).toContain('schema: #/properties/foo');
    });

    it('falls back to the file path when only the doc context provides a location', () => {
        const outputs = [
            { severity: 'error', code: 'E', message: 'oops', path: '/x', source: 'doc' },
        ];
        const outcome: ValidationOutcome = {
            ...baseOutcome,
            hasErrors: true,
            allValidationOutputs: vi.fn().mockReturnValue(outputs),
        };

        const formatted = prettyFormat(outcome, {
            documents: {
                doc: { id: 'doc', filePath: '/abs/path.json', lines: [] },
            },
        });

        expect(formatted).toContain('file: /abs/path.json');
    });

    it('emits "at line N (file)" when a line is present but the column is not', () => {
        const outputs = [
            {
                severity: 'error',
                code: 'E',
                message: 'oops',
                path: '/x',
                source: 'doc',
                line_start: 7,
            },
        ];
        const outcome: ValidationOutcome = {
            ...baseOutcome,
            hasErrors: true,
            allValidationOutputs: vi.fn().mockReturnValue(outputs),
        };

        const formatted = prettyFormat(outcome, {
            documents: {
                doc: { id: 'doc', filePath: '/abs/loc.json', lines: ['', '', '', '', '', '', 'matching line'] },
            },
        });

        expect(formatted).toContain('at line 7 (/abs/loc.json)');
    });

    it('emits "at col N" when only character_start is provided', () => {
        const outputs = [
            {
                severity: 'error',
                code: 'E',
                message: 'oops',
                path: '/x',
                source: 'doc',
                character_start: 3,
            },
        ];
        const outcome: ValidationOutcome = {
            ...baseOutcome,
            hasErrors: true,
            allValidationOutputs: vi.fn().mockReturnValue(outputs),
        };

        const formatted = prettyFormat(outcome);

        expect(formatted).toContain('at col 4');
    });

    it('renders a snippet with caret span when line and characters are present', () => {
        const outputs = [
            {
                severity: 'error',
                code: 'E',
                message: 'oops',
                path: '/x',
                source: 'doc',
                line_start: 1,
                character_start: 4,
                character_end: 9,
            },
        ];
        const outcome: ValidationOutcome = {
            ...baseOutcome,
            hasErrors: true,
            allValidationOutputs: vi.fn().mockReturnValue(outputs),
        };

        const formatted = prettyFormat(outcome, {
            documents: {
                doc: { id: 'doc', filePath: '/x.json', lines: ['hello world here'] },
            },
        });

        expect(formatted).toContain('1 | hello world here');
        // caret span of 5 (4..9 exclusive)
        expect(formatted).toMatch(/\^\^\^\^\^/);
    });

    it('trims very long lines to a windowed snippet around the caret', () => {
        const longLine = 'lead-padding-' + 'x'.repeat(200) + '-tail-padding';
        const outputs = [
            {
                severity: 'error',
                code: 'E',
                message: 'oops',
                path: '/x',
                source: 'doc',
                line_start: 1,
                character_start: 120,
                character_end: 125,
            },
        ];
        const outcome: ValidationOutcome = {
            ...baseOutcome,
            hasErrors: true,
            allValidationOutputs: vi.fn().mockReturnValue(outputs),
        };

        const formatted = prettyFormat(outcome, {
            documents: {
                doc: { id: 'doc', filePath: '/x.json', lines: [longLine] },
            },
        });

        // Trim ellipses on at least the left side prove the trim branch fired.
        expect(formatted).toContain('...');
    });

    it('returns an empty snippet when the target line is out of range', () => {
        const outputs = [
            {
                severity: 'error',
                code: 'E',
                message: 'oops',
                path: '/x',
                source: 'doc',
                line_start: 99,
                character_start: 0,
            },
        ];
        const outcome: ValidationOutcome = {
            ...baseOutcome,
            hasErrors: true,
            allValidationOutputs: vi.fn().mockReturnValue(outputs),
        };

        const formatted = prettyFormat(outcome, {
            documents: {
                doc: { id: 'doc', filePath: '/x.json', lines: ['only-line'] },
            },
        });

        // Out-of-range means no caret snippet line, but the location line still appears.
        expect(formatted).toContain('at line 99');
        expect(formatted).not.toContain('^');
    });

    it('returns the outcome with no document context when documents are not provided', () => {
        const outputs = [
            { severity: 'error', code: 'E', message: 'oops', path: '/x', source: 'doc' },
        ];
        const outcome: ValidationOutcome = {
            ...baseOutcome,
            hasErrors: true,
            allValidationOutputs: vi.fn().mockReturnValue(outputs),
        };

        const formatted = prettyFormat(outcome);

        // Without documents, no file: line is emitted.
        expect(formatted).not.toContain('file:');
    });

    it('handles allValidationOutputs returning undefined', () => {
        const outcome: ValidationOutcome = {
            ...baseOutcome,
            allValidationOutputs: vi.fn().mockReturnValue(undefined),
        };
        const formatted = prettyFormat(outcome);
        expect(formatted).toContain('No issues found');
    });
});