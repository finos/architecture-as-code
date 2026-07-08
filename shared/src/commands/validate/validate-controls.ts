import pointer from 'json-pointer';
import { CalmControlDetail } from '@finos/calm-models/model';
import { ErrorObject } from 'ajv/dist/2020.js';
import { SchemaDirectory } from '../../schema-directory.js';
import { JsonSchemaValidator } from './json-schema-validator.js';
import { ValidationOutput } from './validation.output.js';
import { initLogger, Logger } from '../../logger.js';
import { getErrorMessage } from '../../error-utils.js';
import { iterateControls } from '../../controls/control-iteration.js';
import { tryParseCalmCore } from './calm-core-parse.js';

type ControlDetailResult = { outputs: ValidationOutput[], hasErrors: boolean };

/**
 * Validate all control requirements in the architecture against their requirement schemas.
 *
 * Controls are enumerated once via the {@link iterateControls} helper. For each control detail
 * with a config, the requirement schema is loaded and the config validated against it via AJV.
 *
 * If a requirement-url starts with '#', it is treated as a JSON pointer into the pattern
 * document, allowing control requirement schemas to be embedded in the pattern itself.
 *
 * @param architecture     Raw architecture object.
 * @param pattern          Pattern document (needed for '#'-prefixed requirement-url resolution).
 * @param schemaDirectory  For loading requirement schemas and configs by URL.
 * @param debug            Enable debug logging.
 */
export async function validateAllControls(
    architecture: object,
    pattern: object | undefined,
    schemaDirectory: SchemaDirectory,
    debug: boolean
): Promise<{ jsonSchemaOutputs: ValidationOutput[], hasErrors: boolean, hasWarnings: boolean }> {
    const logger = initLogger(debug, 'validate-controls');
    const outputs: ValidationOutput[] = [];
    let hasErrors = false;
    let hasWarnings = false;

    if (JSON.stringify(architecture).includes('"control-requirement-url"')) {
        outputs.push(legacyNamingWarning());
        hasWarnings = true;
    }

    const calmCore = tryParseCalmCore(architecture, logger);
    if (!calmCore) {
        return { jsonSchemaOutputs: outputs, hasErrors, hasWarnings };
    }

    for (const location of iterateControls(calmCore)) {
        for (const [reqIdx, detail] of location.control.requirements.entries()) {
            const controlPath = `${location.pathPrefix}/${location.controlId}/requirements/${reqIdx}`;
            const result = await validateControlDetail(detail, controlPath, pattern, schemaDirectory, debug);
            outputs.push(...result.outputs);
            if (result.hasErrors) hasErrors = true;
        }
    }

    return { jsonSchemaOutputs: outputs, hasErrors, hasWarnings };
}

async function validateControlDetail(
    detail: CalmControlDetail,
    controlPath: string,
    pattern: object | undefined,
    schemaDirectory: SchemaDirectory,
    debug: boolean
): Promise<ControlDetailResult> {
    const logger = initLogger(debug, 'validate-controls');
    const requirementUrl = detail.requirement.reference;

    if (!requirementUrl) {
        logger.debug(`Skipping control at ${controlPath}: requirement-url is missing (possible legacy naming)`);
        return nothing();
    }

    const { schema: requirementSchema, error: schemaError } = await resolveRequirementSchema(requirementUrl, controlPath, pattern, schemaDirectory);
    if (schemaError) return fail(schemaError);
    if (!requirementSchema) return nothing();

    const { config, error: configError } = await resolveConfig(detail, controlPath, schemaDirectory, logger);
    if (configError) return fail(configError);
    if (!config) return nothing();

    return runSchemaValidation(config, requirementSchema, requirementUrl, controlPath, schemaDirectory, debug);
}

async function resolveRequirementSchema(
    requirementUrl: string,
    controlPath: string,
    pattern: object | undefined,
    schemaDirectory: SchemaDirectory
): Promise<{ schema?: object, error?: ValidationOutput }> {
    if (requirementUrl.startsWith('#')) {
        // resolve an in-pattern ref (i.e. inline control requirement schema)
        return resolvePointerInPattern(requirementUrl, controlPath, pattern);
    }
    return loadSchemaFromDirectory(requirementUrl, controlPath, schemaDirectory);
}

/**
 * Resolve an in-pattern requirement schema reference (JSON pointer) to the actual schema definition.
 * This is how inline control requirement schemas are supported in patterns.
 */
function resolvePointerInPattern(
    requirementUrl: string,
    controlPath: string,
    pattern: object | undefined
): { schema?: object, error?: ValidationOutput } {
    if (!pattern) {
        return { error: controlError(controlPath, `requirement-url '${requirementUrl}' is a JSON pointer but no pattern document is available`) };
    }
    try {
        return { schema: pointer.get(pattern, requirementUrl.slice(1)) as object };
    } catch {
        return { error: controlError(controlPath, `Could not resolve requirement-url '${requirementUrl}' as a JSON pointer in the pattern document`) };
    }
}

async function loadSchemaFromDirectory(
    requirementUrl: string,
    controlPath: string,
    schemaDirectory: SchemaDirectory
): Promise<{ schema?: object, error?: ValidationOutput }> {
    let schema: object | undefined;
    try {
        schema = await schemaDirectory.getSchema(requirementUrl);
    } catch (err) {
        return { error: controlError(controlPath, `Could not load requirement schema from '${requirementUrl}': ${getErrorMessage(err)}`) };
    }
    if (!schema) {
        return { error: controlError(controlPath, `Requirement schema not found: '${requirementUrl}'`) };
    }
    return { schema };
}

/**
 * Resolve a control's config. Prefers an inline `config`; otherwise loads the `config-url`
 * document directly via the SchemaDirectory. Returns an empty result if neither is present
 * or the config document could not be found.
 */
async function resolveConfig(
    detail: CalmControlDetail,
    controlPath: string,
    schemaDirectory: SchemaDirectory,
    logger: Logger
): Promise<{ config?: Record<string, unknown>, error?: ValidationOutput }> {
    if (detail.config) {
        return { config: detail.config };
    }
    if (!detail.configUrl) {
        logger.debug(`No config for control requirement at ${controlPath}, skipping`);
        return {};
    }

    const configUrl = detail.configUrl.reference;
    try {
        const config = await schemaDirectory.getSchema(configUrl) as Record<string, unknown> | undefined;
        if (!config) {
            logger.debug(`Config document not found at '${configUrl}', skipping validation`);
            return {};
        }
        return { config };
    } catch (err) {
        return { error: controlError(controlPath, `Could not load config from '${configUrl}': ${getErrorMessage(err)}`) };
    }
}

async function runSchemaValidation(
    config: Record<string, unknown>,
    requirementSchema: object,
    requirementUrl: string,
    controlPath: string,
    schemaDirectory: SchemaDirectory,
    debug: boolean
): Promise<ControlDetailResult> {
    let validator: JsonSchemaValidator;
    try {
        validator = new JsonSchemaValidator(schemaDirectory, requirementSchema, debug);
        await validator.initialize();
    } catch (err) {
        return fail(controlError(controlPath, `Could not compile requirement schema from '${requirementUrl}': ${getErrorMessage(err)}`));
    }
    const errors = validator.validate(config);
    return { outputs: controlErrorsToValidationOutputs(errors, controlPath), hasErrors: errors.length > 0 };
}

function controlErrorsToValidationOutputs(errors: ErrorObject[], controlPath: string): ValidationOutput[] {
    return errors.map(error => {
        const rawPath = error.instancePath ?? '';
        const path = rawPath === '' ? controlPath : controlPath + rawPath;
        return ValidationOutput.error('control-requirement-validation', error.message ?? '', path, {
            schemaPath: error.schemaPath,
            source: 'architecture'
        });
    });
}

function legacyNamingWarning(): ValidationOutput {
    return ValidationOutput.warning(
        'control-legacy-naming',
        'Architecture contains legacy control naming (control-requirement-url). Migrate to requirement-url. Controls with legacy naming were not validated.',
        '/',
        { source: 'architecture' }
    );
}

function controlError(path: string, message: string): ValidationOutput {
    return ValidationOutput.error('control-requirement-validation', message, path, { source: 'architecture' });
}

function nothing(): ControlDetailResult {
    return { outputs: [], hasErrors: false };
}

function fail(output: ValidationOutput): ControlDetailResult {
    return { outputs: [output], hasErrors: true };
}
