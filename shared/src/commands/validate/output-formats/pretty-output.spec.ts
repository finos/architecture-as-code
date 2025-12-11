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
});