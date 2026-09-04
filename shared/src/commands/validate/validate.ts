import { ValidationOutcome } from './validation.output.js';

export { validate } from './validate-core.js';

// Re-export the shared helpers from their new home so existing importers/tests keep working.
export {
    applyArchitectureOptionsToPattern,
    extractChoicesFromArchitecture,
    stripRefs,
    sortSpectralIssueBySeverity,
    convertJsonSchemaIssuesToValidationOutputs,
    convertSpectralDiagnosticToValidationOutputs
} from './validation-helpers.js';

export {
    formatOutput,
    registerOutputFormatter,
    type OutputFormat,
    type ValidateOutputFormat,
    type ValidationDocumentContext,
    type ValidationFormattingOptions,
    type OutputFormatter,
} from './format-output.js';

/**
 * TODO - move this out of shared and into the CLI - this is process-management code.
 * Given a validation outcome - exit from the process gracefully with an exit code we conrol.
 * @param validationOutcome Outcome to process from call to validate.
 * @param failOnWarnings If true, the process will exit with a non-zero exit code for warnings as well as errors.
 */
export function exitBasedOffOfValidationOutcome(validationOutcome: ValidationOutcome, failOnWarnings: boolean) {
    if (validationOutcome.hasErrors) {
        process.exit(1);
    }
    if (validationOutcome.hasWarnings && failOnWarnings) {
        process.exit(1);
    }
    process.exit(0);
}
