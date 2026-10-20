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
