import Ajv2020, { ErrorObject } from 'ajv/dist/2020.js';
import { existsSync, promises as fs, readdirSync, readFileSync, statSync } from 'fs';
import { Spectral, ISpectralDiagnostic, RulesetDefinition } from '@stoplight/spectral-core';

import validationRulesForPattern from '../../spectral/rules-pattern';
import validationRulesForArchitecture from '../../spectral/rules-architecture';
import { DiagnosticSeverity } from '@stoplight/types';
import * as winston from 'winston';
import { initLogger } from '../helper.js';
import { ValidationOutput, ValidationOutcome } from './validation.output.js';
import { SpectralResult } from './spectral.result.js';
import createJUnitReport from './output-formats/junit-output.js';
import prettyFormat from './output-formats/pretty-output';
import { SchemaDirectory } from '../../schema-directory.js';

let logger: winston.Logger; // defined later at startup


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
async function loadMetaSchemas(metaSchemaLocation: string): Promise<SchemaDirectory> {
    logger.info(`Loading meta schema(s) from ${metaSchemaLocation}`);

    const schemaDirectory = new SchemaDirectory();
    await schemaDirectory.loadSchemas(metaSchemaLocation);

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
 * This is essentially the old function, just wrapped into the nicer functions.
 * @param jsonSchemaArchitectureLocation 
 * @param jsonSchemaLocation 
 * @param metaSchemaPath 
 * @param debug 
 * @param failOnWarnings 
 */
export async function validateAndExitConditionally(
    jsonSchemaArchitectureLocation: string,
    jsonSchemaLocation: string,
    metaSchemaPath: string,
    debug: boolean = false,
    failOnWarnings: boolean = false
): Promise<void> {
    const outcome = await validate(jsonSchemaArchitectureLocation, jsonSchemaLocation, metaSchemaPath, debug);
    exitBasedOffOfValidationOutcome(outcome, failOnWarnings);
}

/**
 * Validation - with simple input parameters and output validation outcomes.
 * @param jsonSchemaArchitectureLocation 
 * @param jsonSchemaLocation 
 * @param metaSchemaPath 
 * @param debug 
 * @returns 
 */
export async function validate(
    jsonSchemaArchitectureLocation: string,
    jsonSchemaLocation: string,
    metaSchemaPath: string,
    debug: boolean = false): Promise<ValidationOutcome> {

    logger = initLogger(debug);
    try {
        if (jsonSchemaArchitectureLocation && jsonSchemaLocation) {
            return await validateArchitectureAgainstPattern(jsonSchemaArchitectureLocation, jsonSchemaLocation, metaSchemaPath, debug);
        } else if (jsonSchemaLocation) {
            return await validatePatternOnly(jsonSchemaLocation, metaSchemaPath, debug);
        } else if (jsonSchemaArchitectureLocation) {
            return await validateArchitectureOnly(jsonSchemaArchitectureLocation);
        } else {
            logger.debug('You must provide at least an architecture or a pattern');
            throw new Error('You must provide at least an architecture or a pattern');
        }
    } catch (error) {
        logger.error('An error occured:', error);
        process.exit(1);
    }
}

/**
 * Run the spectral rules for the pattern and the architecture, and then compile the pattern and validate the architecture against it.
 * 
 * @param jsonSchemaArchitectureLocation - the location of the architecture to validate.
 * @param jsonSchemaLocation - the location of the pattern to validate against.
 * @param metaSchemaPath - the path of the meta schemas to use for ajv.
 * @param debug - the flag to enable debug logging.
 * @returns the validation outcome with the results of the spectral and json schema validations.
 */
async function validateArchitectureAgainstPattern(jsonSchemaArchitectureLocation:string, jsonSchemaLocation:string, metaSchemaPath:string, debug: boolean): Promise<ValidationOutcome>{
    const schemaDirectory = await loadMetaSchemas(metaSchemaPath);
    const ajv = buildAjv2020(schemaDirectory, debug);

    logger.info(`Loading pattern from : ${jsonSchemaLocation}`);
    const jsonSchema = await getFileFromUrlOrPath(jsonSchemaLocation);
    const spectralResultForPattern: SpectralResult = await runSpectralValidations(stripRefs(jsonSchema), validationRulesForPattern);
    const validateSchema = await ajv.compileAsync(jsonSchema);

    logger.info(`Loading architecture from : ${jsonSchemaArchitectureLocation}`);
    const jsonSchemaArchitecture = await getFileFromUrlOrPath(jsonSchemaArchitectureLocation);

    const spectralResultForArchitecture: SpectralResult = await runSpectralValidations(jsonSchemaArchitecture, validationRulesForArchitecture);

    const spectralResult = mergeSpectralResults(spectralResultForPattern, spectralResultForArchitecture);

    let errors = spectralResult.errors;
    const warnings = spectralResult.warnings;

    let jsonSchemaValidations = [];

    if (!validateSchema(jsonSchemaArchitecture)) {
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
 * @param jsonSchemaLocation - the location of the patterns JSON Schema to validate.
 * @param metaSchemaPath - the path of the meta schemas to use for ajv.
 * @param debug - the flag to enable debug logging.
 * @returns the validation outcome with the results of the spectral validation and the pattern compilation.
 */
async function validatePatternOnly(jsonSchemaLocation: string, metaSchemaPath: string, debug: boolean): Promise<ValidationOutcome> {
    logger.debug('Architecture was not provided, only the Pattern Schema will be validated');
    const schemaDirectory = await loadMetaSchemas(metaSchemaPath);
    const ajv = buildAjv2020(schemaDirectory, debug);

    const patternSchema = await getFileFromUrlOrPath(jsonSchemaLocation);
    const spectralValidationResults: SpectralResult = await runSpectralValidations(stripRefs(patternSchema), validationRulesForPattern);
    
    let errors = spectralValidationResults.errors;
    const warnings = spectralValidationResults.warnings;
    const jsonSchemaErrors = [];

    try {
        await ajv.compileAsync(patternSchema); 
    } catch (error) {
        errors = true;
        jsonSchemaErrors.push(new ValidationOutput('json-schema', 'error', error.message, '/'));
    }

    return new ValidationOutcome(jsonSchemaErrors, spectralValidationResults.spectralIssues, errors, warnings);// added spectral to return object
}

/**
 * Run the spectral validations for the case where only the architecture is provided.
 * 
 * @param architectureSchemaLocation - The location of the architecture schema.
 * @returns the validation outcome with the results of the spectral validation.
 */
async function validateArchitectureOnly(architectureSchemaLocation: string): Promise<ValidationOutcome> {
    logger.debug('Pattern was not provided, only the Architecture will be validated');
    
    const jsonSchemaArchitecture = await getFileFromUrlOrPath(architectureSchemaLocation);
    const spectralResultForArchitecture: SpectralResult = await runSpectralValidations(jsonSchemaArchitecture, validationRulesForArchitecture); 
    return new ValidationOutcome([], spectralResultForArchitecture.spectralIssues, spectralResultForArchitecture.errors, spectralResultForArchitecture.warnings);
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

async function getFileFromUrlOrPath(input: string) {
    const urlPattern = /^https?:\/\//;
    if (urlPattern.test(input)) {
        return await loadFileFromUrl(input);
    }
    return await getFileFromPath(input);
}

async function getFileFromPath(filePath: string) {
    if (!existsSync(filePath)) {
        throw new Error(`File could not be found at ${filePath}`);
    }
    const file = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(file);
}

async function loadFileFromUrl(fileUrl: string) {
    const res = await fetch(fileUrl);
    if (!res.ok) {
        throw new Error(`The http request to ${fileUrl} did not succeed. Status code ${res.status}`);
    }
    const body = await res.json();
    return body;
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