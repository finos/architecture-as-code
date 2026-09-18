import { CalmChoice, selectChoices } from './components/options.js';
import { instantiate } from './components/instantiate.js';
import { flattenAllOf } from './components/flatten-allof.js';
import { SchemaDirectory } from '../../schema-directory.js';

export { instantiate } from './components/instantiate.js';
export { flattenAllOf } from './components/flatten-allof.js';
export { selectChoices, extractOptions } from './components/options.js';
export type { CalmChoice, CalmOption } from './components/options.js';
export { SchemaDirectory } from '../../schema-directory.js';

export interface GenerateOptions {
    debug?: boolean;
    chosenChoices?: CalmChoice[];
}

/**
 * Instantiate an architecture from a pattern. Pure: no filesystem access, errors propagate.
 */
export async function generate(pattern: object, schemaDirectory: SchemaDirectory, options: GenerateOptions = {}): Promise<object> {
    const debug = options.debug ?? false;
    await schemaDirectory.loadSchemas();
    let flattenedPattern = await flattenAllOf(pattern as Record<string, unknown>, schemaDirectory, debug);
    if (options.chosenChoices) {
        flattenedPattern = selectChoices(flattenedPattern, options.chosenChoices, debug);
    }
    return instantiate(flattenedPattern, debug, schemaDirectory) as Promise<object>;
}

/**
 * Run the CALM generate pipeline in memory (no filesystem write).
 * Same flatten → optional selectChoices → instantiate steps as `runGenerate`.
 */
export async function generateArchitecture(
    pattern: object,
    debug: boolean,
    schemaDirectory: SchemaDirectory,
    chosenChoices?: CalmChoice[]
): Promise<unknown> {
    return generate(pattern, schemaDirectory, { debug, chosenChoices });
}
