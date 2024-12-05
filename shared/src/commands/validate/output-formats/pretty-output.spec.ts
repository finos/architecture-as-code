import prettyFormat from './pretty-output';
import { ValidationOutcome } from '../validation.output';

describe('prettyFormat', () => {
    it('should format validation outcome with errors and warnings', () => {
        const validationOutcome: ValidationOutcome = {
            allValidationOutputs: jest.fn().mockReturnValue([
                { severity: 'error', message: 'Error 1' },
                { severity: 'warning', message: 'Warning 1' }
            ]),
            hasErrors: true,
            hasWarnings: true,
            jsonSchemaValidationOutputs: [],
            spectralSchemaValidationOutputs: []
        };

        const result = prettyFormat(validationOutcome);

        expect(result).toContain('Issue Type');
        expect(result).toContain('Issues Found?');
        expect(result).toContain('Issue Count');
        expect(result).toContain('Errors');
        expect(result).toContain('Warnings');
        expect(result).toContain('true');
        expect(result).toContain('1');
        expect(result).toContain('Error 1');
        expect(result).toContain('Warning 1');
    });

    it('should format validation outcome with only errors', () => {
        const validationOutcome: ValidationOutcome = {
            allValidationOutputs: jest.fn().mockReturnValue([
                { severity: 'error', message: 'Error 1' }
            ]),
            hasErrors: true,
            hasWarnings: false,
            jsonSchemaValidationOutputs: [],
            spectralSchemaValidationOutputs: []
        };

        const result = prettyFormat(validationOutcome);

        expect(result).toContain('Issue Type');
        expect(result).toContain('Issues Found?');
        expect(result).toContain('Issue Count');
        expect(result).toContain('Errors');
        expect(result).toContain('Warnings');
        expect(result).toContain('true');
        expect(result).toContain('1');
        expect(result).toContain('Error 1');
        expect(result).not.toContain('Warning 1');
    });

    it('should format validation outcome with only warnings', () => {
        const validationOutcome: ValidationOutcome = {
            allValidationOutputs: jest.fn().mockReturnValue([
                { severity: 'warning', message: 'Warning 1' }
            ]),
            hasErrors: false,
            hasWarnings: true,
            jsonSchemaValidationOutputs: [],
            spectralSchemaValidationOutputs: []
        };

        const result = prettyFormat(validationOutcome);

        expect(result).toContain('Issue Type');
        expect(result).toContain('Issues Found?');
        expect(result).toContain('Issue Count');
        expect(result).toContain('Errors');
        expect(result).toContain('Warnings');
        expect(result).toContain('true');
        expect(result).toContain('1');
        expect(result).not.toContain('Error 1');
        expect(result).toContain('Warning 1');
    });

    it('should format validation outcome with no issues', () => {
        const validationOutcome: ValidationOutcome = {
            allValidationOutputs: jest.fn().mockReturnValue([]),
            hasErrors: false,
            hasWarnings: false,
            jsonSchemaValidationOutputs: [],
            spectralSchemaValidationOutputs: []
        };

        const result = prettyFormat(validationOutcome);

        expect(result).toContain('Issue Type');
        expect(result).toContain('Issues Found?');
        expect(result).toContain('Issue Count');
        expect(result).toContain('Errors');
        expect(result).toContain('Warnings');
        expect(result).toContain('false');
        expect(result).toContain('0');
        expect(result).not.toContain('Error 1');
        expect(result).not.toContain('Warning 1');
    });
});