import { CalmInterfaceDefinition } from '@finos/calm-models/model';
import { ErrorObject } from 'ajv/dist/2020.js';
import { SchemaDirectory } from '../../schema-directory.js';
import { JsonSchemaValidator } from './json-schema-validator.js';
import { ValidationOutput } from './validation.output.js';
import { initLogger } from '../../logger.js';
import { getErrorMessage } from '../../error-utils.js';
import { tryParseCalmCore } from './calm-core-parse.js';

/**
 * Validate the `config` of every node interface definition against the schema at its
 * `definition-url`.
 *
 * A definition that cannot be loaded or compiled is a warning, not an error: before this check
 * existed such architectures validated cleanly, and the definition is often hosted elsewhere.
 *
 * @param architecture     Raw architecture object.
 * @param schemaDirectory  For loading interface definition schemas by URL.
 * @param debug            Enable debug logging.
 */
export async function validateAllInterfaces(
    architecture: object,
    schemaDirectory: SchemaDirectory,
    debug: boolean
): Promise<{ jsonSchemaOutputs: ValidationOutput[], hasErrors: boolean, hasWarnings: boolean }> {
    const logger = initLogger(debug, 'validate-interfaces');
    const outputs: ValidationOutput[] = [];
    let hasErrors = false;
    let hasWarnings = false;

    const calmCore = tryParseCalmCore(architecture, logger);
    if (!calmCore) {
        return { jsonSchemaOutputs: outputs, hasErrors, hasWarnings };
    }

    // Load and compile each definition once, also when it fails, so many interfaces that share
    // one unreachable or large definition do not fetch or compile it again for each interface.
    const definitions = new Map<string, LoadedDefinition>();

    for (const [nodeIdx, node] of calmCore.nodes.entries()) {
        for (const [interfaceIdx, calmInterface] of (node.interfaces ?? []).entries()) {
            if (!(calmInterface instanceof CalmInterfaceDefinition)) {
                continue;
            }
            const interfacePath = `/nodes/${nodeIdx}/interfaces/${interfaceIdx}`;
            const definitionUrl = calmInterface.definitionUrl.reference;

            let loaded = definitions.get(definitionUrl);
            if (!loaded) {
                loaded = await loadDefinition(definitionUrl, schemaDirectory, debug);
                definitions.set(definitionUrl, loaded);
            }
            if ('warning' in loaded) {
                outputs.push(unresolvedWarning(interfacePath, loaded.warning));
                hasWarnings = true;
                continue;
            }

            const errors = loaded.validator.validate(calmInterface.config);
            outputs.push(...configErrorsToValidationOutputs(errors, `${interfacePath}/config`));
            if (errors.length > 0) hasErrors = true;
        }
    }

    return { jsonSchemaOutputs: outputs, hasErrors, hasWarnings };
}

/** A compiled definition, or the warning message to report at each interface that uses it. */
type LoadedDefinition = { validator: JsonSchemaValidator } | { warning: string };

async function loadDefinition(
    definitionUrl: string,
    schemaDirectory: SchemaDirectory,
    debug: boolean
): Promise<LoadedDefinition> {
    let schema: object | undefined;
    try {
        schema = await schemaDirectory.getSchema(definitionUrl);
    } catch (err) {
        return { warning: `Could not load interface definition from '${definitionUrl}': ${getErrorMessage(err)}. The interface config was not validated.` };
    }
    if (!schema) {
        return { warning: `Interface definition not found: '${definitionUrl}'. The interface config was not validated.` };
    }

    try {
        const validator = new JsonSchemaValidator(schemaDirectory, schema, debug);
        await validator.initialize();
        return { validator };
    } catch (err) {
        return { warning: `Could not compile interface definition from '${definitionUrl}': ${getErrorMessage(err)}. The interface config was not validated.` };
    }
}

function configErrorsToValidationOutputs(errors: ErrorObject[], configPath: string): ValidationOutput[] {
    return errors.map(error =>
        ValidationOutput.error('interface-definition-validation', error.message ?? '', configPath + (error.instancePath ?? ''), {
            schemaPath: error.schemaPath,
            source: 'architecture'
        })
    );
}

function unresolvedWarning(path: string, message: string): ValidationOutput {
    return ValidationOutput.warning('interface-definition-unresolved', message, path, { source: 'architecture' });
}
