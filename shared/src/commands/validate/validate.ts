import Ajv2020, { ErrorObject } from 'ajv/dist/2020.js';
import { Spectral, ISpectralDiagnostic, RulesetDefinition } from '@stoplight/spectral-core';

import validationRulesForPattern from '../../spectral/rules-pattern';
import validationRulesForArchitecture from '../../spectral/rules-architecture';
import { DiagnosticSeverity } from '@stoplight/types';
import { initLogger, Logger } from '../../logger.js';
import { ValidationOutput, ValidationOutcome } from './validation.output.js';
import { SpectralResult } from './spectral.result.js';
import createJUnitReport from './output-formats/junit-output.js';
import prettyFormat from './output-formats/pretty-output.js';
import { SchemaDirectory } from '../../schema-directory.js';
import { FileSystemDocumentLoader } from '../../document-loader/file-system-document-loader';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';

let logger: Logger; // defined later at startup

export type ValidateOutputFormat = 'json' | 'junit' | 'pretty';

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

export type OutputFormat = 'junit' | 'json' | 'pretty'

export function formatOutput(
    validationOutcome: ValidationOutcome,
    format: OutputFormat
): string {
    logger.info(`Formatting output as ${format}`);
    switch (format) {
    case 'junit': {
        const spectralRuleNames = extractSpectralRuleNames();
        return createJUnitReport(validationOutcome, spectralRuleNames);
    }
    case 'pretty':
        return prettyFormat(validationOutcome);
    case 'json':
        return prettifyJson(validationOutcome);
    }
}

/**
 * Builds an AJV instance, configured to defer to the SchemaDirectory in the event of any missing schemas.
 * 
 * @param schemaDirectory An initialised SchemaDirectory with schemas already loaded.
 * @param debug Whether to log at debug level.
 * @returns An initialised Ajv instance.
 */
function buildAjv2020(schemaDirectory: SchemaDirectory, debug: boolean): Ajv2020 {
    const strictType = debug ? 'log' : false;
    return new Ajv2020({
        strict: strictType, allErrors: true, loadSchema: async (schemaId) => {
            try {
                return schemaDirectory.getSchema(schemaId);
            } catch (error) {
                console.error(`Error fetching schema: ${error.message}`);
            }
        }
    });
}

/**
 * Initialises a SchemaDirectory and loads schemas into it.
 * 
 * @param metaSchemaLocation File location from which to load schemas.
 * @returns an initialised SchemaDirectory.
 */
async function loadMetaSchemas(metaSchemaLocation: string, debug: boolean): Promise<SchemaDirectory> {
    logger.info(`Loading meta schema(s) from ${metaSchemaLocation}`);

    const docLoader = new FileSystemDocumentLoader([metaSchemaLocation], debug);
    const schemaDirectory = new SchemaDirectory(docLoader, debug);
    await schemaDirectory.loadSchemas();

    return schemaDirectory;
}

async function runSpectralValidations(
    schema: string,
    spectralRuleset: RulesetDefinition
): Promise<SpectralResult> {
    let errors = false;
    let warnings = false;
    let spectralIssues: ValidationOutput[] = [];
    const spectral = new Spectral();

    spectral.setRuleset(spectralRuleset);
    const issues = await spectral.run(schema);

    if (issues && issues.length > 0) {
        logger.debug(`Spectral raw output: ${prettifyJson(issues)}`);
        sortSpectralIssueBySeverity(issues);
        spectralIssues = convertSpectralDiagnosticToValidationOutputs(issues);
        if (issues.filter(issue => issue.severity === 0).length > 0) {
            logger.debug('Spectral output contains errors');
            errors = true;
        }
        if (issues.filter(issue => issue.severity === 1).length > 0) {
            logger.debug('Spectral output contains warnings');
            warnings = true;
        }
    }
    return new SpectralResult(warnings, errors, spectralIssues);
}


/**
 * Validation - with simple input parameters and output validation outcomes.
 * @param architecture The architecture as a JS object
 * @param pattern The pattern as a JS object
 * @param metaSchemaPath File path to meta schema directory
 * @param debug Whether to log at debug level
 * @returns Validation report
 */
export async function validate(
    architecture: object,
    pattern: object,
    metaSchemaPath: string,
    debug: boolean = false
): Promise<ValidationOutcome> {
    logger = initLogger(debug, 'calm-validate');
    
    try {
        if (architecture && pattern) {
            return await validateArchitectureAgainstPattern(architecture, pattern, metaSchemaPath, debug);
        } else if (pattern) {
            return await validatePatternOnly(pattern, metaSchemaPath, debug);
        } else if (architecture) {
            return await validateArchitectureOnly(architecture);
        } else {
            logger.debug('You must provide at least an architecture or a pattern');
            throw new Error('You must provide at least an architecture or a pattern');
        }
    } catch (error) {
        logger.error('An error occured:'+ error);
        throw error;
    }
}

/**
 * Run the spectral rules for the pattern and the architecture, and then compile the pattern and validate the architecture against it.
 * 
 * @param architecture - the architecture to validate.
 * @param pattern - the pattern to validate against.
 * @param metaSchemaPath - the path of the meta schemas to use for ajv.
 * @param debug - the flag to enable debug logging.
 * @returns the validation outcome with the results of the spectral and json schema validations.
 */
async function validateArchitectureAgainstPattern(architecture: object, pattern: object, metaSchemaPath: string, debug: boolean): Promise<ValidationOutcome>{
    const schemaDirectory = await loadMetaSchemas(metaSchemaPath, debug);
    const ajv = buildAjv2020(schemaDirectory, debug);

    const spectralResultForPattern: SpectralResult = await runSpectralValidations(stripRefs(pattern), validationRulesForPattern);
    const validateSchema = await ajv.compileAsync(pattern);

    // TODO keep consistent as string or object
    const spectralResultForArchitecture: SpectralResult = await runSpectralValidations(JSON.stringify(architecture), validationRulesForArchitecture);

    const spectralResult = mergeSpectralResults(spectralResultForPattern, spectralResultForArchitecture);

    let errors = spectralResult.errors;
    const warnings = spectralResult.warnings;

    let jsonSchemaValidations = [];

    if (!validateSchema(architecture)) {
        logger.debug(`JSON Schema validation raw output: ${prettifyJson(validateSchema.errors)}`);
        errors = true;
        jsonSchemaValidations = convertJsonSchemaIssuesToValidationOutputs(validateSchema.errors);
    }

    return new ValidationOutcome(jsonSchemaValidations, spectralResult.spectralIssues, errors, warnings);
}

/**
 * Run validations for the case where only the pattern is provided. 
 * This essentially runs the spectral validations and tries to compile the pattern.
 * 
 * @param pattern - the pattern to validate.
 * @param metaSchemaPath - the path of the meta schemas to use for ajv.
 * @param debug - the flag to enable debug logging.
 * @returns the validation outcome with the results of the spectral validation and the pattern compilation.
 */
async function validatePatternOnly(pattern: object, metaSchemaPath: string, debug: boolean): Promise<ValidationOutcome> {
    logger.debug('Architecture was not provided, only the Pattern Schema will be validated');
    const schemaDirectory = await loadMetaSchemas(metaSchemaPath, debug);
    const ajv = buildAjv2020(schemaDirectory, debug);

    const spectralValidationResults: SpectralResult = await runSpectralValidations(stripRefs(pattern), validationRulesForPattern);
    
    let errors = spectralValidationResults.errors;
    const warnings = spectralValidationResults.warnings;
    const jsonSchemaErrors = [];

    try {
        await ajv.compileAsync(pattern); 
    } catch (error) {
        errors = true;
        jsonSchemaErrors.push(new ValidationOutput('json-schema', 'error', error.message, '/'));
    }

    return new ValidationOutcome(jsonSchemaErrors, spectralValidationResults.spectralIssues, errors, warnings);// added spectral to return object
}

/**
 * Run the spectral validations for the case where only the architecture is provided.
 * When no pattern is provided, validate the architecture against the CALM schema specified in its $schema property.
 * 
 * @param architectureSchemaLocation - The location of the architecture schema.
 * @param metaSchemaPath - The path of the meta schemas to use for ajv (optional).
 * @param debug - The flag to enable debug logging (optional).
 * @returns the validation outcome with the results of the spectral validation and JSON schema validation.
 */
async function validateArchitectureOnly(architecture: object, metaSchemaPath?: string, debug: boolean = false): Promise<ValidationOutcome> {
    logger.debug('Pattern was not provided, validating Architecture against its specified CALM schema');
    
    const spectralResultForArchitecture: SpectralResult = await runSpectralValidations(JSON.stringify(architecture), validationRulesForArchitecture);
    
    let jsonSchemaValidations = [];
    let errors = spectralResultForArchitecture.errors;
    const warnings = spectralResultForArchitecture.warnings;
    
    logger.debug(`metaSchemaPath provided: ${metaSchemaPath}`);
    
    // If metaSchemaPath is provided, attempt to validate against the CALM schema specified in the architecture
    if (metaSchemaPath) {
        logger.debug('Attempting CALM schema validation');
        try {
            const schemaUrl = architecture['$schema'];
            
            logger.debug(`Parsed architecture object, $schema: ${schemaUrl}`);
            
            if (schemaUrl) {
                logger.debug(`Found $schema reference: ${schemaUrl}`);
                logger.debug('Validating architecture against its specified CALM schema');
                
                const schemaDirectory = await loadMetaSchemas(metaSchemaPath, debug);
                const ajv = buildAjv2020(schemaDirectory, debug);
                
                // Load the schema from the URL specified in the architecture
                logger.debug(`Loading schema from: ${schemaUrl}`);
                
                // For schema loading, we need to handle both URL and local file cases
                let calmSchemaObject;
                const urlPattern = /^https?:\/\//;
                if (urlPattern.test(schemaUrl)) {
                    const content = await loadFileFromUrl(schemaUrl);
                    calmSchemaObject = typeof content === 'string' ? JSON.parse(content) : content;
                } else {
                    // For local files, read as raw string and parse
                    if (!existsSync(schemaUrl)) {
                        throw new Error(`Schema file could not be found at ${schemaUrl}`);
                    }
                    const rawContent = await readFile(schemaUrl, 'utf-8');
                    calmSchemaObject = JSON.parse(rawContent);
                }
                
                logger.debug('Loaded schema object');
                
                const validateSchema = await ajv.compileAsync(calmSchemaObject);
                
                logger.debug('Compiled schema, running validation');
                const validationResult = validateSchema(architecture);
                logger.debug(`Validation result: ${validationResult}`);
                
                if (!validationResult) {
                    logger.debug(`JSON Schema validation raw output: ${prettifyJson(validateSchema.errors)}`);
                    errors = true;
                    jsonSchemaValidations = convertJsonSchemaIssuesToValidationOutputs(validateSchema.errors);
                    logger.debug(`Converted ${jsonSchemaValidations.length} validation errors`);
                }
            } else {
                logger.debug('No $schema property found in architecture document, skipping CALM schema validation');
            }
        } catch (error) {
            logger.debug(`Error during CALM schema validation: ${error.message}`);
            logger.debug(`Error stack: ${error.stack}`);
            // Don't fail the entire validation if schema validation fails - just log and continue with spectral validation
        }
    } else {
        logger.debug('No metaSchemaPath provided, skipping CALM schema validation');
    }
    
    logger.debug(`Returning validation outcome with ${jsonSchemaValidations.length} JSON schema validations, errors: ${errors}`);
    return new ValidationOutcome(jsonSchemaValidations, spectralResultForArchitecture.spectralIssues, errors, warnings);
}

function extractSpectralRuleNames(): string[] {
    const architectureRuleNames = getRuleNamesFromRuleset(validationRulesForArchitecture);
    const patternRuleNames = getRuleNamesFromRuleset(validationRulesForPattern);
    return architectureRuleNames.concat(patternRuleNames);
}

function getRuleNamesFromRuleset(ruleset: RulesetDefinition): string[] {
    return Object.keys((ruleset as { rules: Record<string, unknown> }).rules);
}

function prettifyJson(json) {
    return JSON.stringify(json, null, 4);
}

export function stripRefs(obj: object): string {
    return JSON.stringify(obj).replaceAll('$ref', 'ref');
}

export function sortSpectralIssueBySeverity(issues: ISpectralDiagnostic[]): void {
    issues.sort((issue1: ISpectralDiagnostic, issue2: ISpectralDiagnostic) =>
        issue1.severity.valueOf() - issue2.severity.valueOf()
    );
}

export function convertJsonSchemaIssuesToValidationOutputs(jsonSchemaIssues: ErrorObject[]): ValidationOutput[] {
    return jsonSchemaIssues.map(issue => new ValidationOutput(
        'json-schema',
        'error',
        issue.message,
        issue.instancePath,
        issue.schemaPath
    ));
}

export function convertSpectralDiagnosticToValidationOutputs(spectralIssues: ISpectralDiagnostic[]): ValidationOutput[] {
    const validationOutput: ValidationOutput[] = [];

    spectralIssues.forEach(issue => {
        const startRange = issue.range.start;
        const endRange = issue.range.end;
        const formattedIssue = new ValidationOutput(
            issue.code,
            getSeverity(issue.severity),
            issue.message,
            '/' + issue.path.join('/'),
            '',
            startRange.line,
            endRange.line,
            startRange.character,
            endRange.character
        );
        validationOutput.push(formattedIssue);
    });

    return validationOutput;
}


function getSeverity(spectralSeverity: DiagnosticSeverity): string {
    switch (spectralSeverity) {
    case 0:
        return 'error';
    case 1:
        return 'warning';
    case 2:
        return 'info';
    case 3:
        return 'hint';
    default:
        throw Error('The spectralSeverity does not match the known values');
    }
}

/**
 * Merge the results from two Spectral validations together, combining any errors/warnings.
 * @param spectralResultPattern Spectral results from the pattern validation
 * @param spectralResultArchitecture Spectral results from the architecture validation
 * @returns A new SpectralResult with the error/warning status propagated and the results concatenated.
 */
function mergeSpectralResults(spectralResultPattern: SpectralResult, spectralResultArchitecture: SpectralResult): SpectralResult {
    const errors: boolean = spectralResultPattern.errors || spectralResultArchitecture.errors;
    const warnings: boolean = spectralResultPattern.warnings || spectralResultArchitecture.warnings;
    const spectralValidations = spectralResultPattern.spectralIssues.concat(spectralResultArchitecture.spectralIssues);
    return new SpectralResult(warnings, errors, spectralValidations);
}

async function loadFileFromUrl(fileUrl: string) {
    const res = await fetch(fileUrl);
    if (!res.ok) {
        throw new Error(`The http request to ${fileUrl} did not succeed. Status code ${res.status}`);
    }
    const body = await res.json();
    return body;
}